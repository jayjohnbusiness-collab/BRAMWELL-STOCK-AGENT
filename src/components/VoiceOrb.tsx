import { useEffect, useRef } from "react";

/*
 * The voice orb — a dark globe wrapped in a dense web of glowing amber
 * filaments and points, like a city seen from orbit. A thousand-odd points are
 * spread over a sphere (a Fibonacci lattice); a subset is linked into a filament
 * mesh, and a handful of "hot spots" cluster the brightness into continents.
 * Everything is drawn additively, so where light crowds — the core, the
 * clusters — the gold builds to white heat. Lightweight Canvas 2D (no WebGL).
 * Intensity is driven by state (idle → listening → thinking → speaking), never
 * a second mic capture, so it can't fight speech recognition. Reduced motion
 * holds it still.
 */

const P = 1750; // surface points (the dense texture)
const STRIDE = 4; // every Nth point joins the filament mesh
const K = 3; // nearest neighbours linked per mesh node
const HOTSPOTS = 11; // bright "continents"

type V3 = [number, number, number];

/** Each node's K nearest neighbours, de-duplicated into undirected edges. */
function buildEdges(nodes: V3[], k: number): Array<[number, number]> {
  const seen = new Set<string>();
  const out: Array<[number, number]> = [];
  for (let i = 0; i < nodes.length; i++) {
    const d: Array<[number, number]> = [];
    for (let j = 0; j < nodes.length; j++) {
      if (i === j) continue;
      const dx = nodes[i][0] - nodes[j][0];
      const dy = nodes[i][1] - nodes[j][1];
      const dz = nodes[i][2] - nodes[j][2];
      d.push([dx * dx + dy * dy + dz * dz, j]);
    }
    d.sort((a, b) => a[0] - b[0]);
    for (let m = 0; m < k; m++) {
      const j = d[m][1];
      const key = i < j ? `${i}-${j}` : `${j}-${i}`;
      if (!seen.has(key)) {
        seen.add(key);
        out.push([i, j]);
      }
    }
  }
  return out;
}

function randUnit(): V3 {
  const u = Math.random() * 2 - 1;
  const th = Math.random() * Math.PI * 2;
  const r = Math.sqrt(1 - u * u);
  return [r * Math.cos(th), u, r * Math.sin(th)];
}

// Warm heat ramp: deep ember → orange → amber → white-gold.
const STOPS: Array<{ h: number; c: V3 }> = [
  { h: 0.0, c: [92, 38, 6] },
  { h: 0.35, c: [201, 92, 20] },
  { h: 0.66, c: [255, 168, 70] },
  { h: 1.0, c: [255, 240, 202] },
];

function heat(h: number): V3 {
  const x = Math.max(0, Math.min(1, h));
  for (let i = 1; i < STOPS.length; i++) {
    if (x <= STOPS[i].h) {
      const a = STOPS[i - 1];
      const b = STOPS[i];
      const f = (x - a.h) / (b.h - a.h || 1);
      return [
        a.c[0] + (b.c[0] - a.c[0]) * f,
        a.c[1] + (b.c[1] - a.c[1]) * f,
        a.c[2] + (b.c[2] - a.c[2]) * f,
      ];
    }
  }
  return STOPS[STOPS.length - 1].c;
}

function rgba(c: V3, a: number): string {
  return `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
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
    const R = 118;

    // Random points read as organic sprawl (a Fibonacci lattice shows a
    // tell-tale spiral); the hot spots below pool them into bright continents.
    const points: V3[] = Array.from({ length: P }, () => randUnit());

    // Bright "continents": each point gets a cluster boost from nearby hot spots
    // (a high power makes them tight), so brightness pools like cities.
    const spots = Array.from({ length: HOTSPOTS }, () => randUnit());
    const spotW = Array.from({ length: HOTSPOTS }, () => 0.5 + Math.random() * 0.9);
    const cluster = points.map(([x, y, z]) => {
      let s = 0;
      for (let k = 0; k < HOTSPOTS; k++) {
        const dot = x * spots[k][0] + y * spots[k][1] + z * spots[k][2];
        if (dot > 0) s += Math.pow(dot, 7) * spotW[k];
      }
      return Math.min(1, s);
    });
    const phase = points.map(() => Math.random() * Math.PI * 2);

    // The filament mesh over a sparser subset.
    const meshIdx: number[] = [];
    for (let i = 0; i < P; i += STRIDE) meshIdx.push(i);
    const meshNodes = meshIdx.map((i) => points[i]);
    const localEdges = buildEdges(meshNodes, K);
    const edges = localEdges.map(([a, b]) => [meshIdx[a], meshIdx[b]] as [number, number]);
    const edgeHot = edges.map(() => (Math.random() < 0.18 ? 1 : 0));
    const edgePhase = edges.map(() => Math.random() * Math.PI * 2);

    // Tangled knot of arcs at the core.
    const knot = Array.from({ length: 16 }, () => ({
      a0: Math.random() * Math.PI * 2,
      len: Math.random() * 1.3 + 0.4,
      rad: Math.random() * R * 0.22 + R * 0.03,
      spin: (Math.random() < 0.5 ? 1 : -1) * (0.2 + Math.random() * 0.5),
      phase: Math.random() * Math.PI * 2,
    }));

    const embers = Array.from({ length: 30 }, () => ({
      orbit: R * (0.92 + Math.random() * 0.45),
      angle: Math.random() * Math.PI * 2,
      speed: (Math.random() < 0.5 ? 1 : -1) * (0.05 + Math.random() * 0.25) * 0.01,
      size: Math.random() * 1.3 + 0.3,
      phase: Math.random() * Math.PI * 2,
      squash: 0.86 + Math.random() * 0.12,
    }));

    let raf = 0;
    let t0 = 0;
    let level = 0.2;
    let rotY = 0.4;
    let rotX = -0.42;

    const proj = new Array(P).fill(null).map(() => ({ x: 0, y: 0, depth: 0, heat: 0, a: 0 }));

    const draw = (ts: number) => {
      if (!t0) t0 = ts;
      const t = (ts - t0) / 1000;
      const { speaking: sp, working: wk, listening: ls } = state.current;

      const target = sp ? 0.95 : ls ? 0.62 : wk ? 0.46 : 0.24;
      level += (target - level) * (sp || ls ? 0.1 : 0.05);
      let lv = level + 0.04 * Math.sin(t * 1.6);
      if (sp) lv += 0.12 * Math.abs(Math.sin(t * 10));
      if (wk) lv += 0.05 * Math.sin(t * 4);
      lv = reduced ? 0.32 : Math.max(0, Math.min(1, lv));

      ctx.clearRect(0, 0, CSS, CSS);
      ctx.globalCompositeOperation = "lighter";

      // Atmosphere at the limb.
      const atmo = ctx.createRadialGradient(cx, cy, R * 0.55, cx, cy, R * 1.2);
      atmo.addColorStop(0, rgba([120, 52, 10], 0));
      atmo.addColorStop(0.74, rgba([150, 66, 14], 0.05 + lv * 0.05));
      atmo.addColorStop(0.9, rgba([255, 150, 56], 0.16 + lv * 0.16));
      atmo.addColorStop(1, rgba([90, 38, 8], 0));
      ctx.fillStyle = atmo;
      ctx.fillRect(0, 0, CSS, CSS);

      // Rotate + project every point.
      if (!reduced) {
        rotY += 0.0022 * (1 + lv * 0.9);
        rotX += 0.0004 * Math.sin(t * 0.2);
      }
      const cosY = Math.cos(rotY);
      const sinY = Math.sin(rotY);
      const cosX = Math.cos(rotX);
      const sinX = Math.sin(rotX);
      const scale = R * (1 + lv * 0.04);
      const fov = 3.4;
      for (let i = 0; i < P; i++) {
        const [x, y, z] = points[i];
        const X = x * cosY - z * sinY;
        const Z0 = x * sinY + z * cosY;
        const Y = y * cosX - Z0 * sinX;
        const Z = y * sinX + Z0 * cosX;
        const pp = fov / (fov - Z);
        const sx = cx + X * scale * pp;
        const sy = cy + Y * scale * pp;
        const depth = (Z + 1) / 2;
        const rc = Math.hypot(sx - cx, sy - cy) / R;
        const cl = cluster[i];
        const flick = 0.85 + 0.15 * Math.sin(t * 3 + phase[i]);
        const h =
          (0.24 + depth * 0.36 + (1 - Math.min(1, rc)) * 0.22 + cl * 0.5) *
          (0.72 + lv * 0.4) *
          flick;
        const a = (0.06 + depth * 0.34 + cl * 0.5) * (0.55 + lv * 0.5);
        proj[i] = { x: sx, y: sy, depth, heat: h, a };
      }

      // Dense surface points.
      for (let i = 0; i < P; i++) {
        const p = proj[i];
        if (p.a < 0.02) continue;
        ctx.fillStyle = rgba(heat(p.heat), Math.min(0.85, p.a));
        const sz = 0.35 + p.depth * 0.55 + cluster[i] * 0.9;
        ctx.beginPath();
        ctx.arc(p.x, p.y, sz, 0, Math.PI * 2);
        ctx.fill();
      }

      // Filaments (the mesh).
      for (let e = 0; e < edges.length; e++) {
        const pa = proj[edges[e][0]];
        const pb = proj[edges[e][1]];
        const md = (pa.depth + pb.depth) / 2;
        const mh = (pa.heat + pb.heat) / 2;
        const hot = edgeHot[e];
        const flick = 0.7 + 0.3 * Math.sin(t * 2.4 + edgePhase[e]);
        const alpha = (0.06 + md * 0.14 + hot * 0.16) * (0.55 + lv * 0.55) * flick;
        if (alpha < 0.012) continue;
        ctx.strokeStyle = rgba(heat(mh + hot * 0.15), Math.min(0.6, alpha));
        ctx.lineWidth = hot ? 1.1 : 0.55;
        ctx.beginPath();
        ctx.moveTo(pa.x, pa.y);
        ctx.lineTo(pb.x, pb.y);
        ctx.stroke();
      }

      // Drifting embers.
      for (const em of embers) {
        if (!reduced) em.angle += em.speed * (1 + lv * 0.8);
        const ex = cx + Math.cos(em.angle) * em.orbit;
        const ey = cy + Math.sin(em.angle) * em.orbit * em.squash;
        const tw = 0.5 + 0.5 * Math.sin(t * 2 + em.phase);
        ctx.fillStyle = rgba([255, 190, 96], Math.min(0.7, (0.1 + tw * 0.35) * (0.5 + lv * 0.6)));
        ctx.beginPath();
        ctx.arc(ex, ey, em.size * (0.7 + tw * 0.6), 0, Math.PI * 2);
        ctx.fill();
      }

      // Hot tangled core + a horizontal flare streak.
      for (const s of knot) {
        const spin = reduced ? 0 : t * s.spin;
        const a0 = s.a0 + spin;
        const rad = s.rad * (1 + lv * 0.3);
        const wob = 0.6 + 0.4 * Math.sin(t * 3 + s.phase);
        ctx.strokeStyle = rgba([255, 234, 194], Math.min(0.85, (0.14 + lv * 0.5) * wob));
        ctx.lineWidth = 1.1 + lv * 1.2;
        ctx.beginPath();
        ctx.arc(cx, cy, rad, a0, a0 + s.len);
        ctx.stroke();
      }
      const streakW = R * (0.7 + lv * 0.5);
      const streak = ctx.createLinearGradient(cx - streakW, cy, cx + streakW, cy);
      streak.addColorStop(0, rgba([255, 190, 90], 0));
      streak.addColorStop(0.5, rgba([255, 240, 205], 0.18 + lv * 0.3));
      streak.addColorStop(1, rgba([255, 190, 90], 0));
      ctx.fillStyle = streak;
      ctx.fillRect(cx - streakW, cy - (1.4 + lv * 2.2), streakW * 2, (1.4 + lv * 2.2) * 2);

      // Core bloom.
      const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * (0.3 + lv * 0.28));
      core.addColorStop(0, rgba([255, 246, 218], 0.5 + lv * 0.4));
      core.addColorStop(0.35, rgba([255, 170, 66], 0.22 + lv * 0.28));
      core.addColorStop(1, rgba([120, 50, 10], 0));
      ctx.fillStyle = core;
      ctx.fillRect(0, 0, CSS, CSS);

      ctx.globalCompositeOperation = "source-over";
      if (!reduced) raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    if (reduced) draw(0);
    return () => cancelAnimationFrame(raf);
  }, []);

  return <canvas ref={canvasRef} className="voice-orb-canvas" aria-hidden="true" />;
}
