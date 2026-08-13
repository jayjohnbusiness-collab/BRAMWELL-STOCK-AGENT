import { useEffect, useRef, useState } from "react";
import type { CardContext, CardSize } from "../../cards/types";
import type { Candle, ChartRange } from "../../feed/types";
import { priceSeries } from "../../feed/history";
import { exactPercent, formatPrice } from "../../agent/format";
import { cap, Empty } from "./parts";
import "../../styles/chart.css";

const RANGES: ChartRange[] = ["1D", "1W", "1M"];
const HEIGHT: Record<CardSize, number> = { sm: 92, md: 150, lg: 240 };
const STORE_KEY = "bramwell.chart";

/*
 * The price chart card: a line chart for one chosen name over 1D / 1W / 1M.
 *
 * Data honesty: the intraday (1D) line prefers the feed's candles and falls
 * back to the session's own price tape when the feed has no intraday history.
 * The wider ranges need real history — when the data plan doesn't carry it, the
 * card says so rather than drawing an invented line. The simulated feed
 * supplies all three, so the card is fully alive offline.
 */
export function PriceChartCard({ ctx, size }: { ctx: CardContext; size: CardSize }) {
  const held = ctx.market.held();
  const saved = loadChartPrefs();
  const [symbol, setSymbol] = useState<string>(() => saved.symbol ?? held[0]?.symbol ?? "");
  const [range, setRange] = useState<ChartRange>(saved.range ?? "1D");
  const [data, setData] = useState<Candle[] | null | undefined>(undefined);
  const [source, setSource] = useState<"feed" | "tape" | "none">("none");

  // Keep the selected symbol valid as the watchlist changes.
  const active = held.find((i) => i.symbol === symbol) ?? held[0];
  const sym = active?.symbol ?? "";

  useEffect(() => {
    if (!sym) {
      setData(null);
      return;
    }
    saveChartPrefs({ symbol: sym, range });
    let live = true;
    setData(undefined);
    void ctx.candles(sym, range).then((cs) => {
      if (!live) return;
      if (cs && cs.length >= 2) {
        setData(cs);
        setSource("feed");
        return;
      }
      // No feed history. For the intraday range, fall back to the session tape.
      if (range === "1D") {
        const tape = priceSeries(sym).map((p) => ({ t: p.t, c: p.price }));
        if (tape.length >= 2) {
          setData(tape);
          setSource("tape");
          return;
        }
      }
      setData(null);
      setSource("none");
    });
    return () => {
      live = false;
    };
    // ctx is a fresh object each render; candles itself is stable via App refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sym, range, ctx.version]);

  if (held.length === 0) {
    return <Empty>Add a name to your watchlist and I'll chart it here.</Empty>;
  }

  const changePct = active?.changePct ?? 0;
  const tone = changePct > 0.05 ? "up" : changePct < -0.05 ? "down" : "flat";

  return (
    <div className="chart-card">
      <div className="chart-head">
        <div className="chart-pick">
          <select
            className="chart-symbol"
            aria-label="Chart symbol"
            value={sym}
            onChange={(e) => setSymbol(e.target.value)}
          >
            {held.map((i) => (
              <option key={i.symbol} value={i.symbol}>
                {i.symbol}
              </option>
            ))}
          </select>
          {active ? (
            <button
              type="button"
              className="ticker-open chart-name small"
              onClick={() => ctx.openDetail(sym)}
              title={`Open ${sym} details`}
              style={{ background: "none", border: "none", padding: 0, font: "inherit", textAlign: "left", cursor: "pointer" }}
            >
              {cap(active.name)}
            </button>
          ) : null}
        </div>
        {active ? (
          <div className="chart-quote">
            <span className="chart-price tabular">{formatPrice(active.basePrice)}</span>
            <span className={`chg ${tone}`}>{exactPercent(changePct)}</span>
          </div>
        ) : null}
      </div>

      <div className="chart-ranges" role="tablist" aria-label="Chart range">
        {RANGES.map((r) => (
          <button
            key={r}
            type="button"
            role="tab"
            aria-selected={r === range}
            className={`chart-range-btn${r === range ? " on" : ""}`}
            onClick={() => setRange(r)}
          >
            {r}
          </button>
        ))}
      </div>

      <ChartCanvas data={data} tone={tone} height={HEIGHT[size]} range={range} />

      <div className="chart-foot small">
        {data === undefined
          ? "Loading…"
          : data === null
            ? range === "1D"
              ? "Gathering intraday points — the line fills in as prices tick."
              : "Longer history isn't available on this data plan."
            : source === "tape"
              ? "Intraday · this session"
              : rangeLabel(range)}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- Canvas */

interface PlotPoint {
  x: number;
  y: number;
  price: number;
  t: number;
}

function ChartCanvas({
  data,
  tone,
  height,
  range,
}: {
  data: Candle[] | null | undefined;
  tone: "up" | "down" | "flat";
  height: number;
  range: ChartRange;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  // The plotted points in CSS pixels, kept so hover can hit-test and place the
  // crosshair + tooltip without recomputing the projection.
  const geom = useRef<{ pts: PlotPoint[]; cssW: number }>({ pts: [], cssW: 0 });
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const cssW = canvas.clientWidth || 300;
    const cssH = height;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);
    geom.current = { pts: [], cssW };
    if (!data || data.length < 2) return;

    const DAY = 86_400_000;
    const isDay = range === "1D";
    // 1D frames the whole calendar day (local midnight → next midnight) and
    // places each point at its actual time; only today's points are shown.
    const dayStart = isDay ? startOfLocalDay(data[data.length - 1].t) : 0;
    const pd = isDay ? data.filter((d) => d.t >= dayStart && d.t < dayStart + DAY) : data;
    if (pd.length < 2) return;

    const prices = pd.map((d) => d.c);
    let min = Math.min(...prices);
    let max = Math.max(...prices);
    if (max - min < 1e-9) {
      min -= 1;
      max += 1;
    }
    const padX = 4;
    const padTop = 10;
    const showLabels = isDay && cssH >= 118;
    const padBottom = showLabels ? 16 : 10;
    const w = cssW - padX * 2;
    const h = cssH - padTop - padBottom;
    const bottom = cssH - padBottom;
    const y = (v: number) => padTop + (1 - (v - min) / (max - min)) * h;
    const xAt = (d: Candle, i: number) =>
      isDay
        ? padX + Math.min(Math.max((d.t - dayStart) / DAY, 0), 1) * w
        : padX + (i / (pd.length - 1)) * w;

    const pts: PlotPoint[] = pd.map((d, i) => ({ x: xAt(d, i), y: y(d.c), price: d.c, t: d.t }));
    geom.current = { cssW, pts };

    const stroke =
      tone === "down"
        ? cssVar("--data-down", "#b23b3b")
        : tone === "up"
          ? cssVar("--data-up", "#1f7a4d")
          : cssVar("--ink-soft", "#5b6672");

    // 1D: faint gridlines every six hours across the full day, with hour labels.
    if (isDay) {
      ctx.strokeStyle = withAlpha(cssVar("--rule", "#e4e9ef"), 0.8);
      ctx.lineWidth = 1;
      ctx.fillStyle = cssVar("--ink-soft", "#5b6672");
      ctx.font = "10px system-ui, -apple-system, sans-serif";
      ctx.textAlign = "center";
      for (const hr of [0, 6, 12, 18, 24]) {
        const gx = padX + (hr / 24) * w;
        ctx.beginPath();
        ctx.moveTo(gx, padTop);
        ctx.lineTo(gx, bottom);
        ctx.stroke();
        if (showLabels) {
          ctx.fillText(hourLabel(hr), Math.min(Math.max(gx, 12), cssW - 12), cssH - 4);
        }
      }
    }

    // A faint baseline at the first visible price, so the trend reads at a glance.
    ctx.strokeStyle = withAlpha(cssVar("--rule", "#e4e9ef"), 1);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padX, pts[0].y);
    ctx.lineTo(cssW - padX, pts[0].y);
    ctx.setLineDash([3, 3]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Area fill, bounded to where the data actually is.
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.lineTo(pts[pts.length - 1].x, bottom);
    ctx.lineTo(pts[0].x, bottom);
    ctx.closePath();
    ctx.fillStyle = withAlpha(stroke, 0.1);
    ctx.fill();

    // The line.
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.75;
    ctx.lineJoin = "round";
    ctx.stroke();

    // The hover crosshair, or the latest dot when idle.
    const dotAt = hover != null && hover < pts.length ? hover : pts.length - 1;
    if (hover != null && hover < pts.length) {
      const hx = pts[hover].x;
      ctx.strokeStyle = withAlpha(cssVar("--ink-soft", "#5b6672"), 0.5);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(hx, padTop);
      ctx.lineTo(hx, bottom);
      ctx.stroke();
      // A paper-colored ring around the marker so it stands off the line.
      ctx.beginPath();
      ctx.arc(hx, pts[hover].y, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = cssVar("--paper", "#ffffff");
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(pts[dotAt].x, pts[dotAt].y, 3, 0, Math.PI * 2);
    ctx.fillStyle = stroke;
    ctx.fill();
  }, [data, tone, height, hover, range]);

  function onMove(e: React.MouseEvent) {
    const canvas = ref.current;
    const pts = geom.current.pts;
    if (!canvas || pts.length === 0) return;
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < pts.length; i++) {
      const d = Math.abs(pts[i].x - px);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    setHover(best);
  }

  const hp = hover != null ? geom.current.pts[hover] : null;
  const cssW = geom.current.cssW || 300;

  return (
    <div
      className="chart-canvas-wrap"
      style={{ height }}
      onMouseMove={onMove}
      onMouseLeave={() => setHover(null)}
    >
      <canvas ref={ref} className="chart-canvas" aria-hidden="true" />
      {data === null ? <div className="chart-empty small">No line to draw yet.</div> : null}
      {hp ? (
        <div
          className="chart-tip"
          style={{ left: `${Math.min(Math.max(hp.x, 44), cssW - 44)}px` }}
        >
          <span className="chart-tip-price tabular">{formatPrice(hp.price)}</span>
          <span className="chart-tip-time">{fmtTipTime(hp.t, range)}</span>
        </div>
      ) : null}
    </div>
  );
}

/** The hover tooltip's time label: a clock for 1D, a date for wider ranges. */
function fmtTipTime(ms: number, range: ChartRange): string {
  const d = new Date(ms);
  if (range === "1D") {
    return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/* -------------------------------------------------------------- helpers */

function rangeLabel(range: ChartRange): string {
  return range === "1D" ? "Today · 12am–12am" : range === "1W" ? "Past week" : "Past month";
}

/** Local midnight (00:00) of the day the given timestamp falls in. */
function startOfLocalDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Hour-of-day axis label: 0/24 → "12a", 12 → "12p", else "3a"/"9p". */
function hourLabel(h: number): string {
  if (h === 0 || h === 24) return "12a";
  if (h === 12) return "12p";
  return h < 12 ? `${h}a` : `${h - 12}p`;
}

interface ChartPrefs {
  symbol?: string;
  range?: ChartRange;
}

function loadChartPrefs(): ChartPrefs {
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    return raw ? (JSON.parse(raw) as ChartPrefs) : {};
  } catch {
    return {};
  }
}

function saveChartPrefs(p: ChartPrefs): void {
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(p));
  } catch {
    /* storage unavailable — the chart simply forgets the choice */
  }
}

function cssVar(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

function withAlpha(color: string, alpha: number): string {
  const hex = color.match(/^#([0-9a-f]{6})$/i);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
  }
  const rgb = color.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/i);
  if (rgb) return `rgba(${rgb[1]}, ${rgb[2]}, ${rgb[3]}, ${alpha})`;
  return color;
}
