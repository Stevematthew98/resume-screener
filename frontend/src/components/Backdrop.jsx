import { useEffect, useRef } from 'react';

// Interactive technology backdrop: a faint particle network (nodes + links)
// that drifts slowly and reacts gently to the cursor. Pure decoration —
// pointer-events are disabled and it pauses when the tab is hidden.
// Disabled entirely when the user prefers reduced motion.
const DOT_COLORS = ['83,109,254', '139,124,255', '83,109,254', '22,165,121'];
const LINK_DIST = 130;
const MOUSE_DIST = 180;

export default function Backdrop() {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let w = 0;
    let h = 0;
    let pts = [];
    const mouse = { x: -9999, y: -9999 };

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.max(28, Math.min(90, Math.floor((w * h) / 22000)));
      pts = Array.from({ length: n }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        r: 1.3 + Math.random() * 1.6,
        c: DOT_COLORS[(Math.random() * DOT_COLORS.length) | 0],
      }));
    }

    function step() {
      ctx.clearRect(0, 0, w, h);

      for (const p of pts) {
        // Gentle repulsion around the cursor
        const dx = p.x - mouse.x;
        const dy = p.y - mouse.y;
        const md2 = dx * dx + dy * dy;
        if (md2 < MOUSE_DIST * MOUSE_DIST && md2 > 4) {
          const md = Math.sqrt(md2);
          const f = ((1 - md / MOUSE_DIST) * 0.05);
          p.vx += (dx / md) * f;
          p.vy += (dy / md) * f;
        }
        // Cap speed so drift stays calm
        const sp = Math.hypot(p.vx, p.vy);
        if (sp > 0.7) {
          p.vx = (p.vx / sp) * 0.7;
          p.vy = (p.vy / sp) * 0.7;
        }
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < -24) p.x = w + 24;
        else if (p.x > w + 24) p.x = -24;
        if (p.y < -24) p.y = h + 24;
        else if (p.y > h + 24) p.y = -24;
      }

      ctx.lineWidth = 1;
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i];
        for (let j = i + 1; j < pts.length; j++) {
          const b = pts[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < LINK_DIST * LINK_DIST) {
            const alpha = ((1 - Math.sqrt(d2) / LINK_DIST) * 0.14).toFixed(3);
            ctx.strokeStyle = `rgba(83,109,254,${alpha})`;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
        // Faint tether from cursor to nearby nodes
        const mdx = a.x - mouse.x;
        const mdy = a.y - mouse.y;
        const md2 = mdx * mdx + mdy * mdy;
        if (md2 < MOUSE_DIST * MOUSE_DIST) {
          const alpha = ((1 - Math.sqrt(md2) / MOUSE_DIST) * 0.2).toFixed(3);
          ctx.strokeStyle = `rgba(83,109,254,${alpha})`;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(mouse.x, mouse.y);
          ctx.stroke();
        }
      }

      for (const p of pts) {
        ctx.fillStyle = `rgba(${p.c},0.38)`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, 6.2832);
        ctx.fill();
      }

      raf = requestAnimationFrame(step);
    }

    function onMove(e) {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    }
    function onLeave() {
      mouse.x = -9999;
      mouse.y = -9999;
    }
    function onVis() {
      if (document.hidden) {
        cancelAnimationFrame(raf);
        raf = 0;
      } else if (!raf) {
        raf = requestAnimationFrame(step);
      }
    }

    resize();
    raf = requestAnimationFrame(step);
    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', onMove, { passive: true });
    document.documentElement.addEventListener('pointerleave', onLeave);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onMove);
      document.documentElement.removeEventListener('pointerleave', onLeave);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  return <canvas ref={ref} className="backdrop-canvas" aria-hidden="true" />;
}
