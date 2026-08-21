import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { CardContext } from "../../cards/types";
import type { Candle, ChartRange } from "../../feed/types";
import { hasToken } from "../../feed/token";
import { Mark } from "../../brand/Mark";
import { Surface, symSeed, type SurfaceType } from "./Surface";
import "../../styles/analytic.css";

/*
 * The Study — the Concierge tier's research room. Bramwell's own Night palette
 * and Archivo (monospace for figures only), built around the point-cloud market
 * surface, framed by an order-flow
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

/*
 * A small "?" beside a header. On hover or keyboard focus it shows a definition
 * card. The card is position:fixed (positioned from the dot's screen rect each
 * time it opens), so it never clips against a panel's overflow.
 */
function HelpDot({ term, def }: { term: string; def: string }) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const show = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    const x = Math.max(130, Math.min(window.innerWidth - 130, r.left + r.width / 2));
    setPos({ x, y: r.bottom + 8 });
  };
  const hide = () => setPos(null);
  return (
    <span className="ana-help">
      <button
        ref={btnRef}
        type="button"
        className="ana-help-dot"
        aria-label={`What is ${term}?`}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        onClick={(e) => { e.preventDefault(); pos ? hide() : show(); }}
      >
        ?
      </button>
      {pos ? (
        <span className="ana-help-card" role="tooltip" style={{ left: pos.x, top: pos.y }}>
          <b>{term}</b>
          <span>{def}</span>
        </span>
      ) : null}
    </span>
  );
}

/** Plain-language definitions for the terminal's finance jargon. */
const DEFS = {
  regime: "The market's overall risk posture right now — whether money is leaning toward risk (risk-on) or safety (risk-off), and whether that appetite is expanding or contracting.",
  riskAppetite: "A 0–100 read of how eagerly the market is taking on risk. Higher means investors are favouring riskier assets; lower means they're retreating to safety.",
  keyLevels: "Reference prices that often act as turning points: resistance (a ceiling sellers defend), support (a floor buyers defend), and the pivot (the day's balance point).",
  unusualFlow: "Options trades running far above their normal size, measured in standard deviations (σ). Heavy call buying leans bullish, heavy put buying bearish — a positioning tell, not a guarantee.",
  correlation: "How tightly your holdings move together over the last 20 days (ρ, 0 to 1). High correlation means your book rises and falls as one — less diversified than it may look.",
  orderFlow: "Your watchlist as a live tape — last price, the day's change, and a mini trend for each name. Click a row to load it into the surface and charts.",
  volatility: "The recent range width — how far price has swung between high and low over a rolling window. Wider means choppier, more uncertain trade.",
  momentum: "The Relative Strength Index (14) — a 0–100 gauge of recent up-moves vs. down-moves. Above 70 is often called overbought, below 30 oversold; the middle is neutral drift.",
  trend: "How far the last price sits from its own rolling mean, in percent. Positive means it's stretched above 'fair', negative below — a read on how extended the move is.",
  rangePos: "Where the last print sits inside the period's high–low, as a percentage. Near 100% is trading at the highs, near 0% at the lows.",
} as const;

/** The surface reading's definition, keyed to which surface is shown. */
function surfaceDef(type: SurfaceType): { term: string; def: string } {
  if (type === "liquidity")
    return { term: "Liquidity Depth", def: "How much size rests on the order book at each price — the bid wall (buyers) and ask wall (sellers), with the thin trough between them being where price moves most easily." };
  if (type === "correlation")
    return { term: "Correlation Surface", def: "How each pair of your holdings has moved together, drawn as a landscape — the bright peaks are the most tightly linked pairs." };
  return { term: "Implied Volatility", def: "The market's expected future movement across option strikes and expiries. The peak marks where traders are pricing in the most volatility." };
}

function useClock(): string {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return new Date(now).toLocaleTimeString("en-US", { hour12: false });
}

/** Interval options for the intraday band. */
const RANGES: { key: ChartRange; label: string; full: string }[] = [
  { key: "1D", label: "1D", full: "1 Day" },
  { key: "1W", label: "1W", full: "1 Week" },
  { key: "1M", label: "1M", full: "1 Month" },
];

/** A deterministic-enough walk, used when no feed history is available. Its
 * span and step follow the requested range so the tape reads sensibly. */
function synth(base: number, range: ChartRange): Candle[] {
  const out: Candle[] = [];
  let c = base;
  const now = Date.now();
  const n = 80;
  const stepMs = range === "1D" ? 5 * 60000 : range === "1W" ? 2 * 3600000 : 9 * 3600000;
  const vol = range === "1D" ? 0.006 : range === "1W" ? 0.011 : 0.016;
  for (let k = 0; k < n; k++) {
    c = Math.max(base * 0.85, c + (Math.random() - 0.47) * base * vol);
    out.push({ t: now - (n - k) * stepMs, c });
  }
  return out;
}

/*
 * The bottom charts pull from the account's feed (ctx.candles → the Finnhub
 * adapter when a key is set in Account → Live data; the simulated feed
 * otherwise). If the feed carries no intraday history (e.g. a free plan without
 * candles), we fall back to a local walk and label the source honestly.
 */
function useSeries(ctx: CardContext, sym: string, range: ChartRange): { sym: string; candles: Candle[]; last: number; chg: number; real: boolean } {
  const base = ctx.market.bySymbol(sym)?.basePrice ?? 100;
  const [candles, setCandles] = useState<Candle[]>(() => synth(base, range));
  const [fromFeed, setFromFeed] = useState(false);
  useEffect(() => {
    let alive = true;
    ctx
      .candles(sym, range)
      .then((cs) => {
        if (!alive) return;
        if (cs && cs.length > 4) {
          setCandles(cs);
          setFromFeed(true);
        } else {
          setCandles(synth(base, range));
          setFromFeed(false);
        }
      })
      .catch(() => {
        if (alive) {
          setCandles(synth(base, range));
          setFromFeed(false);
        }
      });
    return () => {
      alive = false;
    };
    // Deliberately NOT keyed on ctx.version: the chart is stable and only
    // reloads when the user changes the symbol or the interval, never on its
    // own from a background feed poll.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sym, range]);
  const last = candles[candles.length - 1]?.c ?? 0;
  const first = candles[0]?.c ?? last;
  const chg = first ? ((last - first) / first) * 100 : 0;
  return { sym, candles, last, chg, real: fromFeed && hasToken() };
}

export function AnalyticView({ ctx, onClose }: { ctx: CardContext; onClose: () => void }) {
  const [mono, setMono] = useState(true);
  const [surface, setSurface] = useState<SurfaceType>("iv");
  const [range, setRange] = useState<ChartRange>("1D");
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
  const series = useSeries(ctx, selected, range);
  const rangeMeta = RANGES.find((r) => r.key === range) ?? RANGES[0];
  const selInst = ctx.market.bySymbol(selected);
  const S = surfaceMeta(surface, selected, selInst?.basePrice ?? 100, selInst?.changePct ?? 0);

  return (
    <div className={`ana ${mono ? "ana-mono" : "ana-semantic"}`} role="dialog" aria-label="Bramwell — The Study">
      {/* top strip */}
      <header className="ana-top">
        <div className="ana-brand">
          <b>BRAMWELL</b>
          <Mark size={19} tone="ink" title="Bramwell" />
          <span className="ana-lab ana-accent">The Study</span>
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

      {/* main 3-col — Regime left, surface centre, Order Flow right */}
      <div className="ana-main">
        <aside className="ana-col ana-tiles">
          <div className="ana-col-head">
            <span className="ana-lab ana-with-help">Regime<HelpDot term="Regime" def={DEFS.regime} /></span>
            <span className="ana-lab">signal</span>
          </div>
          <div className="ana-tile">
            <span className="ana-lab ana-with-help">Risk appetite<HelpDot term="Risk appetite" def={DEFS.riskAppetite} /></span>
            <p className="ana-read">The market's leaning toward risk, and that appetite is still widening.</p>
            <div className="ana-big ana-num">68<span className="ana-big-sub">/100</span></div>
            <span className="ana-lab ana-accent">Risk-on · expanding</span>
            <div className="ana-meter"><i style={{ width: "68%" }} /></div>
          </div>
          <div className="ana-tile">
            <span className="ana-lab ana-with-help">Key levels · {selected}<HelpDot term="Key levels" def={DEFS.keyLevels} /></span>
            <p className="ana-read">Where {selected} has tended to turn — a ceiling above, a floor below.</p>
            <div className="ana-kv"><span className="dn">Resistance</span><span className="ana-num">{((selInst?.basePrice ?? 100) * 1.021).toFixed(2)}</span></div>
            <div className="ana-kv"><span className="dn">Pivot</span><span className="ana-num">{(selInst?.basePrice ?? 100).toFixed(2)}</span></div>
            <div className="ana-kv"><span className="dn">Support</span><span className="ana-num">{((selInst?.basePrice ?? 100) * 0.979).toFixed(2)}</span></div>
          </div>
          <div className="ana-tile">
            <span className="ana-lab ana-with-help">Unusual flow<HelpDot term="Unusual flow" def={DEFS.unusualFlow} /></span>
            <p className="ana-read">Bigger-than-usual options bets — a positioning tell, not a verdict.</p>
            <div className="ana-kv"><span>NVDA</span><span className="ana-num up">+4.2σ calls</span></div>
            <div className="ana-kv"><span>TSLA</span><span className="ana-num dn">−2.1σ puts</span></div>
            <div className="ana-kv"><span>AAPL</span><span className="ana-num up">+1.6σ calls</span></div>
          </div>
          <div className="ana-tile">
            <span className="ana-lab ana-with-help">Correlation · 20d<HelpDot term="Correlation" def={DEFS.correlation} /></span>
            <p className="ana-read">Your names move largely as one — more concentrated in tech than it looks.</p>
            <div className="ana-kv"><span className="dn">Your book ρ</span><span className="ana-num">0.74</span></div>
            <div className="ana-kv"><span className="dn">Concentration</span><span className="ana-num">61% tech</span></div>
          </div>
        </aside>

        <section className="ana-stage">
          <Surface type={surface} mono={mono} symbol={selected} bias={selInst?.changePct ?? 0} />
          <div className="ana-stage-head">
            <span className="ana-title ana-with-help">{S.title}<HelpDot term={surfaceDef(surface).term} def={surfaceDef(surface).def} /></span>
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

        <aside className="ana-col ana-ledger">
          <div className="ana-col-head">
            <span className="ana-lab ana-with-help">Order Flow<HelpDot term="Order Flow" def={DEFS.orderFlow} /></span>
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
      </div>

      {/* bottom band — pulls from the account's feed (Finnhub when connected) */}
      <div className="ana-band">
        <div className="ana-pane">
          <div className="ana-pane-head">
            <span className="ana-lab">{series.sym} · {rangeMeta.full}</span>
            <div className="ana-pane-head-r">
              <div className="ana-iv" role="group" aria-label="Chart interval">
                {RANGES.map((r) => (
                  <button
                    key={r.key}
                    type="button"
                    className={range === r.key ? "on" : ""}
                    aria-pressed={range === r.key}
                    onClick={() => setRange(r.key)}
                    title={`View ${r.full}`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
              <span className={`ana-lab ana-num ${series.chg >= 0 ? "up" : "dn"}`}>
                {series.last.toFixed(2)} {series.chg >= 0 ? "▲" : "▼"} {series.chg >= 0 ? "+" : ""}{series.chg.toFixed(2)}%
              </span>
            </div>
          </div>
          <LuminousChannel candles={series.candles} mono={mono} symbol={series.sym} range={range} />
          <span className="ana-scrub-hint ana-lab">hover to scrub</span>
        </div>
        <Metrics candles={series.candles} mono={mono} symbol={series.sym} />
      </div>

      <footer className="ana-status">
        <span><span className="ana-accent">●</span> {series.real ? "Finnhub · live data" : "Simulated data"}</span>
        <span>Charts · {series.sym} · {range}</span>
        <span>The Study · Concierge tier</span>
        <span className="ana-status-r">These readings describe the market — they never advise.</span>
      </footer>
    </div>
  );
}

/* ------------------------------------------------------- luminous channel
 * The intraday band, rendered in the surface's own visual language: the price
 * is a stream of glowing particles over a bloom + mirror reflection, threaded
 * by a bright white core line so the exact level stays crisp; the rolling
 * high/low corridor is a field of drifting dust; a travelling glow and a live
 * playhead keep it breathing; hover scrubs a time/price crosshair off the real
 * candle timestamps. Mono paints it cyan; semantic tints the atmosphere
 * green/red by the day's direction while the core line stays white.
 */

/** Rolling corridor (high/low over Wn), mean thread, and range width per bar. */
function channelBands(closes: number[]) {
  const N = closes.length;
  const Wn = Math.max(4, Math.round(N * 0.12));
  const Mn = Math.max(3, Math.round(N * 0.08));
  const hiCh: number[] = [], loCh: number[] = [], meanL: number[] = [], width: number[] = [];
  for (let w = 0; w < N; w++) {
    const win = closes.slice(Math.max(0, w - Wn + 1), w + 1);
    const mWin = closes.slice(Math.max(0, w - Mn + 1), w + 1);
    const wHi = Math.max(...win), wLo = Math.min(...win);
    hiCh.push(wHi); loCh.push(wLo);
    meanL.push(mWin.reduce((x, y) => x + y, 0) / mWin.length);
    width.push(wHi - wLo);
  }
  return { hiCh, loCh, meanL, width };
}

const lerp = (arr: number[], fi: number) => {
  const i = Math.floor(fi), f = fi - i, j = Math.min(arr.length - 1, i + 1);
  return arr[i] + (arr[j] - arr[i]) * f;
};

function LuminousChannel({ candles, mono, symbol, range }: { candles: Candle[]; mono: boolean; symbol: string; range: ChartRange }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const monoRef = useRef(mono);
  monoRef.current = mono;
  useEffect(() => {
    const c = ref.current;
    const pctx = c?.getContext("2d");
    if (!c || !pctx || candles.length < 2) return;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const DPR = Math.min(2, window.devicePixelRatio || 1);
    const N = candles.length;
    const closes = candles.map((p) => p.c);
    const times = candles.map((p) => p.t);
    const lo = Math.min(...closes), hi = Math.max(...closes) || 1;
    const up = closes[N - 1] >= closes[0];
    const { hiCh, loCh, meanL } = channelBands(closes);
    const deltas = closes.map((v, i) => (i ? Math.abs(v - closes[i - 1]) : 0));
    const maxD = Math.max(...deltas) || 1;
    // On a single day, scrub reads a clock; over a week/month it reads a date.
    const fmtTime = (fi: number) => {
      const d = new Date(lerp(times, fi));
      return range === "1D"
        ? d.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" })
        : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    };

    const PAD = 8 * DPR, AX = 40 * DPR;
    const fit = () => {
      const r = c.getBoundingClientRect();
      c.width = Math.max(2, Math.round(r.width * DPR));
      c.height = Math.max(2, Math.round(r.height * DPR));
    };
    fit();

    // particle systems — indices are float, resolved to px each frame
    const corridor = Array.from({ length: 440 }, () => {
      const side = Math.random() < 0.5, depth = Math.pow(Math.random(), 2);
      return { fi: Math.random() * (N - 1), r: side ? 1 - depth * 0.55 : depth * 0.55, ph: Math.random() * 6.28, sp: 0.3 + Math.random() * 0.8 };
    });
    const stream = Array.from({ length: 180 }, () => ({
      fi: Math.random() * (N - 1), j: (Math.random() - 0.5) * 6 * DPR, ph: Math.random() * 6.28, sz: 0.6 + Math.random() * 1.3,
    }));

    let hoverX: number | null = null;
    const onMove = (e: PointerEvent) => { hoverX = (e.clientX - c.getBoundingClientRect().left) * DPR; };
    const onLeave = () => { hoverX = null; };
    c.addEventListener("pointermove", onMove);
    c.addEventListener("pointerleave", onLeave);
    c.style.cursor = "crosshair";
    c.style.touchAction = "none";

    const xs = (fi: number, W: number) => PAD + ((W - PAD * 2 - AX) * fi) / (N - 1);
    const ys = (v: number, H: number) => H - PAD - (H - PAD * 2) * ((v - lo) / (hi - lo || 1)) * 0.9 - 4 * DPR;

    let raf = 0, t0 = 0;
    const draw = (ts: number) => {
      if (!t0) t0 = ts;
      const t = ts - t0;
      const m = monoRef.current;
      // atmosphere tints by mode/direction; the core line stays white for legibility
      const glow = m ? "122,170,226" : up ? "70,201,138" : "226,114,111";
      const dust = m ? "150,200,255" : up ? "120,205,160" : "230,150,150";
      const W = c.width, H = c.height;
      // Clear to transparent so the pane's own --panel background shows through,
      // keeping this card tonally identical to its neighbours (no ambient wash).
      pctx.clearRect(0, 0, W, H);

      // faint corridor slab
      pctx.beginPath(); pctx.moveTo(xs(0, W), ys(hiCh[0], H));
      for (let i = 1; i < N; i++) pctx.lineTo(xs(i, W), ys(hiCh[i], H));
      for (let b = N - 1; b >= 0; b--) pctx.lineTo(xs(b, W), ys(loCh[b], H));
      pctx.closePath(); pctx.fillStyle = `rgba(${dust},0.04)`; pctx.fill();

      pctx.globalCompositeOperation = "lighter";
      // corridor dust
      for (const cp of corridor) {
        if (!reduced) { cp.fi += cp.sp * 0.02; if (cp.fi > N - 1) cp.fi -= N - 1; }
        const val = lerp(loCh, cp.fi) + (lerp(hiCh, cp.fi) - lerp(loCh, cp.fi)) * cp.r;
        const tw = 0.4 + 0.6 * Math.sin(t * 0.003 + cp.ph);
        pctx.fillStyle = `rgba(${dust},${0.05 + tw * 0.12})`;
        pctx.fillRect(xs(cp.fi, W), ys(val, H), 1.1 * DPR, 1.1 * DPR);
      }
      // rails glow
      for (const arr of [hiCh, loCh]) {
        pctx.strokeStyle = `rgba(${dust},0.12)`; pctx.lineWidth = 3 * DPR; pctx.beginPath();
        for (let r2 = 0; r2 < N; r2++) { const x = xs(r2, W), y = ys(arr[r2], H); r2 === 0 ? pctx.moveTo(x, y) : pctx.lineTo(x, y); }
        pctx.stroke();
      }
      // mean thread
      pctx.strokeStyle = `rgba(${glow},0.5)`; pctx.lineWidth = 1 * DPR; pctx.beginPath();
      for (let mm = 0; mm < N; mm++) { const x = xs(mm, W), y = ys(meanL[mm], H); mm === 0 ? pctx.moveTo(x, y) : pctx.lineTo(x, y); }
      pctx.stroke();

      const pricePath = () => {
        pctx.beginPath();
        for (let q = 0; q < N; q++) { const x = xs(q, W), y = ys(closes[q], H); q === 0 ? pctx.moveTo(x, y) : pctx.lineTo(x, y); }
      };
      // bloom
      pctx.strokeStyle = `rgba(${glow},0.18)`; pctx.lineWidth = 8 * DPR; pctx.lineJoin = "round"; pricePath(); pctx.stroke();
      // mirror reflection
      pctx.save(); pctx.globalAlpha = 0.14; pctx.beginPath();
      for (let q2 = 0; q2 < N; q2++) { const x = xs(q2, W), y = ys(closes[q2], H); const ry = y + (H - PAD - y) * 0.08 + 10 * DPR; q2 === 0 ? pctx.moveTo(x, ry) : pctx.lineTo(x, ry); }
      pctx.strokeStyle = `rgb(${glow})`; pctx.lineWidth = 2 * DPR; pctx.stroke(); pctx.restore();
      // white core line — keeps the exact level crisp
      pctx.strokeStyle = "#eaf0f7"; pctx.lineWidth = 1.5 * DPR; pricePath(); pctx.stroke();

      // tracer pulse — a bright bead sweeps the line from the left and arrives
      // at the live point, then rests a beat before running again.
      if (!reduced) {
        const CYCLE = 6200, SWEEP = 5000;
        const ph = (t % CYCLE) / SWEEP;
        if (ph <= 1) {
          const e = ph < 0.5 ? 2 * ph * ph : 1 - Math.pow(-2 * ph + 2, 2) / 2; // easeInOut
          const tp = e * (N - 1);
          // comet trail behind the head
          const TRAIL = 22;
          for (let s = 0; s < TRAIL; s++) {
            const fi = tp - s * 0.9;
            if (fi < 0) break;
            const x = xs(fi, W), y = ys(lerp(closes, fi), H);
            const a = (1 - s / TRAIL) * 0.5;
            pctx.fillStyle = `rgba(${glow},${a})`;
            const rr = (2.4 - (s / TRAIL) * 1.8) * DPR;
            pctx.beginPath(); pctx.arc(x, y, Math.max(0.4 * DPR, rr), 0, 6.28); pctx.fill();
          }
          // head bead + halo
          const hx = xs(tp, W), hy = ys(lerp(closes, tp), H);
          const halo = pctx.createRadialGradient(hx, hy, 0, hx, hy, 13 * DPR);
          halo.addColorStop(0, `rgba(${glow},0.7)`); halo.addColorStop(1, `rgba(${glow},0)`);
          pctx.fillStyle = halo; pctx.beginPath(); pctx.arc(hx, hy, 13 * DPR, 0, 6.28); pctx.fill();
          pctx.fillStyle = "#f4fbff"; pctx.beginPath(); pctx.arc(hx, hy, 2.6 * DPR, 0, 6.28); pctx.fill();
        }
      }

      // stream particles + travelling glow
      const glowPos = reduced ? N - 1 : (t * 0.02) % (N - 1);
      for (const sp of stream) {
        if (!reduced) { sp.fi += 0.03; if (sp.fi > N - 1) sp.fi -= N - 1; }
        const x = xs(sp.fi, W), base = ys(lerp(closes, sp.fi), H);
        const mo = lerp(deltas, sp.fi) / maxD;
        const near = Math.max(0, 1 - Math.abs(sp.fi - glowPos) / 8);
        const tw = 0.4 + 0.6 * Math.sin(t * 0.004 + sp.ph);
        const a2 = (0.1 + mo * 0.4 + near * 0.5) * tw;
        pctx.fillStyle = near > 0.4 ? `rgba(190,235,255,${a2})` : `rgba(234,240,247,${a2})`;
        pctx.fillRect(x, base + sp.j, sp.sz * DPR, sp.sz * DPR);
      }

      // live playhead
      const ex = xs(N - 1, W), ey = ys(closes[N - 1], H), pulse = reduced ? 1 : 0.55 + 0.45 * Math.sin(t * 0.004);
      const pg = pctx.createRadialGradient(ex, ey, 0, ex, ey, 16 * DPR);
      pg.addColorStop(0, `rgba(${glow},${0.5 * pulse})`); pg.addColorStop(1, `rgba(${glow},0)`);
      pctx.fillStyle = pg; pctx.beginPath(); pctx.arc(ex, ey, 16 * DPR, 0, 6.28); pctx.fill();
      pctx.fillStyle = "#eaf0f7"; pctx.beginPath(); pctx.arc(ex, ey, 3 * DPR, 0, 6.28); pctx.fill();

      pctx.globalCompositeOperation = "source-over";
      // price tag
      pctx.fillStyle = `rgba(${glow},0.16)`; pctx.fillRect(W - AX, ey - 9 * DPR, AX, 18 * DPR);
      pctx.fillStyle = "#eaf0f7"; pctx.font = `${10 * DPR}px 'Space Mono', monospace`; pctx.textBaseline = "middle"; pctx.textAlign = "left";
      pctx.fillText(closes[N - 1].toFixed(2), W - AX + 4 * DPR, ey);

      // hover crosshair + readout
      if (hoverX != null) {
        const fi = Math.max(0, Math.min(N - 1, ((hoverX - PAD) / (W - PAD * 2 - AX)) * (N - 1)));
        const hx = xs(fi, W), hv = lerp(closes, fi), hy = ys(hv, H);
        pctx.strokeStyle = "rgba(234,240,247,0.28)"; pctx.lineWidth = 1; pctx.setLineDash([3 * DPR, 3 * DPR]);
        pctx.beginPath(); pctx.moveTo(hx, PAD); pctx.lineTo(hx, H - PAD); pctx.stroke();
        pctx.beginPath(); pctx.moveTo(0, hy); pctx.lineTo(W - AX, hy); pctx.stroke(); pctx.setLineDash([]);
        pctx.fillStyle = "#eaf0f7"; pctx.beginPath(); pctx.arc(hx, hy, 3.5 * DPR, 0, 6.28); pctx.fill();
        pctx.strokeStyle = `rgba(${glow},0.7)`; pctx.lineWidth = 1.4 * DPR; pctx.beginPath(); pctx.arc(hx, hy, 6.5 * DPR, 0, 6.28); pctx.stroke();
        const label = `${fmtTime(fi)}  ${hv.toFixed(2)}`;
        pctx.font = `${10 * DPR}px 'Space Mono', monospace`;
        const tw2 = pctx.measureText(label).width + 14 * DPR;
        const bx = Math.min(W - AX - tw2, Math.max(0, hx + 8 * DPR)), by = Math.max(PAD, hy - 26 * DPR);
        pctx.fillStyle = "rgba(8,12,20,0.9)"; pctx.strokeStyle = `rgba(${glow},0.4)`; pctx.lineWidth = 1;
        pctx.fillRect(bx, by, tw2, 18 * DPR); pctx.strokeRect(bx, by, tw2, 18 * DPR);
        pctx.fillStyle = "#eaf0f7"; pctx.textBaseline = "middle"; pctx.fillText(label, bx + 7 * DPR, by + 9 * DPR);
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
      c.removeEventListener("pointermove", onMove);
      c.removeEventListener("pointerleave", onLeave);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candles, symbol, range]);
  return <canvas ref={ref} className="ana-canvas" aria-label="Intraday price, hover to scrub" />;
}

/* ------------------------------------------------------------- metrics
 * Three price-derived reads that replace the old volatility panel, each drawn
 * in the same dust + glow + live-bead motif and keyed to the selected symbol:
 *   · Momentum — a 14-period RSI as a horizontal oscillator
 *   · Trend Stretch — price vs. its rolling mean, a centred signed ribbon
 *   · Range Position — where the last print sits in the period's high–low
 * All derive from closes alone, so they work on any feed. Mono paints them
 * cyan; semantic tints each by its own directional read (green up / red down).
 */

/** Wilder's RSI over `period`, aligned to the close array (warm-up back-filled). */
function rsiSeries(closes: number[], period = 14): number[] {
  const n = closes.length;
  const out = new Array<number>(n).fill(50);
  if (n < period + 1) return out;
  let g = 0, l = 0;
  for (let i = 1; i <= period; i++) { const ch = closes[i] - closes[i - 1]; if (ch > 0) g += ch; else l -= ch; }
  g /= period; l /= period;
  out[period] = 100 - 100 / (1 + g / (l || 1e-9));
  for (let i = period + 1; i < n; i++) {
    const ch = closes[i] - closes[i - 1], up = ch > 0 ? ch : 0, dn = ch < 0 ? -ch : 0;
    g = (g * (period - 1) + up) / period; l = (l * (period - 1) + dn) / period;
    out[i] = 100 - 100 / (1 + g / (l || 1e-9));
  }
  for (let i = 0; i < period; i++) out[i] = out[period];
  return out;
}

type MetricStats = {
  closes: number[]; rsi: number[]; stretch: number[]; meanL: number[];
  rsiNow: number; rsiRising: boolean; stretchNow: number; rangePct: number; lo: number; hi: number;
};

function metricStats(candles: Candle[]): MetricStats {
  const closes = candles.map((c) => c.c);
  const n = closes.length;
  const { meanL } = channelBands(closes);
  const rsi = rsiSeries(closes);
  const stretch = closes.map((c, i) => ((c - meanL[i]) / (meanL[i] || 1)) * 100);
  const lo = Math.min(...closes), hi = Math.max(...closes);
  return {
    closes, rsi, stretch, meanL,
    rsiNow: rsi[n - 1] ?? 50,
    rsiRising: (rsi[n - 1] ?? 50) >= (rsi[n - 2] ?? 50),
    stretchNow: stretch[n - 1] ?? 0,
    rangePct: hi > lo ? ((closes[n - 1] - lo) / (hi - lo)) * 100 : 50,
    lo, hi,
  };
}

/** Card chrome shared by the three metrics: viz cell (graph + label + state)
 * beside a readout cell (big number + unit), split so the number never sits
 * over the graph. */
function MetricShell(props: {
  term: string; def: string; label: string; state: string; dir: number;
  big: ReactNode; sub: string; canvas: ReactNode; ariaLabel: string;
}) {
  const cls = props.dir >= 0 ? "up" : "dn";
  return (
    <div className="ana-metric">
      <div className="ana-metric-viz">
        {props.canvas}
        <span className="ana-lab ana-with-help ana-metric-top">{props.label}<HelpDot term={props.term} def={props.def} /></span>
        <span className={`ana-metric-state ${cls}`}>{props.state}</span>
      </div>
      <div className="ana-metric-readout">
        <span className={`ana-metric-big ana-num ${cls}`} aria-label={props.ariaLabel}>{props.big}</span>
        <span className="ana-metric-sub">{props.sub}</span>
      </div>
    </div>
  );
}

/** One animated canvas; `render` does the per-frame drawing. Rebuilds on
 * symbol/candle change, recolours live on the mono toggle, honours reduced-motion. */
function MetricCanvas({
  candles, mono, symbol, setup, render,
}: {
  candles: Candle[]; mono: boolean; symbol: string;
  setup: (n: number, dpr: number) => unknown;
  render: (ctx: CanvasRenderingContext2D, W: number, H: number, t: number, mono: boolean, dpr: number, reduced: boolean, state: unknown) => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const monoRef = useRef(mono);
  monoRef.current = mono;
  useEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx || candles.length < 2) return;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const DPR = Math.min(2, window.devicePixelRatio || 1);
    const state = setup(candles.length, DPR);
    const fit = () => {
      const r = c.getBoundingClientRect();
      c.width = Math.max(2, Math.round(r.width * DPR));
      c.height = Math.max(2, Math.round(r.height * DPR));
    };
    fit();
    let raf = 0, t0 = 0;
    const draw = (ts: number) => {
      if (!t0) t0 = ts;
      render(ctx, c.width, c.height, ts - t0, monoRef.current, DPR, reduced, state);
      if (!reduced) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    if (reduced) draw(0);
    const onResize = () => fit();
    window.addEventListener("resize", onResize);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", onResize); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candles, symbol]);
  return <canvas ref={ref} className="ana-metric-canvas" aria-hidden="true" />;
}

const glowFor = (mono: boolean, dir: number) => (mono ? "122,170,226" : dir >= 0 ? "70,201,138" : "226,114,111");
const dustFor = (mono: boolean, dir: number) => (mono ? "150,200,255" : dir >= 0 ? "120,205,160" : "230,150,150");

function Metrics({ candles, mono, symbol }: { candles: Candle[]; mono: boolean; symbol: string }) {
  const s = useMemo(() => metricStats(candles), [candles]);
  const momState = s.rsiNow > 70 ? "Overbought" : s.rsiNow < 30 ? "Oversold" : s.rsiRising ? "Firm · rising" : "Softening";
  const trendState = Math.abs(s.stretchNow) < 0.3 ? "Near fair" : s.stretchNow > 0 ? "Extended up" : "Extended down";
  const rangeState = s.rangePct > 80 ? "Near highs" : s.rangePct < 20 ? "Near lows" : "Mid-range";

  // Momentum — horizontal RSI oscillator with 30/70 zones + dust + live bead.
  const momCanvas = (
    <MetricCanvas
      candles={candles} mono={mono} symbol={symbol}
      setup={(n) => Array.from({ length: 90 }, () => ({ fi: Math.random() * (n - 1), ph: Math.random() * 6.28 }))}
      render={(ctx, W, H, t, m, DPR, reduced, st) => {
        const dust = st as { fi: number; ph: number }[];
        const rsi = s.rsi, rN = rsi.length;
        const glow = glowFor(m, s.rsiRising ? 1 : -1), dcol = dustFor(m, s.rsiRising ? 1 : -1);
        const padX = 15 * DPR, y0 = H * 0.74, amp = H * 0.5;
        ctx.clearRect(0, 0, W, H);
        const tW = W - padX * 2;
        ctx.strokeStyle = "rgba(255,255,255,0.08)"; ctx.lineWidth = 1; ctx.setLineDash([2 * DPR, 3 * DPR]);
        [30, 70].forEach((z) => { const zx = padX + (tW * z) / 100; ctx.beginPath(); ctx.moveTo(zx, y0 - amp); ctx.lineTo(zx, y0 + 6 * DPR); ctx.stroke(); });
        ctx.setLineDash([]);
        ctx.strokeStyle = "rgba(255,255,255,0.10)"; ctx.lineWidth = 1.5 * DPR; ctx.beginPath(); ctx.moveTo(padX, y0); ctx.lineTo(padX + tW, y0); ctx.stroke();
        ctx.globalCompositeOperation = "lighter";
        ctx.strokeStyle = `rgba(${glow},0.5)`; ctx.lineWidth = 1.4 * DPR; ctx.beginPath();
        for (let i = 0; i < rN; i++) { const x = padX + (tW * i) / (rN - 1), yy = y0 - (rsi[i] / 100) * amp; i === 0 ? ctx.moveTo(x, yy) : ctx.lineTo(x, yy); }
        ctx.stroke();
        for (const d of dust) { if (!reduced) { d.fi += 0.02; if (d.fi > rN - 1) d.fi -= rN - 1; } const x = padX + (tW * d.fi) / (rN - 1), top = y0 - (lerp(rsi, d.fi) / 100) * amp, yy = top + (y0 - top) * (0.15 + 0.8 * Math.abs(Math.sin(d.ph + t * 0.001))); const tw = 0.4 + 0.6 * Math.sin(t * 0.003 + d.ph); ctx.fillStyle = `rgba(${dcol},${0.05 + tw * 0.1})`; ctx.fillRect(x, yy, 1.1 * DPR, 1.1 * DPR); }
        const cur = rsi[rN - 1], bx = padX + (tW * cur) / 100, by = y0 - (cur / 100) * amp, pulse = reduced ? 1 : 0.6 + 0.4 * Math.sin(t * 0.004);
        const g = ctx.createRadialGradient(bx, by, 0, bx, by, 13 * DPR); g.addColorStop(0, `rgba(${glow},${0.6 * pulse})`); g.addColorStop(1, `rgba(${glow},0)`); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(bx, by, 13 * DPR, 0, 6.28); ctx.fill();
        ctx.fillStyle = "#eef3f9"; ctx.beginPath(); ctx.arc(bx, by, 2.6 * DPR, 0, 6.28); ctx.fill();
        ctx.globalCompositeOperation = "source-over";
      }}
    />
  );

  // Trend Stretch — centred signed ribbon of price-vs-mean, comet head at now.
  const trendCanvas = (
    <MetricCanvas
      candles={candles} mono={mono} symbol={symbol}
      setup={(n) => Array.from({ length: 80 }, () => ({ fi: Math.random() * (n - 1), ph: Math.random() * 6.28 }))}
      render={(ctx, W, H, t, m, DPR, reduced, st) => {
        const dust = st as { fi: number; ph: number }[];
        const stretch = s.stretch, N = stretch.length;
        let sMax = 0.6; for (let i = 0; i < N; i++) sMax = Math.max(sMax, Math.abs(stretch[i]));
        const cy = H * 0.6, cx = W * 0.5, half = W * 0.4, amp = H * 0.34;
        ctx.clearRect(0, 0, W, H);
        ctx.strokeStyle = "rgba(255,255,255,0.12)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(cx, cy - 18 * DPR); ctx.lineTo(cx, cy + 12 * DPR); ctx.stroke();
        ctx.strokeStyle = "rgba(255,255,255,0.08)"; ctx.beginPath(); ctx.moveTo(cx - half, cy); ctx.lineTo(cx + half, cy); ctx.stroke();
        ctx.globalCompositeOperation = "lighter";
        const glow = glowFor(m, s.stretchNow);
        ctx.strokeStyle = `rgba(${glow},0.42)`; ctx.lineWidth = 1.3 * DPR; ctx.beginPath();
        for (let i = 0; i < N; i++) { const x = cx - half + (2 * half * i) / (N - 1), yy = cy - (stretch[i] / sMax) * amp; i === 0 ? ctx.moveTo(x, yy) : ctx.lineTo(x, yy); }
        ctx.stroke();
        for (const d of dust) { if (!reduced) { d.fi += 0.02; if (d.fi > N - 1) d.fi -= N - 1; } const x = cx - half + (2 * half * d.fi) / (N - 1), v = lerp(stretch, d.fi), yy = cy - (v / sMax) * amp; const tw = 0.4 + 0.6 * Math.sin(t * 0.003 + d.ph); ctx.fillStyle = `rgba(${dustFor(m, v)},${0.05 + tw * 0.1})`; ctx.fillRect(x, yy, 1.1 * DPR, 1.1 * DPR); }
        const cur = stretch[N - 1], bx = cx + half, by = cy - (cur / sMax) * amp, pulse = reduced ? 1 : 0.6 + 0.4 * Math.sin(t * 0.004);
        const g = ctx.createRadialGradient(bx, by, 0, bx, by, 13 * DPR); g.addColorStop(0, `rgba(${glow},${0.6 * pulse})`); g.addColorStop(1, `rgba(${glow},0)`); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(bx, by, 13 * DPR, 0, 6.28); ctx.fill();
        ctx.fillStyle = "#eef3f9"; ctx.beginPath(); ctx.arc(bx, by, 2.6 * DPR, 0, 6.28); ctx.fill();
        ctx.globalCompositeOperation = "source-over";
      }}
    />
  );

  // Range Position — vertical thermometer, bead in the right half, clear of label.
  const rangeCanvas = (
    <MetricCanvas
      candles={candles} mono={mono} symbol={symbol}
      setup={() => Array.from({ length: 70 }, () => ({ f: Math.random(), off: Math.random() - 0.5, ph: Math.random() * 6.28 }))}
      render={(ctx, W, H, t, m, DPR, reduced, st) => {
        const dust = st as { f: number; off: number; ph: number }[];
        const pos = s.rangePct / 100;
        const glow = glowFor(m, s.rangePct - 50), dcol = dustFor(m, s.rangePct - 50);
        const x0 = W * 0.66, top = H * 0.34, bot = H * 0.84, colH = bot - top;
        ctx.clearRect(0, 0, W, H);
        ctx.strokeStyle = "rgba(255,255,255,0.10)"; ctx.lineWidth = 1; [top, bot].forEach((yy) => { ctx.beginPath(); ctx.moveTo(x0 - 10 * DPR, yy); ctx.lineTo(x0 + 10 * DPR, yy); ctx.stroke(); });
        ctx.strokeStyle = "rgba(255,255,255,0.08)"; ctx.beginPath(); ctx.moveTo(x0, top); ctx.lineTo(x0, bot); ctx.stroke();
        ctx.globalCompositeOperation = "lighter";
        const py = bot - colH * pos;
        const grad = ctx.createLinearGradient(0, bot, 0, py); grad.addColorStop(0, `rgba(${glow},0)`); grad.addColorStop(1, `rgba(${glow},0.35)`); ctx.strokeStyle = grad; ctx.lineWidth = 3 * DPR; ctx.beginPath(); ctx.moveTo(x0, bot); ctx.lineTo(x0, py); ctx.stroke();
        for (const d of dust) { if (!reduced) { d.f += 0.004; if (d.f > 1) d.f -= 1; } const yy = bot - colH * d.f * pos, xx = x0 + d.off * 9 * DPR; const tw = 0.4 + 0.6 * Math.sin(t * 0.003 + d.ph); ctx.fillStyle = `rgba(${dcol},${0.05 + tw * 0.1})`; ctx.fillRect(xx, yy, 1.2 * DPR, 1.2 * DPR); }
        const pulse = reduced ? 1 : 0.6 + 0.4 * Math.sin(t * 0.004);
        const g = ctx.createRadialGradient(x0, py, 0, x0, py, 14 * DPR); g.addColorStop(0, `rgba(${glow},${0.6 * pulse})`); g.addColorStop(1, `rgba(${glow},0)`); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x0, py, 14 * DPR, 0, 6.28); ctx.fill();
        ctx.fillStyle = "#eef3f9"; ctx.beginPath(); ctx.arc(x0, py, 2.8 * DPR, 0, 6.28); ctx.fill();
        ctx.globalCompositeOperation = "source-over";
      }}
    />
  );

  return (
    <div className="ana-metrics" aria-label="Price metrics">
      <MetricShell
        term="Momentum · RSI 14" def={DEFS.momentum} label="Momentum · RSI 14"
        state={momState} dir={s.rsiRising ? 1 : -1}
        big={s.rsiNow.toFixed(0)} sub="of 100" canvas={momCanvas}
        ariaLabel={`Momentum RSI ${s.rsiNow.toFixed(0)} of 100`}
      />
      <MetricShell
        term="Trend Stretch" def={DEFS.trend} label="Trend Stretch · vs mean"
        state={trendState} dir={s.stretchNow}
        big={`${s.stretchNow >= 0 ? "+" : ""}${s.stretchNow.toFixed(1)}%`}
        sub={s.stretchNow >= 0 ? "above fair" : "below fair"} canvas={trendCanvas}
        ariaLabel={`Trend stretch ${s.stretchNow.toFixed(1)} percent from mean`}
      />
      <MetricShell
        term="Range Position" def={DEFS.rangePos} label="Range Position · session"
        state={rangeState} dir={s.rangePct - 50}
        big={<>{s.rangePct.toFixed(0)}<span className="ana-metric-pct">%</span></>}
        sub="of hi–lo" canvas={rangeCanvas}
        ariaLabel={`Range position ${s.rangePct.toFixed(0)} percent of high-low`}
      />
    </div>
  );
}
