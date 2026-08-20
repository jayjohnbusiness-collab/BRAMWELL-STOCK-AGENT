import { useEffect, useMemo, useRef, useState } from "react";
import type { CardContext } from "../../cards/types";
import { Surface, type SurfaceType } from "./Surface";
import "../../styles/analytic.css";

/*
 * The Bramwell Analytic Layout — the Concierge tier's pro cockpit. A monochrome
 * terminal built around the point-cloud market surface, framed by an order-flow
 * ledger of the user's real watchlist (click a symbol for its detail), a regime
 * readout, and an intraday path + tape-volume band. Two viewer toggles: colour
 * (monochrome ↔ semantic green/red) and what the surface reads (implied vol,
 * liquidity depth, correlation). Fits the viewport — nothing clips.
 */

const SURFACES: Record<SurfaceType, { label: string; title: string; sub: string; ax: string; ay: string; tag: string; val: string }> = {
  iv: { label: "Vol", title: "Implied Volatility Surface", sub: "SPX · 0–90 DTE · live", ax: "Strike →", ay: "Expiry →", tag: "peak σ", val: "41.8%" },
  liquidity: { label: "Liquidity", title: "Liquidity Depth", sub: "SPX · top of book", ax: "Price →", ay: "Size →", tag: "book wall", val: "$5,412" },
  correlation: { label: "Corr", title: "Correlation Surface", sub: "Your book · 20d", ax: "Asset →", ay: "Asset →", tag: "max ρ", val: "0.88" },
};

function useClock(): string {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return new Date(now).toLocaleTimeString("en-US", { hour12: false });
}

export function AnalyticView({ ctx, onClose }: { ctx: CardContext; onClose: () => void }) {
  const [mono, setMono] = useState(true);
  const [surface, setSurface] = useState<SurfaceType>("iv");
  const clock = useClock();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // The order-flow ledger reads the user's real watchlist.
  const held = ctx.market.held();
  const rows = useMemo(
    () =>
      held.map((i) => {
        const up = i.changePct >= 0;
        const pts: number[] = [];
        let y = 10;
        for (let k = 0; k < 22; k++) {
          y += (Math.random() - 0.5) * 3 + i.changePct * 0.05;
          pts.push(y);
        }
        const mn = Math.min(...pts);
        const mx = Math.max(...pts) || 1;
        const d = pts
          .map((v, k) => `${((k / 21) * 60).toFixed(1)},${(14 - ((v - mn) / (mx - mn || 1)) * 12).toFixed(1)}`)
          .join(" ");
        const z = Math.max(-3.5, Math.min(3.5, i.changePct * 0.55));
        return { sym: i.symbol, last: i.basePrice, chg: i.changePct, up, spark: d, z };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [held.length, held.map((i) => i.symbol).join(",")],
  );

  const sparkColor = (up: boolean) => (mono ? (up ? "#eaf0f7" : "#737e8c") : up ? "#46c98a" : "#e2726f");
  const S = SURFACES[surface];

  return (
    <div className={`ana ${mono ? "ana-mono" : "ana-semantic"}`} role="dialog" aria-label="Bramwell Analytic">
      {/* top strip */}
      <header className="ana-top">
        <div className="ana-brand">
          <b>BRAMWELL</b>
          <span className="ana-lab ana-accent">Analytic</span>
        </div>
        <span className="ana-live">
          <span className="ana-dot" />
          <span className="ana-lab">Live</span>
          <span className="ana-num">{clock}</span>
        </span>

        <div className="ana-controls">
          <div className="ana-seg" role="group" aria-label="Surface reading">
            {(Object.keys(SURFACES) as SurfaceType[]).map((k) => (
              <button
                key={k}
                type="button"
                className={surface === k ? "on" : ""}
                aria-pressed={surface === k}
                onClick={() => setSurface(k)}
              >
                {SURFACES[k].label}
              </button>
            ))}
          </div>
          <div className="ana-seg" role="group" aria-label="Colour mode">
            <button type="button" className={mono ? "on" : ""} aria-pressed={mono} onClick={() => setMono(true)}>
              Mono
            </button>
            <button type="button" className={!mono ? "on" : ""} aria-pressed={!mono} onClick={() => setMono(false)}>
              Semantic
            </button>
          </div>
          <button type="button" className="ana-close" onClick={onClose} title="Back to dashboard (Esc)">
            ✕ Dashboard
          </button>
        </div>
      </header>

      {/* main 3-col */}
      <div className="ana-main">
        <aside className="ana-col ana-ledger">
          <div className="ana-col-head">
            <span className="ana-lab">Order Flow</span>
            <span className="ana-lab">Z · 60m</span>
          </div>
          <div className="ana-ledger-scroll">
            <table>
              <thead>
                <tr>
                  <th>Sym</th>
                  <th className="r">Last</th>
                  <th className="r">Δ%</th>
                  <th className="r">Trend</th>
                  <th className="r">Z</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.sym} onClick={() => ctx.openDetail(r.sym)} tabIndex={0}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); ctx.openDetail(r.sym); } }}
                    title={`Open ${r.sym} detail`}>
                    <td className="ana-sym">{r.sym}</td>
                    <td className="r ana-num">{r.last.toFixed(2)}</td>
                    <td className={`r ana-num ${r.up ? "up" : "dn"}`}>{r.up ? "+" : ""}{r.chg.toFixed(2)}</td>
                    <td className="r">
                      <svg width="46" height="16" viewBox="0 0 60 16" preserveAspectRatio="none" className="ana-spark" aria-hidden="true">
                        <polyline points={r.spark} fill="none" stroke={sparkColor(r.up)} strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
                      </svg>
                    </td>
                    <td className={`r ana-num ${Math.abs(r.z) >= 2 ? "ana-accent" : "dn"}`}>{r.z >= 0 ? "+" : ""}{r.z.toFixed(1)}</td>
                  </tr>
                ))}
                {rows.length === 0 ? (
                  <tr><td colSpan={5} className="ana-empty">Follow names to populate the flow.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <div className="ana-hint">Click a symbol for its detail →</div>
        </aside>

        <section className="ana-stage">
          <Surface type={surface} mono={mono} />
          <div className="ana-stage-head">
            <span className="ana-title">{S.title}</span>
            <span className="ana-lab">{S.sub}</span>
          </div>
          <div className="ana-peak">
            <span className="ana-peak-tag">{S.tag}</span>
            <span className="ana-peak-val ana-num">{S.val}</span>
          </div>
          <div className="ana-axis ana-ax-x ana-lab">{S.ax}</div>
          <div className="ana-axis ana-ax-y ana-lab">{S.ay}</div>
        </section>

        <aside className="ana-col ana-tiles">
          <div className="ana-col-head">
            <span className="ana-lab">Regime</span>
            <span className="ana-lab">signal</span>
          </div>
          <div className="ana-tile">
            <span className="ana-lab">Risk appetite</span>
            <div className="ana-big ana-num">68<span className="ana-big-sub">/100</span></div>
            <span className="ana-lab ana-accent">Risk-on · expanding</span>
            <div className="ana-meter"><i style={{ width: "68%" }} /></div>
          </div>
          <div className="ana-tile">
            <span className="ana-lab">Key levels · SPX</span>
            <div className="ana-kv"><span className="dn">Resistance</span><span className="ana-num">5,442</span></div>
            <div className="ana-kv"><span className="dn">Pivot</span><span className="ana-num">5,408</span></div>
            <div className="ana-kv"><span className="dn">Support</span><span className="ana-num">5,371</span></div>
          </div>
          <div className="ana-tile">
            <span className="ana-lab">Unusual flow</span>
            <div className="ana-kv"><span>NVDA</span><span className="ana-num up">+4.2σ calls</span></div>
            <div className="ana-kv"><span>TSLA</span><span className="ana-num dn">−2.1σ puts</span></div>
            <div className="ana-kv"><span>AAPL</span><span className="ana-num up">+1.6σ calls</span></div>
          </div>
          <div className="ana-tile">
            <span className="ana-lab">Correlation · 20d</span>
            <div className="ana-kv"><span className="dn">Your book ρ</span><span className="ana-num">0.74</span></div>
            <div className="ana-kv"><span className="dn">Concentration</span><span className="ana-num">61% tech</span></div>
          </div>
        </aside>
      </div>

      {/* bottom band */}
      <div className="ana-band">
        <div className="ana-pane">
          <div className="ana-pane-head"><span className="ana-lab">SPX · Intraday path</span><span className="ana-lab ana-num up">5,411.62 ▲ +0.86%</span></div>
          <PathChart mono={mono} />
        </div>
        <div className="ana-pane">
          <div className="ana-pane-head"><span className="ana-lab">Tape volume</span><span className="ana-lab ana-num">1.42B shares</span></div>
          <VolumeBars mono={mono} />
        </div>
      </div>

      <footer className="ana-status">
        <span><span className="ana-accent">●</span> Stream 11 ms</span>
        <span>Simulated data · preview</span>
        <span>Concierge · $100/mo tier</span>
        <span className="ana-status-r">Bramwell Analytic · v0.1</span>
      </footer>
    </div>
  );
}

/* ------------------------------------------------------------ mini charts */

function PathChart({ mono }: { mono: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const data = useMemo(() => {
    const n = 120;
    const pts: number[] = [];
    let y = 0.5;
    for (let k = 0; k < n; k++) {
      y = Math.max(0.1, Math.min(0.9, y + (Math.random() - 0.48) * 0.05));
      pts.push(y);
    }
    return pts;
  }, []);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const draw = () => {
      const DPR = Math.min(2, window.devicePixelRatio || 1);
      const r = c.getBoundingClientRect();
      c.width = Math.max(2, r.width * DPR);
      c.height = Math.max(2, r.height * DPR);
      const ctx = c.getContext("2d");
      if (!ctx) return;
      const W = c.width, Ht = c.height, pad = 8 * DPR, n = data.length;
      ctx.clearRect(0, 0, W, Ht);
      ctx.strokeStyle = "rgba(255,255,255,0.05)";
      ctx.lineWidth = 1;
      for (let g = 1; g < 4; g++) { const yy = pad + (Ht - pad * 2) * g / 4; ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(W, yy); ctx.stroke(); }
      const xs = (k: number) => pad + (W - pad * 2) * k / (n - 1);
      const ys = (v: number, k: number) => Ht - pad - (Ht - pad * 2) * (v * 0.7 + (k / n) * 0.25);
      ctx.beginPath(); ctx.moveTo(xs(0), ys(data[0], 0));
      for (let k = 1; k < n; k++) ctx.lineTo(xs(k), ys(data[k], k));
      ctx.lineTo(xs(n - 1), Ht - pad); ctx.lineTo(xs(0), Ht - pad); ctx.closePath();
      const line = mono ? "234,240,247" : "70,201,138";
      const grad = ctx.createLinearGradient(0, 0, 0, Ht);
      grad.addColorStop(0, `rgba(${line},0.16)`);
      grad.addColorStop(1, `rgba(${line},0)`);
      ctx.fillStyle = grad; ctx.fill();
      ctx.beginPath(); ctx.moveTo(xs(0), ys(data[0], 0));
      for (let k = 1; k < n; k++) ctx.lineTo(xs(k), ys(data[k], k));
      ctx.strokeStyle = mono ? "#eaf0f7" : "#46c98a"; ctx.lineWidth = 1.4 * DPR; ctx.stroke();
      const ex = xs(n - 1), ey = ys(data[n - 1], n - 1);
      ctx.fillStyle = mono ? "#6fd1ff" : "#46c98a"; ctx.beginPath(); ctx.arc(ex, ey, 3 * DPR, 0, 6.28); ctx.fill();
    };
    draw();
    window.addEventListener("resize", draw);
    return () => window.removeEventListener("resize", draw);
  }, [mono, data]);
  return <canvas ref={ref} className="ana-canvas" />;
}

function VolumeBars({ mono }: { mono: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const data = useMemo(() => Array.from({ length: 56 }, () => Math.random()), []);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const draw = () => {
      const DPR = Math.min(2, window.devicePixelRatio || 1);
      const r = c.getBoundingClientRect();
      c.width = Math.max(2, r.width * DPR);
      c.height = Math.max(2, r.height * DPR);
      const ctx = c.getContext("2d");
      if (!ctx) return;
      const W = c.width, Ht = c.height, pad = 8 * DPR, n = data.length, bw = (W - pad * 2) / n;
      ctx.clearRect(0, 0, W, Ht);
      for (let k = 0; k < n; k++) {
        const mid = 1 - (Math.abs(k - n * 0.42) / n) * 1.4;
        const h = Math.max(0.05, mid * (0.5 + data[k] * 0.6)) * (Ht - pad * 2);
        const hot = k === ((n * 0.42) | 0) || k === ((n * 0.7) | 0);
        ctx.fillStyle = hot
          ? mono ? "rgba(111,209,255,0.85)" : "rgba(70,201,138,0.9)"
          : `rgba(234,240,247,${0.18 + mid * 0.4})`;
        ctx.fillRect(pad + k * bw, Ht - pad - h, Math.max(1, bw - 1.5 * DPR), h);
      }
      ctx.strokeStyle = "rgba(255,255,255,0.08)"; ctx.beginPath(); ctx.moveTo(0, Ht - pad); ctx.lineTo(W, Ht - pad); ctx.stroke();
    };
    draw();
    window.addEventListener("resize", draw);
    return () => window.removeEventListener("resize", draw);
  }, [mono, data]);
  return <canvas ref={ref} className="ana-canvas" />;
}
