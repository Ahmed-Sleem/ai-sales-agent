"use client";
/**
 * WHY: Unified night-sky background for the WHOLE app (behind every glass panel).
 * Adapted from Ahmed's open-svg-galary (src/shaders.js dustVertex): the same
 * twinkle idea — `0.55 + 0.45 * sin(uTime * (0.4 + seed) + seed * 40)` — re-expressed
 * on a 2D canvas, plus per-star shine cycles: every star stays dim, then shines
 * brightly for a moment at a random period between 1s and 10s (user requirement).
 * One canvas, one rAF loop, pauses when the tab is hidden.
 */
import React, { useEffect, useRef } from "react";

interface Star { x: number; y: number; r: number; seed: number; period: number; phase: number; shineDur: number; }

export const NightSky: React.FC = () => {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    let raf = 0, stars: Star[] = [];
    const build = () => {
      canvas.width = Math.min(window.innerWidth, 2560); canvas.height = window.innerHeight;
      const count = Math.round((canvas.width * canvas.height) / 18000); // sparse, subtle stars over near-black
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * canvas.width, y: Math.random() * canvas.height,
        r: .3 + Math.random() * .65, seed: Math.random(),
        period: 1 + Math.random() * 9,            // 1–10s shine cycle
        phase: Math.random(), shineDur: .12 + Math.random() * .18,
      }));
    };
    build(); window.addEventListener("resize", build);
    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      if (document.hidden) return;
      const t = now / 1000;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const s of stars) {
        // base twinkle (dust shader formula, adapted)
        const twinkle = .55 + .45 * Math.sin(t * (.4 + s.seed) + s.seed * 40);
        // random shine: brief bright peak once per period
        const cyc = ((t / s.period) + s.phase) % 1;
        const shine = cyc < s.shineDur ? Math.sin((cyc / s.shineDur) * Math.PI) : 0;
        const a = Math.min(.42, .025 + twinkle * .09 + shine * .30);
        const r = s.r * (1 + shine * 1.6);
        ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(226,236,255,${a.toFixed(3)})`; ctx.fill();
        if (shine > .55) { // tiny cross glint at peak
          ctx.strokeStyle = `rgba(226,236,255,${((shine - .55) * .32).toFixed(3)})`; ctx.lineWidth = .5;
          const g = r * 4; ctx.beginPath();
          ctx.moveTo(s.x - g, s.y); ctx.lineTo(s.x + g, s.y);
          ctx.moveTo(s.x, s.y - g); ctx.lineTo(s.x, s.y + g); ctx.stroke();
        }
      }
    };
    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", build); };
  }, []);
  return <canvas ref={ref} aria-hidden="true" style={{ position: "fixed", inset: 0, width: "100vw", height: "100vh", zIndex: 0, pointerEvents: "none", background: "radial-gradient(1200px 800px at 60% 30%, #05070b 0%, #020305 58%, #010102 100%)" }} />;
};
