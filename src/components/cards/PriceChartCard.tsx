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
          {active ? <span className="chart-name small">{cap(active.name)}</span> : null}
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

      <ChartCanvas data={data} tone={tone} height={HEIGHT[size]} />

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

function ChartCanvas({
  data,
  tone,
  height,
}: {
  data: Candle[] | null | undefined;
  tone: "up" | "down" | "flat";
  height: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

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
    if (!data || data.length < 2) return;

    const prices = data.map((d) => d.c);
    let min = Math.min(...prices);
    let max = Math.max(...prices);
    if (max - min < 1e-9) {
      min -= 1;
      max += 1;
    }
    const padX = 4;
    const padY = 10;
    const w = cssW - padX * 2;
    const h = cssH - padY * 2;
    const x = (i: number) => padX + (i / (prices.length - 1)) * w;
    const y = (v: number) => padY + (1 - (v - min) / (max - min)) * h;

    const stroke =
      tone === "down"
        ? cssVar("--data-down", "#b23b3b")
        : tone === "up"
          ? cssVar("--data-up", "#1f7a4d")
          : cssVar("--ink-soft", "#5b6672");

    // A faint baseline at the first price, so the trend reads at a glance.
    ctx.strokeStyle = withAlpha(cssVar("--rule", "#e4e9ef"), 1);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padX, y(prices[0]));
    ctx.lineTo(cssW - padX, y(prices[0]));
    ctx.setLineDash([3, 3]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Area fill.
    ctx.beginPath();
    ctx.moveTo(x(0), y(prices[0]));
    for (let i = 1; i < prices.length; i++) ctx.lineTo(x(i), y(prices[i]));
    ctx.lineTo(x(prices.length - 1), cssH - padY);
    ctx.lineTo(x(0), cssH - padY);
    ctx.closePath();
    ctx.fillStyle = withAlpha(stroke, 0.1);
    ctx.fill();

    // The line.
    ctx.beginPath();
    ctx.moveTo(x(0), y(prices[0]));
    for (let i = 1; i < prices.length; i++) ctx.lineTo(x(i), y(prices[i]));
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.75;
    ctx.lineJoin = "round";
    ctx.stroke();

    // Latest dot.
    ctx.beginPath();
    ctx.arc(x(prices.length - 1), y(prices[prices.length - 1]), 2.6, 0, Math.PI * 2);
    ctx.fillStyle = stroke;
    ctx.fill();
  }, [data, tone, height]);

  return (
    <div className="chart-canvas-wrap" style={{ height }}>
      <canvas ref={ref} className="chart-canvas" aria-hidden="true" />
      {data === null ? <div className="chart-empty small">No line to draw yet.</div> : null}
    </div>
  );
}

/* -------------------------------------------------------------- helpers */

function rangeLabel(range: ChartRange): string {
  return range === "1D" ? "Past day" : range === "1W" ? "Past week" : "Past month";
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
