import { useEffect, useRef } from "react";

/*
 * The voice orb — a rotating wireframe icosahedron in a fresnel-style glow,
 * ringed by an orbiting particle field and concentric pulses that swell with
 * the voice. Design adapted from the openclaw-jarvis-ui orb (ISC), itself after
 * Filip Zrnzevic's Three.js Orb concept — rebuilt here in lightweight Canvas 2D
 * (no WebGL dependency) and themed from Bramwell's accent, so it fits the app
 * and both light/dark. Intensity is driven by state (idle → listening →
 * thinking → speaking), never a second mic capture, so it can't fight speech
 * recognition. Reduced motion holds it still.
 */

const PHI = (1 + Math.sqrt(5)) / 2;

// The 12 vertices of an icosahedron (edge length 2).
const VERTS: Array<[number, number, number]> = [
  [-1, PHI, 0], [1, PHI, 0], [-1, -PHI, 0], [1, -PHI, 0],
  [0, -1, PHI], [0, 1, PHI], [0, -1, -PHI], [0, 1, -PHI],
  [PHI, 0, -1], [PHI, 0, 1], [-PHI, 0, -1], [-PHI, 0, 1],
];

// Its 30 edges: every vertex pair exactly one edge-length apart.
const EDGES: Array<[number, number]> = (() => {
  const out: Array<[number, number]> = [];
  for (let i = 0; i < VERTS.length; i++) {
    for (let j = i + 1; j < VERTS.length; j++) {
      const dx = VERTS[i][0] - VERTS[j][0];
      const dy = VERTS[i][1] - VERTS[j][1];
      const dz = VERTS[i][2] - VERTS[j][2];
      if (Math.abs(Math.hypot(dx, dy, dz) - 2) < 0.1) out.push([i, j]);
    }
  }
  return out;
})();

function accentRGB(): { r: number; g: number; b: number } {
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue("--brass").trim();
    const m = v.match(/^#?([0-9a-f]{6})$/i);
    if (m) {
      const n = parseInt(m[1], 16);
      return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
    }
  } catch {
    /* fall through to default */
  }
  return { r: 0x4a, g: 0x97, b: 0xe0 };
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
  // Read live state each frame without restarting the loop.
  const state = useRef({ speaking, working, listening });
  state.current = { speaking, working, listening };

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

    // The canvas is comfortably larger than the orb so the glow and the
    // particle field fade out well before the edge — no square clipping.
    const CSS = 360;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = CSS * dpr;
    canvas.height = CSS * dpr;
    ctx.scale(dpr, dpr);

    const cx = CSS / 2;
    const cy = CSS / 2;
    const R = 82; // core radius (leaves margin inside the 360px box)
    const c = accentRGB();
    const rgb = (a: number) => `rgba(${c.r},${c.g},${c.b},${a})`;

    // The orbiting particle field — dense, kept within the canvas.
    const parts = Array.from({ length: 260 }, () => ({
      orbit: R * 1.0 + Math.random() * R * 0.95,
      angle: Math.random() * Math.PI * 2,
      speed: (Math.random() * 0.4 + 0.1) * (Math.random() < 0.5 ? 1 : -1) * 0.01,
      amp: Math.random() * 6 + 2,
      phase: Math.random() * Math.PI * 2,
      size: Math.random() * 1.4 + 0.4,
      base: Math.random() * 0.4 + 0.12,
    }));

    let raf = 0;
    let t0 = 0;
    let level = 0.15;
    let rotY = 0;
    let rotX = 0.5;

    const draw = (ts: number) => {
      if (!t0) t0 = ts;
      const t = (ts - t0) / 1000;
      const { speaking: sp, working: wk, listening: ls } = state.current;

      // Ease toward the state's target intensity, then add life.
      const target = sp ? 0.92 : ls ? 0.55 : wk ? 0.42 : 0.16;
      level += (target - level) * (sp || ls ? 0.1 : 0.05);
      let lv = level + 0.05 * Math.sin(t * 2);
      if (sp) lv += 0.14 * Math.abs(Math.sin(t * 11));
      lv = reduced ? 0.2 : Math.max(0, Math.min(1, lv));

      ctx.clearRect(0, 0, CSS, CSS);

      // Atmospheric glow (additive).
      ctx.globalCompositeOperation = "lighter";
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * (1.45 + lv * 0.5));
      glow.addColorStop(0, rgb(0.3 + lv * 0.25));
      glow.addColorStop(0.5, rgb(0.09 + lv * 0.1));
      glow.addColorStop(1, rgb(0));
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, CSS, CSS);

      // Orbiting particles.
      for (const p of parts) {
        if (!reduced) p.angle += p.speed * (1 + lv);
        const x = cx + Math.cos(p.angle) * p.orbit + Math.sin(t * 0.8 + p.phase) * p.amp;
        const y = cy + Math.sin(p.angle) * p.orbit * 0.92 + Math.cos(t * 0.7 + p.phase) * p.amp;
        const pulse = 1 + Math.sin(t * 2 + p.phase) * 0.4;
        ctx.beginPath();
        ctx.arc(x, y, p.size * pulse, 0, Math.PI * 2);
        ctx.fillStyle = rgb(Math.min(0.75, p.base + lv * 0.25));
        ctx.fill();
      }

      // Concentric rings — two steady, one that swells with the voice.
      ctx.globalCompositeOperation = "source-over";
      [1.12, 1.42, 1.2 + lv * 0.6].forEach((mult, i) => {
        ctx.beginPath();
        ctx.arc(cx, cy, R * mult, 0, Math.PI * 2);
        ctx.lineWidth = i === 2 ? 1.5 : 1;
        ctx.strokeStyle = rgb(i === 2 ? 0.22 + lv * 0.4 : 0.1 + 0.05 * Math.sin(t * 1.5 + i));
        ctx.stroke();
      });

      // Rotating wireframe icosahedron.
      if (!reduced) {
        rotY += 0.006 * (1 + lv * 1.2);
        rotX += 0.0015;
      }
      const scale = R * 0.62 * (1 + lv * 0.14);
      const fov = 4.2;
      const cosY = Math.cos(rotY);
      const sinY = Math.sin(rotY);
      const cosX = Math.cos(rotX);
      const sinX = Math.sin(rotX);
      const proj = VERTS.map(([x, y, z]) => {
        const X = x * cosY - z * sinY;
        const Z0 = x * sinY + z * cosY;
        const Y = y * cosX - Z0 * sinX;
        const Z = y * sinX + Z0 * cosX;
        const p = fov / (fov - Z * 0.5);
        return { x: cx + X * scale * p, y: cy + Y * scale * p, z: Z };
      });
      for (const [a, b] of EDGES) {
        const pa = proj[a];
        const pb = proj[b];
        const alpha = (0.25 + ((pa.z + pb.z) / 2 + 2) / 4 * 0.55) * (0.7 + lv * 0.3);
        ctx.beginPath();
        ctx.moveTo(pa.x, pa.y);
        ctx.lineTo(pb.x, pb.y);
        ctx.lineWidth = 1;
        ctx.strokeStyle = rgb(alpha);
        ctx.stroke();
      }
      for (const p of proj) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1.6, 0, Math.PI * 2);
        ctx.fillStyle = rgb(0.85);
        ctx.fill();
      }

      // Bright fresnel core.
      ctx.globalCompositeOperation = "lighter";
      const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.5 * (0.7 + lv * 0.6));
      core.addColorStop(0, rgb(0.5 + lv * 0.3));
      core.addColorStop(1, rgb(0));
      ctx.fillStyle = core;
      ctx.fillRect(0, 0, CSS, CSS);
      ctx.globalCompositeOperation = "source-over";

      if (!reduced) raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  return <canvas ref={canvasRef} className="voice-orb-canvas" aria-hidden="true" />;
}
