import { useEffect, useRef } from "react";
import "../styles/voice.css";

/*
 * The voice orb — "Contour": Bramwell's presence rendered in the Correlation
 * Surface's own language. A rough, organic sphere built from a lattice of
 * luminous points (latitude/longitude rings) whose radius is displaced by 3-D
 * noise, so it reads as a topographic orb of dust rather than a hard ball.
 * Monochrome white points with cold-cyan highlights on the raised ridges, drawn
 * additively over a soft cyan core glow. It rotates slowly and "breathes":
 * swelling and brightening with a speech-like rhythm when Bramwell speaks, and
 * settling to a slow calm breath when idle / listening / thinking. Intensity is
 * driven by state, never a second mic capture, so it can't fight speech
 * recognition. Lightweight Canvas 2D (no WebGL). Reduced motion holds it still.
 */

const TAU = Math.PI * 2;
const ROWS = 50; // latitude bands
const COLS = 78; // longitude density at the equator
const ACCENT = "180,224,255"; // cold cyan — the surface's ridge highlight
const WHITE = "234,240,247";

type V3 = [number, number, number];

/** A cheap 3-D value noise: the sum of a handful of directional sines. */
function makeNoise(): (x: number, y: number, z: number, tMs: number) => number {
  const dirs = Array.from({ length: 6 }, (_, i) => {
    const th = Math.random() * TAU;
    const ph = Math.acos(Math.random() * 2 - 1);
    return {
      x: Math.sin(ph) * Math.cos(th),
      y: Math.sin(ph) * Math.sin(th),
      z: Math.cos(ph),
      f: 1.3 + i * 0.9,
      a: 1 / (1 + i * 0.8),
      p: Math.random() * TAU,
      sp: 0.0004 + Math.random() * 0.0009,
    };
  });
  const norm = dirs.reduce((s, d) => s + d.a, 0);
  return (x, y, z, tMs) => {
    let v = 0;
    for (const d of dirs) v += d.a * Math.sin((x * d.x + y * d.y + z * d.z) * d.f + d.p + tMs * d.sp);
    return v / norm; // ~[-1, 1]
  };
}

export function VoiceOrb({
  speaking,
  working,
  listening,
}: {
  speaking: boolean;
  working: boolean;
  listening: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const state = useRef({ speaking, working, listening });
  state.current = { speaking, working, listening };

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

    const CSS = 360;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = CSS * dpr;
    canvas.height = CSS * dpr;
    ctx.scale(dpr, dpr);

    const cx = CSS / 2;
    const cy = CSS / 2;
    // Sized (with a gentle camera distance) so the displaced sphere clears the
    // frame with margin at every rotation — the orb must never clip.
    const R = CSS * 0.3;
    const persp = R * 4;

    const noise = makeNoise();

    // The point lattice — latitude bands, each a ring of longitude points, with
    // density tapering toward the poles so the spacing stays even.
    const pts: V3[] = [];
    for (let a = 0; a < ROWS; a++) {
      const phi = -Math.PI / 2 + Math.PI * (a / (ROWS - 1));
      const cols = Math.max(6, Math.round(Math.cos(phi) * COLS));
      for (let b = 0; b < cols; b++) {
        const th = (b / cols) * TAU;
        pts.push([Math.cos(phi) * Math.cos(th), Math.sin(phi), Math.cos(phi) * Math.sin(th)]);
      }
    }
    const N = pts.length;

    let raf = 0;
    let t0 = 0;
    let level = 0.24;

    const draw = (ts: number) => {
      if (!t0) t0 = ts;
      const tm = ts - t0;
      const t = tm / 1000;
      const { speaking: sp, working: wk, listening: ls } = state.current;

      // Overall energy — eases between states; drives brightness, rotation, glow.
      const target = sp ? 0.95 : ls ? 0.62 : wk ? 0.46 : 0.24;
      level += (target - level) * (sp || ls ? 0.1 : 0.05);
      const lv = reduced ? 0.34 : Math.max(0, Math.min(1, level + 0.03 * Math.sin(t * 1.5)));

      // The breath — how much the sphere swells / roughens this frame. A lively
      // speech envelope when speaking; a slow calm breath otherwise.
      const slow = 0.5 + 0.5 * Math.sin(t * 1.3);
      const speech = 0.5 + 0.5 * Math.abs(Math.sin(t * 7.5)) * (0.6 + 0.4 * Math.sin(t * 4.3 + 1));
      let grow: number;
      if (sp) grow = speech;
      else if (ls) grow = 0.32 + 0.34 * slow;
      else if (wk) grow = 0.24 + 0.2 * (0.5 + 0.5 * Math.sin(t * 3));
      else grow = slow * 0.4;
      if (reduced) grow = 0.34;

      const wob = 0.12 + grow * 0.16; // surface displacement
      const breath = 1 + (grow - 0.4) * 0.14; // whole-orb swell
      const yaw = reduced ? 0.6 : t * (0.22 + lv * 0.12);
      const pitch = 0.42;
      const cY = Math.cos(yaw), sY = Math.sin(yaw), cP = Math.cos(pitch), sP = Math.sin(pitch);

      ctx.clearRect(0, 0, CSS, CSS);

      // A soft dark disc grounds the orb, so the luminous dust reads on any
      // background (the light landing as well as the dark voice overlay) — the
      // same dark field the Correlation Surface sits on. Fades out at the rim.
      ctx.globalCompositeOperation = "source-over";
      const bgR = R * 1.5;
      const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, bgR);
      bg.addColorStop(0, "rgba(5,8,13,0.96)");
      bg.addColorStop(0.62, "rgba(5,8,13,0.9)");
      bg.addColorStop(0.86, "rgba(5,8,13,0.45)");
      bg.addColorStop(1, "rgba(5,8,13,0)");
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.arc(cx, cy, bgR, 0, TAU);
      ctx.fill();

      // Soft cyan core glow behind the cloud — brightens with energy.
      ctx.globalCompositeOperation = "lighter";
      const glowR = R * (0.72 + grow * 0.3);
      const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowR);
      cg.addColorStop(0, `rgba(111,209,255,${0.1 + lv * 0.16})`);
      cg.addColorStop(1, "rgba(111,209,255,0)");
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.arc(cx, cy, glowR, 0, TAU);
      ctx.fill();

      // The point lattice.
      for (let i = 0; i < N; i++) {
        const p = pts[i];
        const nz = noise(p[0] + tm * 0.00002, p[1], p[2], tm);
        const rr = 1 + wob * nz;
        const X = p[0] * rr * R * breath;
        const Y = p[1] * rr * R * breath;
        const Z = p[2] * rr * R * breath;
        const X1 = X * cY - Z * sY;
        const Z1 = X * sY + Z * cY;
        const Y1 = Y * cP - Z1 * sP;
        const Z2 = Y * sP + Z1 * cP;
        const pp = persp / (persp + Z2);
        const sx = cx + X1 * pp;
        const sy = cy + Y1 * pp;
        const depth = (Z2 / R + 1.4) / 2.8; // 0 back → 1 front
        const ridge = Math.max(0, nz);
        let inten = (0.24 + ridge * ridge * 0.95) * (0.5 + depth * 0.78);
        inten *= 0.86 + lv * 0.42;
        if (inten <= 0.02) continue;
        const sz = (1.1 + ridge * 0.9) * (0.9 + depth * 0.5);
        ctx.fillStyle =
          inten > 0.62
            ? `rgba(${ACCENT},${Math.min(1, inten)})`
            : `rgba(${WHITE},${Math.min(0.9, inten)})`;
        ctx.fillRect(sx, sy, sz, sz);
      }

      ctx.globalCompositeOperation = "source-over";
      if (!reduced) raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    if (reduced) draw(0);
    return () => cancelAnimationFrame(raf);
  }, []);

  return <canvas ref={canvasRef} className="voice-orb-canvas" aria-hidden="true" />;
}
