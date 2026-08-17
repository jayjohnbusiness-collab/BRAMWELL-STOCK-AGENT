import { useEffect, useRef } from "react";
import "../styles/voice.css";

/*
 * The voice orb — "Eclipse": a dark core ringed by a blazing white-gold corona,
 * held inside a slow brass orrery of tilted orbital rings, each with a bead that
 * trails a short comet-tail. A drifting ember field surrounds it and a rim flare
 * cuts across the middle. The orbits and embers keep their steady sweep; the
 * CORE is what comes alive — it "breathes", swelling and contracting with a
 * speech-like rhythm when Bramwell speaks and settling to a slow, calm breath
 * otherwise. Lightweight Canvas 2D (no WebGL), drawn additively. Intensity is
 * driven by state (idle → listening → thinking → speaking), never a second mic
 * capture, so it can't fight speech recognition. Reduced motion holds it still.
 */

const TAU = Math.PI * 2;
const RN = 7; // orbital rings
const EMBERS = 46; // ember/debris field
const RING_COL = "236,224,196"; // cool white-gold

type V3 = [number, number, number];

function rnd(a: number, b: number): number {
  return a + Math.random() * (b - a);
}

/** Two orthonormal vectors spanning the plane whose normal is (ax,ay,az). */
function orthoBasis(ax: number, ay: number, az: number): { u: V3; v: V3 } {
  const L = Math.hypot(ax, ay, az) || 1;
  ax /= L;
  ay /= L;
  az /= L;
  const hx = Math.abs(ax) < 0.9 ? 1 : 0;
  const hy = Math.abs(ax) < 0.9 ? 0 : 1;
  let ux = -az * hy;
  let uy = az * hx;
  let uz = ax * hy - ay * hx;
  const ul = Math.hypot(ux, uy, uz) || 1;
  ux /= ul;
  uy /= ul;
  uz /= ul;
  const vx = ay * uz - az * uy;
  const vy = az * ux - ax * uz;
  const vz = ax * uy - ay * ux;
  return { u: [ux, uy, uz], v: [vx, vy, vz] };
}

/** Rotate a unit vector by (ay around Y, ax around X) and project to screen. */
function project(
  x: number,
  y: number,
  z: number,
  ay: number,
  ax: number,
  cx: number,
  cy: number,
  R: number,
): { x: number; y: number; z: number; pp: number } {
  const cY = Math.cos(ay);
  const sY = Math.sin(ay);
  const cX = Math.cos(ax);
  const sX = Math.sin(ax);
  const X = x * cY - z * sY;
  const Z0 = x * sY + z * cY;
  const Y = y * cX - Z0 * sX;
  const Z = y * sX + Z0 * cX;
  const fov = 3.3;
  const pp = fov / (fov - Z);
  return { x: cx + X * R * pp, y: cy + Y * R * pp, z: Z, pp };
}

function ptOnRing(u: V3, v: V3, th: number, rad: number): V3 {
  const c = Math.cos(th);
  const s = Math.sin(th);
  return [(u[0] * c + v[0] * s) * rad, (u[1] * c + v[1] * s) * rad, (u[2] * c + v[2] * s) * rad];
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
    const R = CSS * 0.31;

    // Tilted orbital rings, each with a travelling bead.
    const rings = Array.from({ length: RN }, (_, i) => ({
      b: orthoBasis(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)),
      rad: 1.0 + i * 0.1 + rnd(-0.03, 0.03),
      spin: rnd(0.16, 0.5) * (Math.random() < 0.5 ? 1 : -1),
      bead: Math.random() * TAU,
      beadSp: rnd(0.5, 1.15) * (Math.random() < 0.5 ? 1 : -1),
    }));

    // Ember/debris field orbiting the core.
    const embers = Array.from({ length: EMBERS }, () => ({
      a: rnd(0, TAU),
      orbit: rnd(1.0, 1.5),
      sp: rnd(0.05, 0.28) * (Math.random() < 0.5 ? 1 : -1),
      sz: rnd(0.3, 1.4),
      ph: rnd(0, TAU),
      sq: rnd(0.4, 0.7),
    }));

    let raf = 0;
    let t0 = 0;
    let level = 0.24;

    const draw = (ts: number) => {
      if (!t0) t0 = ts;
      const t = (ts - t0) / 1000;
      const { speaking: sp, working: wk, listening: ls } = state.current;

      // Overall energy — eases between states; drives corona brightness, ring
      // speed, flare. The orbits stay largely steady; this is a gentle influence.
      const target = sp ? 0.95 : ls ? 0.62 : wk ? 0.46 : 0.24;
      level += (target - level) * (sp || ls ? 0.1 : 0.05);
      const lv = reduced ? 0.34 : Math.max(0, Math.min(1, level + 0.03 * Math.sin(t * 1.5)));

      // The breath — how much the core swells this frame. A lively speech
      // envelope when speaking; a slow, calm breath when idle/listening/thinking.
      const slow = 0.5 + 0.5 * Math.sin(t * 1.3);
      const speech = 0.5 + 0.5 * Math.abs(Math.sin(t * 7.5)) * (0.6 + 0.4 * Math.sin(t * 4.3 + 1));
      let grow: number;
      if (sp) grow = speech;
      else if (ls) grow = 0.32 + 0.34 * slow;
      else if (wk) grow = 0.24 + 0.2 * (0.5 + 0.5 * Math.sin(t * 3));
      else grow = slow * 0.4;
      if (reduced) grow = 0.32;

      ctx.clearRect(0, 0, CSS, CSS);
      ctx.globalCompositeOperation = "lighter";
      const ay = t * (0.18 + lv * 0.12);
      const ax = -0.5 + 0.06 * Math.sin(t * 0.2);
      const pulse = 0.5 + 0.5 * Math.sin(t * (1.4 + lv));

      // Blazing corona — breathes outward with the core.
      const outer = R * (0.6 + grow * 0.3);
      const cr = ctx.createRadialGradient(cx, cy, R * 0.14, cx, cy, outer);
      cr.addColorStop(0, "rgba(10,8,6,0)");
      cr.addColorStop(0.32, "rgba(20,14,8,0)");
      cr.addColorStop(0.5, `rgba(255,238,205,${0.5 + lv * 0.4})`);
      cr.addColorStop(0.62, "rgba(255,168,70,0.3)");
      cr.addColorStop(1, "rgba(120,50,10,0)");
      ctx.fillStyle = cr;
      ctx.beginPath();
      ctx.arc(cx, cy, outer, 0, TAU);
      ctx.fill();

      // Dark occluding disk — the eclipsed core, swelling and contracting.
      const coreR = R * (0.34 + grow * 0.16);
      ctx.globalCompositeOperation = "source-over";
      const dk = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR);
      dk.addColorStop(0, "#0a0806");
      dk.addColorStop(0.72, "#0a0806");
      dk.addColorStop(1, "rgba(10,8,6,0)");
      ctx.fillStyle = dk;
      ctx.beginPath();
      ctx.arc(cx, cy, coreR, 0, TAU);
      ctx.fill();
      ctx.globalCompositeOperation = "lighter";

      // Ember/debris field.
      for (const eo of embers) {
        if (!reduced) eo.a += eo.sp * 0.01 * (1 + lv * 0.6);
        const ex = cx + Math.cos(eo.a) * R * eo.orbit;
        const ey = cy + Math.sin(eo.a) * R * eo.orbit * eo.sq;
        const tw = 0.5 + 0.5 * Math.sin(t * 2 + eo.ph);
        ctx.fillStyle = `rgba(255,230,180,${0.08 + tw * 0.3 * (0.6 + lv * 0.5)})`;
        ctx.beginPath();
        ctx.arc(ex, ey, eo.sz * (0.6 + tw * 0.7), 0, TAU);
        ctx.fill();
      }

      // Orbital rings + trailing beads.
      const STEP = 96;
      for (const rg of rings) {
        const u = rg.b.u;
        const v = rg.b.v;
        const phase = t * rg.spin * (0.7 + lv * 0.6);
        const pts = [];
        for (let k = 0; k <= STEP; k++) {
          const th = (k / STEP) * TAU + phase;
          const p3 = ptOnRing(u, v, th, rg.rad);
          pts.push(project(p3[0], p3[1], p3[2], ay, ax, cx, cy, R));
        }
        for (let k2 = 0; k2 < STEP; k2++) {
          const p = pts[k2];
          const q = pts[k2 + 1];
          const f = ((p.z + q.z) / 2 + 1) / 2;
          ctx.strokeStyle = `rgba(${RING_COL},${0.045 + f * f * (0.5 + lv * 0.2)})`;
          ctx.lineWidth = (0.4 + f * 1.5) * p.pp;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(q.x, q.y);
          ctx.stroke();
        }
        // bead with a short comet-trail
        if (!reduced) rg.bead += rg.beadSp * 0.02 * (0.7 + lv * 0.7);
        for (let tr = 0; tr < 7; tr++) {
          const bt = rg.bead - tr * 0.05;
          const pb = ptOnRing(u, v, bt + phase, rg.rad);
          const bp = project(pb[0], pb[1], pb[2], ay, ax, cx, cy, R);
          const bf = (bp.z + 1) / 2;
          const a = (1 - tr / 7) * (0.28 + bf * 0.6);
          ctx.fillStyle = `rgba(255,244,210,${a})`;
          ctx.beginPath();
          ctx.arc(bp.x, bp.y, (0.7 + bf * 1.8) * bp.pp * (1 - tr * 0.08), 0, TAU);
          ctx.fill();
          if (tr === 0) {
            ctx.fillStyle = `rgba(255,200,110,${0.16 + bf * 0.24})`;
            ctx.beginPath();
            ctx.arc(bp.x, bp.y, (3 + bf * 4.5) * bp.pp, 0, TAU);
            ctx.fill();
          }
        }
      }

      // Rim flare streak across the middle.
      const sw = R * (0.9 + pulse * 0.35 + lv * 0.2);
      const streak = ctx.createLinearGradient(cx - sw, cy, cx + sw, cy);
      streak.addColorStop(0, "rgba(255,190,90,0)");
      streak.addColorStop(0.5, `rgba(255,236,200,${0.12 + lv * 0.24})`);
      streak.addColorStop(1, "rgba(255,190,90,0)");
      ctx.fillStyle = streak;
      const hh = 1.2 + pulse * 1.6 + lv * 1.4;
      ctx.fillRect(cx - sw, cy - hh, sw * 2, hh * 2);

      ctx.globalCompositeOperation = "source-over";
      if (!reduced) raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    if (reduced) draw(0);
    return () => cancelAnimationFrame(raf);
  }, []);

  return <canvas ref={canvasRef} className="voice-orb-canvas" aria-hidden="true" />;
}
