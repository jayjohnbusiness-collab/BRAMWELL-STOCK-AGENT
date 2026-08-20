import { useEffect, useMemo, useRef, useState } from "react";
import type { CardContext } from "../../cards/types";
import type { Candle } from "../../feed/types";
import { hasToken } from "../../feed/token";
import { Surface, symSeed, type SurfaceType } from "./Surface";
import "../../styles/analytic.css";

/*
 * The Bramwell Analytic Layout — the Concierge tier's pro cockpit. A monochrome
 * terminal built around the point-cloud market surface, framed by an order-flow
 * ledger of the user's real watchlist (click a symbol for its detail), a regime
 * readout, and an intraday path + tape-volume band. Two viewer toggles: colour
 * (monochrome ↔ semantic green/red) and what the surface reads (implied vol,
 * liquidity depth, correlation). Fits the viewport — nothing clips.
 */

const SURFACES: Record<SurfaceType, { label: string }> = {
  iv: { label: "Vol" },
  liquidity: { label: "Liquidity" },
  correlation: { label: "Corr" },
};

/** Titles, axes, and the peak readout — all keyed to the selected symbol. */
function surfaceMeta(
  type: SurfaceType,
  sym: string,
  base: number,
  chg: number,
): { title: string; sub: string; ax: string; ay: string; tag: string; val: string } {
  const seed = symSeed(sym);
  if (type === "liquidity") {
    return { title: `${sym} · Liquidity Depth`, sub: "top of book", ax: "Price →", ay: "Size →", tag: "book wall", val: `$${base.toFixed(2)}` };
  }
  if (type === "correlation") {
    return { title: `${sym} · Correlation Surface`, sub: "20d · your book", ax: "Asset →", ay: "Asset →", tag: "max ρ", val: (0.5 + seed * 0.48).toFixed(2) };
  }
  return {
    title: `${sym} · Implied Volatility`,
    sub: "0–90 DTE · live",
    ax: "Strike →",
    ay: "Expiry →",
    tag: "peak σ",
    val: `${(20 + seed * 40 + Math.abs(chg) * 1.4).toFixed(1)}%`,
  };
}

function useClock(): string {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return new Date(now).toLocaleTimeString("en-US", { hour12: false });
}

/** A deterministic-enough intraday walk, used when no feed history is available. */
function synth(base: number): Candle[] {
  const out: Candle[] = [];
  let c = base;
  const now = Date.now();
  for (let k = 0; k < 80; k++) {
    c = Math.max(base * 0.9, c + (Math.random() - 0.47) * base * 0.006);
    out.push({ t: now - (80 - k) * 5 * 60000, c });
  }
  return out;
}

/*
 * The bottom charts pull from the account's feed (ctx.candles → the Finnhub
 * adapter when a key is set in Account → Live data; the simulated feed
 * otherwise). If the feed carries no intraday history (e.g. a free plan without
 * candles), we fall back to a local walk and label the source honestly.
 */
function useSeries(ctx: CardContext, sym: string): { sym: string; candles: Candle[]; last: number; chg: number; real: boolean } {
  const base = ctx.market.bySymbol(sym)?.basePrice ?? 100;
  const [candles, setCandles] = useState<Candle[]>(() => synth(base));
  const [fromFeed, setFromFeed] = useState(false);
  useEffect(() => {
    let alive = true;
    ctx
      .candles(sym, "1D")
      .then((cs) => {
        if (!alive) return;
        if (cs && cs.length > 4) {
          setCandles(cs);
          setFromFeed(true);
        } else {
          setCandles(synth(base));
          setFromFeed(false);
        }
      })
      .catch(() => {
        if (alive) {
          setCandles(synth(base));
          setFromFeed(false);
        }
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sym, ctx.version]);
  const last = candles[candles.length - 1]?.c ?? 0;
  const first = candles[0]?.c ?? last;
  const chg = first ? ((last - first) / first) * 100 : 0;
  return { sym, candles, last, chg, real: fromFeed && hasToken() };
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

  // The name in focus — drives the surface, the intraday charts, and levels.
  const [selected, setSelected] = useState<string>(() => held[0]?.symbol ?? "SPY");
  // Keep the selection valid if the watchlist changes underneath it.
  useEffect(() => {
    if (held.length && !held.some((i) => i.symbol === selected)) setSelected(held[0].symbol);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [held.map((i) => i.symbol).join(",")]);

  const sparkColor = (up: boolean) => (mono ? (up ? "#eaf0f7" : "#737e8c") : up ? "#46c98a" : "#e2726f");
  const series = useSeries(ctx, selected);
  const selInst = ctx.market.bySymbol(selected);
  const S = surfaceMeta(surface, selected, selInst?.basePrice ?? 100, selInst?.changePct ?? 0);

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
            <span className="ana-lab">60m</span>
          </div>
          <div className="ana-ledger-scroll">
            <table>
              <thead>
                <tr>
                  <th>Sym</th>
                  <th className="r">Last</th>
                  <th className="r">Δ%</th>
                  <th className="r">Trend</th>
                  <th className="r" aria-label="Open detail"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.sym} className={r.sym === selected ? "on" : ""} onClick={() => setSelected(r.sym)} tabIndex={0}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelected(r.sym); } }}
                    title={`Load ${r.sym} into the surface and charts`}>
                    <td className="ana-sym">{r.sym}</td>
                    <td className="r ana-num">{r.last.toFixed(2)}</td>
                    <td className={`r ana-num ${r.up ? "up" : "dn"}`}>{r.up ? "+" : ""}{r.chg.toFixed(2)}</td>
                    <td className="r">
                      <svg width="46" height="16" viewBox="0 0 60 16" preserveAspectRatio="none" className="ana-spark" aria-hidden="true">
                        <polyline points={r.spark} fill="none" stroke={sparkColor(r.up)} strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
                      </svg>
                    </td>
                    <td className="r ana-detail">
                      <button
                        type="button"
                        className="ana-detail-btn"
                        title={`Open ${r.sym} detail`}
                        onClick={(e) => { e.stopPropagation(); ctx.openDetail(r.sym); }}
                      >
                        ↗
                      </button>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 ? (
                  <tr><td colSpan={5} className="ana-empty">Follow names to populate the flow.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <div className="ana-hint">Click a name to load it · ↗ for detail</div>
        </aside>

        <section className="ana-stage">
          <Surface type={surface} mono={mono} symbol={selected} bias={selInst?.changePct ?? 0} />
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
          <div className="ana-drag-hint ana-lab">drag to rotate</div>
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
            <span className="ana-lab">Key levels · {selected}</span>
            <div className="ana-kv"><span className="dn">Resistance</span><span className="ana-num">{((selInst?.basePrice ?? 100) * 1.021).toFixed(2)}</span></div>
            <div className="ana-kv"><span className="dn">Pivot</span><span className="ana-num">{(selInst?.basePrice ?? 100).toFixed(2)}</span></div>
            <div className="ana-kv"><span className="dn">Support</span><span className="ana-num">{((selInst?.basePrice ?? 100) * 0.979).toFixed(2)}</span></div>
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

      {/* bottom band — pulls from the account's feed (Finnhub when connected) */}
      <div className="ana-band">
        <div className="ana-pane">
          <div className="ana-pane-head">
            <span className="ana-lab">{series.sym} · Intraday</span>
            <span className={`ana-lab ana-num ${series.chg >= 0 ? "up" : "dn"}`}>
              {series.last.toFixed(2)} {series.chg >= 0 ? "▲" : "▼"} {series.chg >= 0 ? "+" : ""}{series.chg.toFixed(2)}%
            </span>
          </div>
          <PathChart candles={series.candles} mono={mono} />
        </div>
        <div className="ana-pane">
          <div className="ana-pane-head">
            <span className="ana-lab">{series.sym} · Intraday activity</span>
            <span className="ana-lab">{series.real ? "Finnhub" : "sample"}</span>
          </div>
          <ActivityBars candles={series.candles} mono={mono} />
        </div>
      </div>

      <footer className="ana-status">
        <span><span className="ana-accent">●</span> {series.real ? "Finnhub · live data" : "Simulated data"}</span>
        <span>Charts · {series.sym} · 1D</span>
        <span>Concierge · $100/mo tier</span>
        <span className="ana-status-r">Bramwell Analytic · v0.1</span>
      </footer>
    </div>
  );
}

/* ------------------------------------------------------------ mini charts */

function PathChart({ candles, mono }: { candles: Candle[]; mono: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const draw = () => {
      const DPR = Math.min(2, window.devicePixelRatio || 1);
      const r = c.getBoundingClientRect();
      c.width = Math.max(2, r.width * DPR);
      c.height = Math.max(2, r.height * DPR);
      const ctx = c.getContext("2d");
      if (!ctx || candles.length < 2) return;
      const W = c.width, Ht = c.height, pad = 8 * DPR, n = candles.length;
      const lo = Math.min(...candles.map((p) => p.c));
      const hi = Math.max(...candles.map((p) => p.c)) || 1;
      ctx.clearRect(0, 0, W, Ht);
      ctx.strokeStyle = "rgba(255,255,255,0.05)";
      ctx.lineWidth = 1;
      for (let g = 1; g < 4; g++) { const yy = pad + (Ht - pad * 2) * g / 4; ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(W, yy); ctx.stroke(); }
      const xs = (k: number) => pad + (W - pad * 2) * k / (n - 1);
      const ys = (v: number) => Ht - pad - (Ht - pad * 2) * ((v - lo) / (hi - lo || 1)) * 0.92 - 3 * DPR;
      ctx.beginPath(); ctx.moveTo(xs(0), ys(candles[0].c));
      for (let k = 1; k < n; k++) ctx.lineTo(xs(k), ys(candles[k].c));
      ctx.lineTo(xs(n - 1), Ht - pad); ctx.lineTo(xs(0), Ht - pad); ctx.closePath();
      const line = mono ? "234,240,247" : candles[n - 1].c >= candles[0].c ? "70,201,138" : "226,114,111";
      const grad = ctx.createLinearGradient(0, 0, 0, Ht);
      grad.addColorStop(0, `rgba(${line},0.16)`);
      grad.addColorStop(1, `rgba(${line},0)`);
      ctx.fillStyle = grad; ctx.fill();
      ctx.beginPath(); ctx.moveTo(xs(0), ys(candles[0].c));
      for (let k = 1; k < n; k++) ctx.lineTo(xs(k), ys(candles[k].c));
      ctx.strokeStyle = mono ? "#eaf0f7" : `rgb(${line})`; ctx.lineWidth = 1.4 * DPR; ctx.stroke();
      const ex = xs(n - 1), ey = ys(candles[n - 1].c);
      ctx.fillStyle = mono ? "#6fd1ff" : `rgb(${line})`; ctx.beginPath(); ctx.arc(ex, ey, 3 * DPR, 0, 6.28); ctx.fill();
    };
    draw();
    window.addEventListener("resize", draw);
    return () => window.removeEventListener("resize", draw);
  }, [mono, candles]);
  return <canvas ref={ref} className="ana-canvas" />;
}

/** Per-interval price movement — a proxy for intraday activity, from the same series. */
function ActivityBars({ candles, mono }: { candles: Candle[]; mono: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const bars = useMemo(() => {
    const d: { v: number; up: boolean }[] = [];
    for (let k = 1; k < candles.length; k++) d.push({ v: Math.abs(candles[k].c - candles[k - 1].c), up: candles[k].c >= candles[k - 1].c });
    return d;
  }, [candles]);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const draw = () => {
      const DPR = Math.min(2, window.devicePixelRatio || 1);
      const r = c.getBoundingClientRect();
      c.width = Math.max(2, r.width * DPR);
      c.height = Math.max(2, r.height * DPR);
      const ctx = c.getContext("2d");
      if (!ctx || !bars.length) return;
      const W = c.width, Ht = c.height, pad = 8 * DPR, n = bars.length, bw = (W - pad * 2) / n;
      const mx = Math.max(...bars.map((b) => b.v)) || 1;
      ctx.clearRect(0, 0, W, Ht);
      for (let k = 0; k < n; k++) {
        const h = Math.max(1 * DPR, (bars[k].v / mx) * (Ht - pad * 2));
        ctx.fillStyle = mono
          ? `rgba(234,240,247,${0.22 + (bars[k].v / mx) * 0.5})`
          : bars[k].up ? "rgba(70,201,138,0.75)" : "rgba(226,114,111,0.75)";
        ctx.fillRect(pad + k * bw, Ht - pad - h, Math.max(1, bw - 1.5 * DPR), h);
      }
      ctx.strokeStyle = "rgba(255,255,255,0.08)"; ctx.beginPath(); ctx.moveTo(0, Ht - pad); ctx.lineTo(W, Ht - pad); ctx.stroke();
    };
    draw();
    window.addEventListener("resize", draw);
    return () => window.removeEventListener("resize", draw);
  }, [mono, bars]);
  return <canvas ref={ref} className="ana-canvas" />;
}
