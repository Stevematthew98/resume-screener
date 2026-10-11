/**
 * TalentIQ NLP Processing Studio — stage catalogue.
 *
 * 20 stages in 5 groups, each mapped onto the 8 REAL backend execution
 * stages (plus batch-level ranking). Stages that share an execution unit
 * are marked `sub: true` and complete together with their parent — the UI
 * must never imply they ran as independent steps.
 *
 * execKey '__batch__' = batch-level (ranking), resolved from batch_complete.
 */

import { STAGE_LABELS } from '../../api';

export const GROUPS = [
  'Document Processing',
  'Linguistic Processing',
  'Information Extraction',
  'Job Matching',
  'Final Results',
];

const CODE = {
  ingest: {
    title: 'Ingestion — actual backend code (excerpt)',
    library: 'Python · stdlib',
    algorithm: 'Reads the uploaded bytes and records file metadata for the run.',
    note: 'Actual implementation from the backend.',
    code:
`step1 = {
    "analysis_id": analysis_id,
    "filename": filename,
    "file_type": ext,
    "file_size_bytes": len(file_bytes),
    "job_description_chars": len(job_description or ""),
    "min_experience_years": min_experience_years,
}`,
  },
  extract: {
    title: 'Text extraction — actual backend code (excerpt)',
    library: 'PyMuPDF · pdfplumber · Tesseract OCR',
    algorithm: 'Tries PyMuPDF first, falls back to pdfplumber, and OCRs the pages with Tesseract when almost no text is extractable (scanned PDF).',
    note: 'Actual implementation from the backend.',
    code:
`def extract_text_pdf(data: bytes) -> tuple[str, str, bool]:
    """PyMuPDF primary; pdfplumber fallback; Tesseract for scans."""
    with pymupdf.open(stream=data, filetype="pdf") as doc:
        text = "\\n".join(page.get_text() for page in doc)
    if len(text.strip()) < OCR_CHAR_THRESHOLD:   # scanned?
        ocr_text, _ = extract_text_pdf_ocr(data)  # Tesseract
        return ocr_text, "tesseract ocr", True
    return text, "pymupdf", False`,
  },
  spacyPass: {
    title: 'Linguistic processing — actual backend code',
    library: 'spaCy · en_core_web_sm',
    algorithm: 'One spaCy pass over the resume text. Tokenization, stop-word filtering and lemmatization all happen in this single list comprehension — they share execution time.',
    note: 'Actual implementation from the backend. Cleaning, tokenization, stop-word handling and lemmatization are sub-operations of this line.',
    code:
`doc = _nlp(raw_text[:200000])          # spaCy en_core_web_sm
tokens = [t.lemma_.lower()             # lemma + lowercase (normalization)
          for t in doc
          if t.is_alpha                # cleaning: drop non-letters
          and not t.is_stop]           # stop-words: spaCy's stop list`,
  },
  sentences: {
    title: 'Sentence segmentation — illustrative',
    library: 'spaCy · sentencizer',
    algorithm: 'spaCy splits the document into sentences during the same linguistic pass. The backend does not emit sentences separately, so this snippet shows how they are available.',
    note: 'Illustrative — derived from the same spaCy pass, not a separate backend step.',
    code:
`sentences = [sent.text.strip()          # spaCy sentence boundaries
             for sent in doc.sents
             if sent.text.strip()]`,
  },
  sections: {
    title: 'Section identification — actual backend code (excerpt)',
    library: 'Python · re',
    algorithm: 'Heading patterns (experience, education, skills, …) are matched with regex; text between headings becomes that section. Falls back to treating the whole document as experience-like body text.',
    note: 'Actual implementation from the backend.',
    code:
`def split_sections(text: str) -> dict:
    """Split resume text into sections using heading regexes."""
    hits = []
    for name, pat in SECTION_PATTERNS.items():
        for m in re.finditer(pat, text):
            hits.append((m.start(), name, m.end()))`,
  },
  ner: {
    title: 'Entity spotting — actual backend code (excerpt)',
    library: 'Python · re · spaCy NER (fallback)',
    algorithm: 'Emails and phones are found with patterns; the name heuristic checks the first lines, falling back to spaCy PERSON entities. This is pattern-based spotting, not full statistical NER.',
    note: 'Actual implementation from the backend.',
    code:
`email_m = EMAIL_RE.search(text)          # pattern-based spotting
for m in PHONE_RE.finditer(text):
    digits = re.sub(r"\\D", "", m.group(0))
    if 10 <= len(digits) <= 15:
        phone = m.group(0).strip(); break
...
for ent in _nlp(text[:800]).ents:        # spaCy NER fallback
    if ent.label_ == "PERSON":
        name = ent.text.strip(); break`,
  },
  skills: {
    title: 'Skill extraction — actual backend code',
    library: 'spaCy · PhraseMatcher · 234-skill taxonomy',
    algorithm: 'Every taxonomy alias becomes a phrase pattern; the matcher scans the lowercased resume and maps each hit back to its canonical skill name.',
    note: 'Actual implementation from the backend.',
    code:
`def extract_skills(text: str) -> list:
    _load_nlp()  # spaCy + PhraseMatcher over the skill taxonomy
    doc = _nlp(text.lower())
    found = set()
    for _match_id, start, end in _matcher(doc):
        span = doc[start:end].text.lower().strip()
        canon = _skill_lookup.get(span)   # alias -> canonical name
        if canon:
            found.add(canon)
    return sorted(found)`,
  },
  experience: {
    title: 'Experience extraction — actual backend code (excerpt)',
    library: 'Python · re',
    algorithm: 'Date ranges like "Jan 2020 – Mar 2022" are parsed and summed; "present" counts up to today. Falls back to explicit mentions such as "5 years of experience". Regex-based and approximate.',
    note: 'Actual implementation from the backend.',
    code:
`def extract_experience_years(text: str) -> float:
    for m in DATE_RANGE_RE.finditer(text):   # "Jan 2020 - Mar 2022"
        s = _month_year_to_float(m.group("smon"), m.group("syear"))
        e_raw = (m.group("eyear") or "").lower()
        e = now_f if e_raw in ("present", "current", "now") else ...
        if 0 < e - s < 50:
            total += e - s
    if total == 0:  # fallback: "5 years of experience"
        mentions = [float(x) for x in YEARS_MENTION_RE.findall(text)]`,
  },
  vectors: {
    title: 'Vectorization — actual backend code (excerpt)',
    library: 'sentence-transformers · scikit-learn',
    algorithm: 'Four MiniLM embeddings (full resume, skills section, experience section, job description) plus a TF-IDF vector pair for keyword-level similarity.',
    note: 'Actual implementation from the backend.',
    code:
`model = SentenceTransformer("all-MiniLM-L6-v2")
emb_resume_full, emb_skills, emb_exp, emb_jd = model.encode(
    [raw_text[:8000], skills_text[:4000],
     exp_text[:8000], jd_text[:8000]],
    convert_to_numpy=True,
)
vec = TfidfVectorizer(max_features=5000).fit_transform(
    [raw_text, jd_text])`,
  },
  similarity: {
    title: 'Similarity — actual backend code',
    library: 'NumPy',
    algorithm: 'Cosine similarity between embedding vectors: 1.0 means identical direction (same meaning), 0.0 means unrelated. Clamped to [0, 1].',
    note: 'Actual implementation from the backend.',
    code:
`def _cos(a, b) -> float:
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))

sim_full = _cos(emb_resume_full, emb_jd)     # whole resume vs JD
sim_skills = _cos(emb_skills, emb_jd)        # skills section vs JD
sim_exp = _cos(emb_exp, emb_jd)             # experience vs JD`,
  },
  scoring: {
    title: 'Match scoring — actual backend code (excerpt)',
    library: 'Python',
    algorithm: 'Fixed, explainable weights. Skills dominate; JD similarity, experience and education contribute the rest. The streaming pipeline also computes an internal embedding-based preview score, but ranking uses this formula.',
    note: 'Actual implementation from the backend (build_candidate).',
    code:
`# Scoring formula (fixed weights, shown to the recruiter):
score = (0.50 * skills_match      # required/preferred skill coverage
       + 0.25 * jd_similarity     # semantic fit to the JD
       + 0.15 * experience        # years vs minimum required
       + 0.10 * education)         # degree keyword match`,
  },
  gap: {
    title: 'Skill gap analysis — actual backend code',
    library: 'Python',
    algorithm: 'Set difference between the skills detected in the job description and those detected in the resume. "Not detected" means not found in the text — never proof the candidate lacks the skill.',
    note: 'Actual implementation from the backend.',
    code:
`matched = sorted(set(jd_skills) & set(resume_skills))
missing = sorted(set(jd_skills) - set(resume_skills))`,
  },
  ranking: {
    title: 'Candidate ranking — batch assembly',
    library: 'Python',
    algorithm: 'After every resume in the batch is scored, candidates are ordered by final score, highest first. Ranking is batch-level: it only exists once the whole batch completes.',
    note: 'Simplified view of the batch ranking assembly.',
    code:
`ranking = sorted(candidates,
                 key=lambda c: c["score"],
                 reverse=True)   # highest match score first`,
  },
};

const fmtInt = (v) => (v == null || v === '' ? '—' : Number(v).toLocaleString());
const fmtPct = (v) => (v == null || v === '' ? '—' : `${Math.round(Number(v) * 100)}%`);
const fmtDec = (v) => (v == null || v === '' ? '—' : Number(v).toFixed(4));

export const STAGES = [
  // ------------------------------------------------ GROUP 1 — Document Processing
  {
    n: 1, name: 'Resume Ingestion', group: 0, execKey: 'step1_ingest', sub: false, icon: 'FileInput',
    tagline: 'Accepts the uploaded file and registers it for analysis.',
    purpose: 'Validates the upload and records file metadata — type, size and the job it will be compared against. Nothing is scored here.',
    inputType: 'Uploaded file (PDF / DOCX)', outputType: 'File metadata record',
    io: (d) => ({
      input: { title: 'Uploaded file', rows: [['FILENAME', d?.filename || '—']] },
      output: { title: 'Registered metadata', rows: [
        ['FILE_TYPE', String(d?.file_type || '—').toUpperCase()],
        ['FILE_SIZE', d?.file_size_bytes != null ? `${Math.round(d.file_size_bytes / 1024)} KB` : '—'],
        ['JD_CHARS', fmtInt(d?.job_description_chars)],
        ['MIN_EXP_YRS', d?.min_experience_years ?? '—'],
      ]},
    }),
    viz: (d) => ({ kind: 'tiles', tiles: [
      ['FILE TYPE', String(d?.file_type || '—').toUpperCase()],
      ['SIZE', d?.file_size_bytes != null ? `${Math.round(d.file_size_bytes / 1024)} KB` : '—'],
      ['JD CHARS', fmtInt(d?.job_description_chars)],
    ]}),
    code: CODE.ingest,
    tech: ['Files are processed in memory; nothing is written to disk.', 'Supported types: PDF and DOCX, up to 10 MB each.'],
  },
  {
    n: 2, name: 'Text Extraction', group: 0, execKey: 'step2_extraction', sub: false, icon: 'FileText',
    tagline: 'Pulls the readable text out of the document.',
    purpose: 'Converts the PDF or DOCX into plain text. Scanned PDFs with no text layer are rendered to images and read with Tesseract OCR.',
    inputType: 'Document bytes', outputType: 'Plain text + extraction report',
    io: (d) => ({
      input: { title: 'Document', rows: [['SOURCE', d?.filename || 'uploaded file']] },
      output: { title: 'Extracted text', text: excerpt(d?.chars_extracted), rows: [
        ['METHOD', d?.extraction_method || '—'],
        ['OCR_USED', d?.ocr_used ? 'Yes — scanned pages' : 'No — digital text'],
        ['WORDS', fmtInt(d?.words_extracted)],
        ['CHARS', fmtInt(d?.chars_extracted)],
      ]},
    }),
    viz: (d) => ({ kind: 'sections', sections: d?.sections_found || [], previews: d?.section_previews || {}, method: d?.extraction_method }),
    code: CODE.extract,
    tech: ['Extraction chain: PyMuPDF → pdfplumber → Tesseract OCR.', 'A PDF with fewer than 50 extractable characters is treated as scanned.'],
  },
  {
    n: 3, name: 'Text Cleaning', group: 0, execKey: 'step3_preprocessing', sub: true, icon: 'Sparkles',
    tagline: 'Drops noise the models should not see.',
    purpose: 'Non-alphabetic tokens (punctuation, stray symbols, numbers-as-noise) are filtered out during the spaCy pass so downstream steps work on real words.',
    inputType: 'Raw extracted text', outputType: 'Alphabetic token stream',
    io: (d) => ({
      input: { title: 'Raw text sample', text: '“Developed   Python-based   ML models!!!”' },
      output: { title: 'After cleaning', text: 'Alphabetic tokens kept; punctuation and symbols dropped.', rows: [
        ['FILTER', 't.is_alpha — spaCy token attribute'],
      ]},
    }),
    viz: () => ({ kind: 'note', text: 'Cleaning runs inside the single spaCy preprocessing pass — it shares execution with tokenization, stop-word handling and lemmatization. The filter keeps only alphabetic tokens (t.is_alpha).' }),
    code: CODE.spacyPass,
    tech: ['No separate cleaning pass exists; the filter is part of the spaCy list comprehension.'],
  },
  {
    n: 4, name: 'Text Normalization', group: 0, execKey: 'step3_preprocessing', sub: true, icon: 'CaseSensitive',
    tagline: 'Unifies word forms: lowercase + lemmas.',
    purpose: 'Every token is lowercased and reduced to its dictionary form (lemma), so “Developed”, “developing” and “develop” all count as the same word.',
    inputType: 'Cleaned tokens', outputType: 'Normalized lemmas',
    io: (d) => ({
      input: { title: 'Example tokens', text: 'Developed · developing · MODELS' },
      output: { title: 'Normalized', text: 'develop · develop · model', rows: [
        ['UNIQUE_LEMMAS', fmtInt(d?.unique_lemmas)],
      ]},
    }),
    viz: (d) => ({ kind: 'tiles', tiles: [
      ['UNIQUE LEMMAS', fmtInt(d?.unique_lemmas)],
      ['OPERATION', 'lemma_.lower()'],
    ]}),
    code: CODE.spacyPass,
    tech: ['Lemmas come from spaCy’s en_core_web_sm model, not a stemmer — “better” → “good”, not “better” → “bett”.'],
  },
  // ------------------------------------------------ GROUP 2 — Linguistic Processing
  {
    n: 5, name: 'Sentence Segmentation', group: 1, execKey: 'step3_preprocessing', sub: true, icon: 'Scissors',
    tagline: 'Finds sentence boundaries in the text.',
    purpose: 'spaCy’s sentencizer marks sentence boundaries during the same linguistic pass. The backend does not emit sentences as a separate output — they are available to any component that needs per-sentence context.',
    inputType: 'Normalized text', outputType: 'Sentence list (internal)',
    io: () => ({
      input: { title: 'Resume text', text: 'Continuous prose from the extractor.' },
      output: { title: 'Sentences', text: 'Available via doc.sents in the same spaCy pass — not separately stored.' },
    }),
    viz: () => ({ kind: 'note', text: 'Sentence boundaries come from spaCy’s statistical sentencizer inside the preprocessing pass. There is no independent segmentation step or timing.' }),
    code: CODE.sentences,
    tech: ['Illustrative snippet — the backend runs one spaCy pass; sentences are a view over it.'],
  },
  {
    n: 6, name: 'Tokenization', group: 1, execKey: 'step3_preprocessing', sub: true, icon: 'Tags',
    tagline: 'Splits text into processable units.',
    purpose: 'spaCy’s tokenizer splits the resume into tokens (words, roughly) — the atomic units every later operation works on.',
    inputType: 'Clean text', outputType: 'Token sequence',
    io: (d) => ({
      input: { title: 'Sample', text: '“Developed Machine Learning models using Python”' },
      output: { title: 'Tokens (illustrative)', text: 'developed · machine · learning · models · using · python', rows: [
        ['TOKENS_KEPT', fmtInt(d?.tokens_after_preprocessing)],
      ]},
    }),
    viz: (d) => ({ kind: 'tiles', tiles: [
      ['TOKENS AFTER FILTERING', fmtInt(d?.tokens_after_preprocessing)],
      ['TOKENIZER', 'spaCy'],
    ]}),
    code: CODE.spacyPass,
    tech: ['Token counts above are real (post stop-word removal). The sample tokenization is illustrative.'],
  },
  {
    n: 7, name: 'Stop-Word Handling', group: 1, execKey: 'step3_preprocessing', sub: true, icon: 'Filter',
    tagline: 'Removes low-signal filler words.',
    purpose: 'Common words (“the”, “and”, “with”, “using”) carry little meaning for matching, so spaCy’s built-in stop list filters them out before vectors and skill matching.',
    inputType: 'Token sequence', outputType: 'Content tokens',
    io: (d) => ({
      input: { title: 'Tokens in', text: 'developed · machine · learning · models · using · python' },
      output: { title: 'Tokens kept', text: 'developed · machine · learning · models · python', rows: [
        ['REMOVED', '“using” — on spaCy’s English stop list'],
      ]},
    }),
    viz: () => ({ kind: 'note', text: 'Filtering is the `not t.is_stop` clause of the preprocessing pass — spaCy’s ~326-word English stop list. No separate stop-word stage runs.' }),
    code: CODE.spacyPass,
    tech: ['Stop-word removal happens before embedding and TF-IDF, improving signal-to-noise.'],
  },
  {
    n: 8, name: 'Lemmatization', group: 1, execKey: 'step3_preprocessing', sub: true, icon: 'BookOpen',
    tagline: 'Reduces words to dictionary form.',
    purpose: 'Each token is replaced by its lemma — the base form spaCy predicts from context — so inflections of the same word match each other.',
    inputType: 'Content tokens', outputType: 'Lemmas',
    io: (d) => ({
      input: { title: 'Tokens', text: 'developed · models · analyses' },
      output: { title: 'Lemmas', text: 'develop · model · analysis', rows: [
        ['UNIQUE_LEMMAS', fmtInt(d?.unique_lemmas)],
      ]},
    }),
    viz: (d) => ({ kind: 'tiles', tiles: [
      ['UNIQUE LEMMAS', fmtInt(d?.unique_lemmas)],
      ['METHOD', 'spaCy lemma_'],
    ]}),
    code: CODE.spacyPass,
    tech: ['Lemmatization is context-aware: spaCy uses part-of-speech to pick the right lemma.'],
  },
  // ------------------------------------------------ GROUP 3 — Information Extraction
  {
    n: 9, name: 'Resume Section Identification', group: 2, execKey: 'step2_extraction', sub: true, icon: 'LayoutList',
    tagline: 'Maps the resume into labeled sections.',
    purpose: 'Heading patterns locate Experience, Education, Skills, Projects and other sections so later stages can read the right part of the document (e.g. skills from the skills section).',
    inputType: 'Extracted text', outputType: 'Section map',
    io: (d) => ({
      input: { title: 'Headings found', rows: [['SECTIONS', (d?.sections_found || []).join(', ') || '—']] },
      output: { title: 'Section map', text: 'Text between headings is assigned to that section.' },
    }),
    viz: (d) => ({ kind: 'sections', sections: d?.sections_found || [], previews: d?.section_previews || {} }),
    code: CODE.sections,
    tech: ['If no headings are found, the whole document is treated as experience-like body text.'],
  },
  {
    n: 10, name: 'Named Entity Recognition', group: 2, execKey: 'step3_preprocessing', sub: true, icon: 'ScanSearch',
    tagline: 'Spots names, emails and phone numbers.',
    purpose: 'Contact details are located with patterns; the name heuristic falls back to spaCy’s PERSON entities. Detected PII is redacted before any text is echoed — and identity markers are never scored.',
    inputType: 'Resume text', outputType: 'Detected contact markers (redacted)',
    io: () => ({
      input: { title: 'Resume header', text: 'Name, email and phone as written by the candidate.' },
      output: { title: 'Detected', text: 'email ✓ · phone ✓ · name ✓ — values redacted in all outputs.' },
    }),
    viz: () => ({ kind: 'note', text: 'Honest scope: this is pattern-based spotting (regex) with spaCy PERSON entities as a name fallback — not a full statistical NER pass over the document. Names, colleges and contact details are excluded from scoring by design.' }),
    code: CODE.ner,
    tech: ['PII is replaced with [redacted] before any excerpt is stored or displayed.'],
  },
  {
    n: 11, name: 'Skill Extraction', group: 2, execKey: 'step3_preprocessing', sub: true, icon: 'Brain',
    tagline: 'Finds skills using the 234-skill taxonomy.',
    purpose: 'Every taxonomy alias becomes a phrase pattern; spaCy’s PhraseMatcher scans the resume and maps each hit to its canonical skill name (“ML” → “machine learning”).',
    inputType: 'Resume text', outputType: 'Canonical skill list',
    io: (d, ctx) => ({
      input: { title: 'Resume text', text: 'Scanned for 234 taxonomy skills and their aliases.' },
      output: { title: 'Skills detected', rows: [['COUNT', fmtInt(d?.skills_count)]] },
    }),
    viz: (d) => ({ kind: 'chips', title: 'Detected skills', items: d?.skills_found || [], empty: 'No recognizable skills detected.' }),
    code: CODE.skills,
    tech: ['Matching is exact-phrase on lowercased text — semantic association is NOT presented as proof of possession.'],
  },
  {
    n: 12, name: 'Experience & Qualification Extraction', group: 2, execKey: 'step3_preprocessing', sub: true, icon: 'Briefcase',
    tagline: 'Parses years, titles and degrees.',
    purpose: 'Date ranges (“Jan 2020 – Mar 2022”) are parsed and summed into years of experience; degree keywords and job titles are pulled from the education and experience sections.',
    inputType: 'Resume text + sections', outputType: 'Experience profile',
    io: (d) => ({
      input: { title: 'Experience section', text: 'Date ranges and role descriptions.' },
      output: { title: 'Extracted profile', rows: [
        ['EXP_YEARS', d?.experience_years ?? '—'],
        ['TITLES', (d?.job_titles || []).join(', ') || '—'],
        ['DEGREES', (d?.degrees || []).join(', ') || '—'],
      ]},
    }),
    viz: (d) => ({ kind: 'chips', title: 'Degrees & titles', items: [...(d?.degrees || []), ...(d?.job_titles || [])], empty: 'None detected.' }),
    code: CODE.experience,
    tech: ['Regex-based and approximate — the backend warns when experience cannot be determined.'],
  },
  // ------------------------------------------------ GROUP 4 — Job Matching
  {
    n: 13, name: 'Job Description Processing', group: 3, execKey: 'step3_preprocessing', sub: true, icon: 'ClipboardList',
    tagline: 'Reads the role the same way it reads resumes.',
    purpose: 'The job description goes through the identical skill extractor, producing the JD skill set that the resume is measured against — plus the recruiter’s required / preferred skill lists.',
    inputType: 'Job description text', outputType: 'JD skill set',
    io: (d, ctx) => ({
      input: { title: 'Job description', rows: [
        ['TITLE', ctx.job?.title || '—'],
        ['REQUIRED', (ctx.job?.requiredSkills || '').split(',').map((s) => s.trim()).filter(Boolean).join(', ') || '—'],
      ]},
      output: { title: 'Detected JD skills', rows: [['COUNT', fmtInt((d?.jd_skills_detected || []).length)]] },
    }),
    viz: (d) => ({ kind: 'chips', title: 'Skills the role asks for', items: d?.jd_skills_detected || [], empty: 'No skills detected in the job description.' }),
    code: CODE.skills,
    tech: ['Same PhraseMatcher and taxonomy as resume skill extraction — symmetric by design.'],
  },
  {
    n: 14, name: 'Text Vectorization', group: 3, execKey: 'step4_vectors', sub: false, icon: 'Network',
    tagline: 'Turns text into numbers.',
    purpose: 'Four MiniLM embeddings capture meaning (full resume, skills section, experience section, job description); a TF-IDF vector pair captures keyword overlap. Numbers are what similarity can be computed on.',
    inputType: 'Resume + JD text', outputType: 'Embedding vectors + TF-IDF matrix',
    io: (d) => ({
      input: { title: 'Texts encoded', rows: [
        ['RESUME', 'first 8,000 chars'],
        ['SKILLS', 'skills section / detected skills'],
        ['EXPERIENCE', 'experience section'],
        ['JOB_DESC', 'first 8,000 chars'],
      ]},
      output: { title: 'Vectors', rows: [
        ['EMBED_MODEL', 'all-MiniLM-L6-v2 (384-dim)'],
        ['TFIDF_MODEL', 'TfidfVectorizer (max 5,000 features)'],
      ]},
    }),
    viz: () => ({ kind: 'tiles', tiles: [
      ['EMBEDDINGS', '4 × 384-dim'],
      ['MODEL', 'all-MiniLM-L6-v2'],
      ['TF-IDF', 'max 5k features'],
    ]}),
    code: CODE.vectors,
    tech: ['Embeddings are computed once per text and reused for all similarity pairs.'],
  },
  {
    n: 15, name: 'Resume–Job Similarity', group: 3, execKey: 'step4_vectors', sub: true, icon: 'GitCompareArrows',
    tagline: 'Measures meaning overlap.',
    purpose: 'Cosine similarity between each resume embedding and the JD embedding: 1.0 = same direction (same meaning), 0.0 = unrelated. This is semantic closeness — never a probability of being hired.',
    inputType: 'Embedding vectors', outputType: 'Similarity scores 0–1',
    io: (d) => ({
      input: { title: 'Vector pairs', text: 'resume↔JD · skills↔JD · experience↔JD' },
      output: { title: 'Cosine scores', rows: [
        ['FULL_TEXT', fmtDec(d?.cosine_full_vs_jd)],
        ['SKILLS', fmtDec(d?.cosine_skills_vs_jd)],
        ['EXPERIENCE', fmtDec(d?.cosine_experience_vs_jd)],
        ['TFIDF_KEYWORDS', fmtDec(d?.tfidf_cosine)],
      ]},
    }),
    viz: (d) => ({ kind: 'bars', bars: [
      ['Full-text meaning', d?.cosine_full_vs_jd],
      ['Skills meaning', d?.cosine_skills_vs_jd],
      ['Experience meaning', d?.cosine_experience_vs_jd],
      ['Keyword overlap (TF-IDF)', d?.tfidf_cosine],
    ]}),
    code: CODE.similarity,
    tech: ['Cosine similarity ignores magnitude — a short resume can match a long JD.'],
  },
  {
    n: 16, name: 'Match Score Calculation', group: 3, execKey: 'step5_matching', sub: false, icon: 'Calculator',
    tagline: 'Combines everything into one score.',
    purpose: 'The final score is a fixed weighted sum: skills 50%, JD similarity 25%, experience 15%, education 10%. The streaming pipeline also shows an internal embedding-based preview — ranking always uses this formula.',
    inputType: 'Component values', outputType: 'Final score 0–100%',
    io: (d, ctx) => {
      const c = ctx.candidate?.components;
      const rows = c ? [
        ['SKILLS ×0.50', `${fmtPct(c.skills.value)} → +${c.skills.points} pts`],
        ['JD_SIM ×0.25', `${fmtPct(c.jd_similarity.value)} → +${c.jd_similarity.points} pts`],
        ['EXP ×0.15', `${fmtPct(c.experience.value)} → +${c.experience.points} pts`],
        ['EDU ×0.10', `${fmtPct(c.education.value)} → +${c.education.points} pts`],
      ] : [['STATUS', 'Score assembles when the run completes']];
      return {
        input: { title: 'Components', rows },
        output: { title: 'Final score', rows: [
          ['SCORE', ctx.candidate ? fmtPct(ctx.candidate.score) : fmtPct(d?.final_score)],
          ['BAND', ctx.candidate?.band || d?.band || '—'],
        ]},
      };
    },
    viz: (d, ctx) => {
      const c = ctx.candidate?.components;
      return { kind: 'bars', bars: c ? [
        [`Skills (50%) — ${c.skills.points} pts`, c.skills.value * 0.5],
        [`JD similarity (25%) — ${c.jd_similarity.points} pts`, c.jd_similarity.value * 0.25],
        [`Experience (15%) — ${c.experience.points} pts`, c.experience.value * 0.15],
        [`Education (10%) — ${c.education.points} pts`, c.education.value * 0.1],
      ] : [['Awaiting final score…', 0]] };
    },
    code: CODE.scoring,
    tech: ['Weights are fixed and disclosed; only the learned ranker may tune the skills component, and it says so when active.'],
  },
  // ------------------------------------------------ GROUP 5 — Final Results
  {
    n: 17, name: 'Candidate Ranking', group: 4, execKey: '__batch__', sub: false, icon: 'Trophy',
    tagline: 'Orders the batch by score.',
    purpose: 'Once every resume in the batch is scored, candidates are ordered highest-score first. Ranking is batch-level — it only exists after the whole batch completes.',
    inputType: 'All candidate scores', outputType: 'Ordered ranking',
    io: (d, ctx) => ({
      input: { title: 'Batch', rows: [['CANDIDATES', fmtInt(ctx.ranking?.length)]] },
      output: { title: 'This candidate', rows: [
        ['RANK', ctx.rank ? `#${ctx.rank} of ${ctx.ranking.length}` : '—'],
        ['SCORE', ctx.candidate ? fmtPct(ctx.candidate.score) : '—'],
      ]},
    }),
    viz: (d, ctx) => ({ kind: 'ranking', ranking: ctx.ranking || [], currentId: ctx.resumeId }),
    code: CODE.ranking,
    tech: ['Ties keep upload order. Ranking never rejects — every candidate stays listed.'],
  },
  {
    n: 18, name: 'Skill Gap Analysis', group: 4, execKey: 'step5_matching', sub: true, icon: 'TriangleAlert',
    tagline: 'Names what the resume didn’t show.',
    purpose: 'Set difference between JD skills and resume skills. “Not detected” means the skill wasn’t found in the text — it is never presented as proof the candidate lacks it.',
    inputType: 'JD skills vs resume skills', outputType: 'Matched / missing lists',
    io: (d) => ({
      input: { title: 'Compared sets', rows: [
        ['JD_SKILLS', fmtInt((d?.jd_skills_detected || []).length)],
        ['OVERLAP', fmtPct(d?.skill_overlap_ratio)],
      ]},
      output: { title: 'Gap', rows: [['MISSING', fmtInt((d?.missing_skills || []).length)]] },
    }),
    viz: (d) => ({ kind: 'gap', matched: d?.matched_skills || [], missing: d?.missing_skills || [] }),
    code: CODE.gap,
    tech: ['Gaps are detection gaps, not capability verdicts — the UI copy enforces this.'],
  },
  {
    n: 19, name: 'Evidence-Based Explanation', group: 4, execKey: 'step6_transparency', sub: false, icon: 'MessageSquareText',
    tagline: 'Shows the reasoning, with receipts.',
    purpose: 'Every score sentence cites extracted evidence only — which skills matched, how similar the JD reads, what experience was found. Warnings flag shaky inputs (no skills section, unparseable dates).',
    inputType: 'Score components + evidence', outputType: 'Explanation sentences + warnings',
    io: (d, ctx) => ({
      input: { title: 'Evidence', rows: [['METHOD', 'weighted SBERT + taxonomy + TF-IDF']] },
      output: { title: 'Explanation', text: (ctx.candidate?.explanation || []).join('\n\n') || 'Assembles when the run completes.' },
    }),
    viz: (d, ctx) => ({ kind: 'list', title: 'Explanation', items: ctx.candidate?.explanation || [], empty: 'Explanation assembles when the run completes.' }),
    code: {
      title: 'Explanation assembly — actual backend code (excerpt)',
      library: 'Python',
      algorithm: 'Each sentence is built from extracted evidence only — no generative text.',
      note: 'Actual implementation from the backend (build_candidate).',
      code:
`explanation.append(
    f"Skills (50% of the score): {len(matched)} of {n_req} "
    f"found — {', '.join(matched) or 'none'}."
    + (f" Not detected: {', '.join(missing)}." if missing else "")
)
explanation.append(f"Job description fit (25%): {jd_sim['note']}")
explanation.append(f"Experience (15%): {exp['note']}")
explanation.append(f"Education (10%): {edu['note']}")`,
    },
    tech: ['Fairness note and limitations are attached to every result — names and colleges are never inputs.'],
  },
  {
    n: 20, name: 'Final Screening Summary', group: 4, execKey: 'step7_result', sub: false, icon: 'Flag',
    tagline: 'The complete candidate record.',
    purpose: 'Assembles everything into the candidate profile: score, band, skills, gaps, experience, warnings. Reviewer feedback can then be recorded to tune future rankings.',
    inputType: 'All stage outputs', outputType: 'Candidate record',
    io: (d, ctx) => ({
      input: { title: 'Assembled from', text: 'Stages 1–19' },
      output: { title: 'Candidate record', rows: [
        ['SCORE', ctx.candidate ? fmtPct(ctx.candidate.score) : fmtPct(d?.score)],
        ['BAND', ctx.candidate?.band || d?.band || '—'],
        ['EXP_YEARS', ctx.candidate?.experience_years ?? d?.experience_years ?? '—'],
        ['WARNINGS', fmtInt((ctx.candidate?.warnings || d?.warnings || []).length)],
      ]},
    }),
    viz: (d, ctx) => ({ kind: 'tiles', tiles: [
      ['SCORE', ctx.candidate ? fmtPct(ctx.candidate.score) : fmtPct(d?.score)],
      ['BAND', ctx.candidate?.band || d?.band || '—'],
      ['STATUS', 'Screened — human review required'],
    ]}),
    code: {
      title: 'Record assembly — actual backend code (excerpt)',
      library: 'Python',
      algorithm: 'The candidate dict bundles score, evidence, gaps and warnings; feedback hooks let reviewers record verdicts.',
      note: 'Actual implementation from the backend.',
      code:
`return {
    "resume_id": resume_id,
    "filename": filename,
    "score": score,            # 0.50/0.25/0.15/0.10 formula
    "band": band,              # Strong / Worth reviewing / Weak
    "components": {...},       # per-component evidence
    "explanation": explanation,
    "matched_skills": matched,
    "missing_skills": missing,
    "warnings": warnings,
}`,
    },
    tech: ['After screening, reviewer verdicts (good_fit / bad_fit) feed the learned ranker.'],
  },
];

function excerpt(chars) {
  if (!chars) return '—';
  return `${fmtInt(chars)} characters recovered from the document.`;
}

export const STAGES_ENRICHED = STAGES.map((s) => ({
  ...s,
  groupName: GROUPS[s.group],
  parentName: s.sub
    ? (STAGES.find((x) => x.execKey === s.execKey && !x.sub)?.name
       || STAGE_LABELS[s.execKey]
       || '')
    : '',
  firstOfExec: STAGES.find((x) => x.execKey === s.execKey)?.n === s.n,
}));

export function stageByKey(execKey) {
  return STAGES.filter((s) => s.execKey === execKey);
}
