"""Learned ranker — personalizes the skills-match component from the recruiter's
own recorded decisions.

Honest, simple approach: for each skill, compute the *shortlist lift* from
the recruiter's history — how much more likely a candidate WITH that skill is
to be shortlisted than one WITHOUT it. Skills the recruiter repeatedly
shortlists get a modest importance boost inside the skills-match component;
skills tied to rejections are NOT penalized (absence of evidence is not
evidence — the candidate may simply have been weak elsewhere).

Rules (enforced, not just documented):
- Minimum 5 recorded decisions before personalization activates. Until then
  the default weights are used and the API says so plainly.
- A mix of outcomes is required (at least one shortlist and one rejection);
  without contrast there is nothing to learn.
- Personalization only adjusts per-skill importance inside the skills-match
  component. The 50/25/15/10 component structure stays fully explainable.
- Every adjustment is disclosed in the candidate detail, e.g. "Adjusted
  because you shortlisted 3 of 4 candidates with Kubernetes".
- It never overrides hard evidence and never changes candidate statuses:
  scoring can never auto-reject anyone.

Decision sources (per recruiter, per candidate):
- Candidate statuses: Shortlisted = positive, Rejected = negative.
- Helpful/not-helpful feedback votes linked to a candidate: good_fit =
  positive, bad_fit = negative. One decision per candidate — an explicit
  status takes precedence over a feedback vote on the same candidate.
"""

from collections import defaultdict

MIN_DECISIONS = 5
MIN_OBSERVATIONS_PER_SKILL = 2
LIFT_THRESHOLD = 1.2
ALPHA = 0.5        # how strongly lift translates into importance weight
MAX_WEIGHT = 2.0   # cap on any single skill's importance multiplier

POSITIVE_STATUSES = ("Shortlisted",)
NEGATIVE_STATUSES = ("Rejected",)


def collect_decisions(db, user_id):
    """Return [(skills:set, positive:bool)] from this recruiter's history."""
    from .db import Candidate, Feedback, ScreeningSession

    decisions = {}  # candidate_id -> (skills, positive)
    cands = (db.query(Candidate).join(ScreeningSession)
               .filter(ScreeningSession.user_id == user_id).all())
    for c in cands:
        has = set(c.matched_skills or []) | set(c.preferred_matched or [])
        if c.status in POSITIVE_STATUSES:
            decisions[c.id] = (has, True)
        elif c.status in NEGATIVE_STATUSES:
            decisions[c.id] = (has, False)
    # Linked feedback votes cover candidates without an explicit status.
    cand_by_id = {c.id: c for c in cands}
    for fb in db.query(Feedback).filter(Feedback.user_id == user_id).all():
        cid = getattr(fb, "candidate_id", None)
        if not cid or cid in decisions or cid not in cand_by_id:
            continue
        c = cand_by_id[cid]
        has = set(c.matched_skills or []) | set(c.preferred_matched or [])
        if fb.verdict == "good_fit":
            decisions[cid] = (has, True)
        elif fb.verdict == "bad_fit":
            decisions[cid] = (has, False)
    return list(decisions.values())


def compute_skill_lifts(decisions):
    """lift(skill) = P(shortlisted | has skill) / P(shortlisted | lacks skill).

    Contrasts candidates with the skill against those without it — the most
    direct reading of "this recruiter prefers candidates with this skill".
    Skills need >= 2 observations with the skill and >= 1 without it.
    """
    with_skill = defaultdict(lambda: [0, 0])    # skill -> [pos_with, total_with]
    without_skill = defaultdict(lambda: [0, 0])  # skill -> [pos_without, total_without]
    all_skills = set()
    for skills, _ in decisions:
        all_skills |= skills
    for skills, p in decisions:
        for s in all_skills:
            bucket = with_skill[s] if s in skills else without_skill[s]
            bucket[1] += 1
            if p:
                bucket[0] += 1
    lifts = {}
    for s in all_skills:
        pw, tw = with_skill[s]
        pn, tn = without_skill[s]
        if tw < MIN_OBSERVATIONS_PER_SKILL or tn < 1:
            continue
        rate_with = pw / tw
        rate_without = pn / tn
        if rate_with == 0:
            continue
        lift = (rate_with / rate_without) if rate_without > 0 else 2.0
        lift = min(lift, 3.0)
        if lift >= LIFT_THRESHOLD:
            lifts[s] = {"lift": round(lift, 2), "pos_with": pw, "total_with": tw}
    return lifts


def get_personalization(db, user_id):
    """Describe the learned adjustments for this recruiter.

    Returns {"active": bool, "decisions": n, "positive": p, "negative": q,
             "skill_boosts": {skill: {...}}, "note": str}.
    """
    decisions = collect_decisions(db, user_id)
    n = len(decisions)
    pos = sum(1 for _, p in decisions if p)
    neg = n - pos
    base = {"active": False, "decisions": n, "positive": pos, "negative": neg,
            "skill_boosts": {}, "note": ""}
    if n < MIN_DECISIONS:
        base["note"] = (
            f"Personalization needs at least {MIN_DECISIONS} recorded decisions "
            f"(shortlists or rejections) — {n} so far. Default scoring in use.")
        return base
    if pos == 0 or neg == 0:
        base["note"] = ("Personalization needs a mix of shortlists and rejections to "
                        "learn from — default scoring in use.")
        return base
    lifts = compute_skill_lifts(decisions)
    base["skill_boosts"] = lifts
    if not lifts:
        base["note"] = (f"{n} decisions recorded, but no skill stands out yet — "
                        "default scoring in use.")
        return base
    base["active"] = True
    top = sorted(lifts.items(), key=lambda kv: kv[1]["lift"], reverse=True)[:3]
    names = ", ".join(s for s, _ in top)
    base["note"] = (f"Scores tuned from your last {n} decisions — "
                    f"{names} count a little more for you.")
    return base


def skill_weights(basis, skill_boosts):
    """Importance multiplier per basis skill. Default 1.0; boosted for skills
    with strong shortlist lift. Returns (weights dict, adjustments list)."""
    weights, adjustments = {}, []
    for s in basis:
        b = (skill_boosts or {}).get(s)
        if b:
            w = min(MAX_WEIGHT, 1.0 + ALPHA * (b["lift"] - 1.0))
            w = round(w, 3)
            weights[s] = w
            adjustments.append({
                "skill": s,
                "lift": b["lift"],
                "pos_with": b["pos_with"],
                "total_with": b["total_with"],
                "weight": w,
                "note": (f"Adjusted because you shortlisted {b['pos_with']} of "
                         f"{b['total_with']} candidates with {s} — "
                         "it counts a little more."),
            })
        else:
            weights[s] = 1.0
    return weights, adjustments
