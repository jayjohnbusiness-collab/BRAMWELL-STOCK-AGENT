import { useEffect, useRef } from "react";

/*
 * The Bramwell Surface — a market field rendered as a rotating point cloud
 * ("the data mountain"). Three readings, selectable: an implied-volatility
 * surface (a central massif over strike × expiry), a liquidity-depth map (two
 * facing book walls with a trough between), and a correlation surface (rolling
 * hills). Lightweight Canvas 2D, drawn in brightness buckets for speed. The
 * peak tips toward the accent — cold cyan in mono mode, green in semantic mode.
 * Reduced motion holds it still.
 */

export type SurfaceType = "iv" | "liquidity" | "correlation";

const N = 132;
const M = 98;

function hash(i: number): number {
  const x = Math.sin(i * 127.1) * 43758.5;
  return x - Math.floor(x);
}

/** A stable 0–1 seed from a symbol, so each name gets its own terrain. */
export function symSeed(s: string): number {
  let h = 0;
  for (let k = 0; k < s.length; k++) h = (h * 31 + s.charCodeAt(k)) >>> 0;
  return (h % 1000) / 1000;
}

function heightFor(type: SurfaceType, u: number, v: number): number {
  if (type === "liquidity") {
    // Two ridges (bid wall / ask wall) running along u, a trough between.
    const bid = 0.9 * Math.exp(-((v + 0.42) * (v + 0.42)) / 0.018);
    const ask = 0.78 * Math.exp(-((v - 0.5) * (v - 0.5)) / 0.02);
    const wob = 0.6 + 0.4 * Math.sin(u * 6 + 1) * 0.5 + 0.2 * Math.sin(u * 13);
    let s = (bid + ask) * wob;
    s += 0.06 * Math.max(0, 1 - Math.abs(v)) * Math.sin(u * 20);
    return Math.max(0, s);
  }
  if (type === "correlation") {
    // Rolling hills — a soft correlation landscape.
    let s =
      0.42 +
      0.26 * Math.sin(u * 3.2 + 0.4) * Math.cos(v * 2.8) +
      0.18 * Math.sin(u * 5.6 - v * 4.1) +
      0.12 * Math.cos(u * 8.3 + v * 7.7);
    s *= Math.max(0, 1 - Math.hypot(u, v) * 0.72);
    return Math.max(0, s);
  }
  // iv — a dominant central massif with jagged sub-peaks.
  const peaks = [
    [0, 0.02, 1.0, 0.1, 0.09],
    [-0.12, 0.14, 0.6, 0.035, 0.045],
    [0.1, -0.02, 0.66, 0.04, 0.035],
    [0.02, 0.2, 0.5, 0.05, 0.05],
    [-0.24, -0.06, 0.34, 0.05, 0.05],
    [0.24, 0.1, 0.3, 0.05, 0.05],
    [0.34, -0.14, 0.2, 0.06, 0.05],
    [-0.34, 0.16, 0.18, 0.06, 0.05],
  ];
  let s = 0;
  for (const q of peaks) {
    const dx = u - q[0];
    const dy = v - q[1];
    s += q[2] * Math.exp(-(dx * dx / q[3] + dy * dy / q[4]));
  }
  const rc = Math.max(0, 1 - Math.hypot(u, v) * 1.05);
  s += 0.14 * rc * (0.5 + 0.5 * Math.sin(u * 9 + 1) * Math.sin(v * 8));
  s += 0.07 * rc * Math.sin(u * 19) * Math.cos(v * 17);
  return Math.max(0, s);
}

export function Surface({
  type,
  mono,
  symbol,
  bias,
}: {
  type: SurfaceType;
  mono: boolean;
  symbol: string;
  bias: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cfg = useRef({ type, mono, symbol, bias });
  cfg.current = { type, mono, symbol, bias };

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const DPR = Math.min(2, window.devicePixelRatio || 1);

    // Height field — rebuilt whenever the surface type OR the selected symbol
    // changes. Each symbol rotates the terrain by its own seed, scales its
    // amplitude, and skews it by the day's direction (bias), so switching names
    // visibly reshapes the surface.
    const H = new Float32Array(N * M);
    let HM = 0;
    let builtKey: string | null = null;
    function build(type: SurfaceType, symbol: string, bias: number) {
      HM = 0;
      const seed = symSeed(symbol);
      const ang = seed * Math.PI * 2;
      const ca = Math.cos(ang);
      const sa = Math.sin(ang);
      const amp = 0.82 + seed * 0.5;
      const skew = Math.max(-0.28, Math.min(0.28, bias * 0.02));
      for (let j = 0; j < M; j++)
        for (let i = 0; i < N; i++) {
          const u = (i / (N - 1)) * 2 - 1;
          const v = (j / (M - 1)) * 2 - 1;
          const ru = u * ca - v * sa;
          const rv = u * sa + v * ca;
          let h = heightFor(type, ru, rv) * amp * (1 + skew * ru);
          h = Math.max(0, h) + 0.05 * hash(i * 13 + j * 57);
          H[j * N + i] = h;
          if (h > HM) HM = h;
        }
      builtKey = type + "|" + symbol;
    }

    function fit() {
      const r = canvas!.getBoundingClientRect();
      canvas!.width = Math.max(2, Math.round(r.width * DPR));
      canvas!.height = Math.max(2, Math.round(r.height * DPR));
    }
    fit();

    const BUCKETS = 26;
    const buckets: number[][] = [];
    let raf = 0;
    let t0 = 0;

    const draw = (ts: number) => {
      if (!t0) t0 = ts;
      const t = ts - t0;
      if (builtKey !== cfg.current.type + "|" + cfg.current.symbol)
        build(cfg.current.type, cfg.current.symbol, cfg.current.bias);
      const W = canvas!.width;
      const Ht = canvas!.height;
      const cx = W * 0.5;
      // Sized and centred so the whole terrain — peak and spreading base — sits
      // inside the stage with margin; never touches the canvas edges.
      const cyB = Ht * 0.52;
      const spanX = W * 0.3;
      const spanZ = Ht * 0.3;
      const spanY = Ht * 0.42;
      const persp = Ht * 1.4; // large camera distance → near-orthographic, gentle peak blow-up
      const yaw = reduced ? 0.5 : 0.5 + 0.28 * Math.sin(t * 0.00016);
      const pitch = 0.46;
      const cP = Math.cos(pitch);
      const sP = Math.sin(pitch);
      const cY = Math.cos(yaw);
      const sY = Math.sin(yaw);
      ctx.clearRect(0, 0, W, Ht);
      for (let b = 0; b < BUCKETS; b++) buckets[b] = [];
      for (let j = 0; j < M; j++)
        for (let i = 0; i < N; i++) {
          const idx = j * N + i;
          const u = (i / (N - 1)) * 2 - 1;
          const v = (j / (M - 1)) * 2 - 1;
          const hh = H[idx] + (reduced ? 0 : 0.02 * Math.sin(t * 0.0016 + idx * 0.35));
          const X = u * spanX;
          const Z = v * spanZ;
          const Y = (-hh / HM) * spanY;
          const X1 = X * cY - Z * sY;
          const Z1 = X * sY + Z * cY;
          const Y1 = Y * cP - Z1 * sP;
          const Z2 = Y * sP + Z1 * cP;
          const pp = persp / (persp + Z2);
          const sx = cx + X1 * pp;
          const sy = cyB + Y1 * pp;
          const hn = hh / HM;
          const depth = (Z2 / spanZ + 1) / 2;
          const bght = 0.18 + Math.sqrt(Math.max(0, hn)) * 0.92 + depth * 0.1;
          const bk = Math.max(0, Math.min(BUCKETS - 1, (bght * BUCKETS) | 0));
          buckets[bk].push(sx, sy);
        }
      const accent = cfg.current.mono ? "180,224,255" : "84,224,140";
      for (let bb = 0; bb < BUCKETS; bb++) {
        const arr = buckets[bb];
        if (!arr.length) continue;
        const f = bb / (BUCKETS - 1);
        if (f > 0.85) ctx.fillStyle = `rgba(${accent},${Math.min(1, 0.7 + f * 0.3)})`;
        else ctx.fillStyle = `rgba(234,240,247,${Math.min(0.95, 0.08 + f * f * 1.05)})`;
        const sz = (f > 0.8 ? 2.0 : f > 0.5 ? 1.5 : 1.05) * DPR;
        for (let a = 0; a < arr.length; a += 2) ctx.fillRect(arr[a], arr[a + 1], sz, sz);
      }
      if (!reduced) raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    if (reduced) draw(0);
    const onResize = () => fit();
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return <canvas ref={canvasRef} className="ana-surface-canvas" aria-label="Market surface" />;
}
