import { useEffect, useRef, useState } from "react";
import type { Market } from "../agent/market";
import type { MarketEvent, NewsHeadline, SymbolProfile } from "../feed/types";
import { priceSeries, type Tick } from "../feed/history";
import { getNote, setNote } from "../notes/storage";
import { exactPercent, formatPrice } from "../agent/format";
import { cap } from "./cards/parts";
import "../styles/detail.css";

/*
 * The ticker detail drawer — a slide-in panel from the right that opens when the
 * user clicks any symbol. It shows in one place what's otherwise scattered: the
 * live price and day change, an intraday sparkline (from the session tape), the
 * day and 52-week ranges as bars, key figures, the next earnings date, and the
 * freshest headlines. Everything past price/name is best-effort — the panel
 * shows only what the feed actually returned rather than inventing figures.
 */
export function TickerDetail({
  symbol,
  market,
  loadProfile,
  loadNews,
  loadEvents,
  onSetTargetAlert,
  onClose,
}: {
  symbol: string;
  market: Market;
  loadProfile: (symbol: string) => Promise<SymbolProfile | null>;
  loadNews: (symbol: string) => Promise<NewsHeadline[]>;
  loadEvents: (symbols: string[]) => Promise<MarketEvent[]>;
  /** Turn the saved target price into a standing alert. */
  onSetTargetAlert?: (symbol: string, name: string, target: number) => void;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const inst = market.bySymbol(symbol);
  const [profile, setProfile] = useState<SymbolProfile | null>(null);
  const [news, setNews] = useState<NewsHeadline[] | null>(null);
  const [earn, setEarn] = useState<MarketEvent | null | undefined>(undefined);
  // The user's own note + target for this name.
  const [noteText, setNoteText] = useState("");
  const [targetText, setTargetText] = useState("");
  const [alertMsg, setAlertMsg] = useState("");

  // Focus the close button and wire Escape.
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Pull the fuller snapshot, news, and next earnings when the symbol changes.
  useEffect(() => {
    let live = true;
    setProfile(null);
    setNews(null);
    setEarn(undefined);
    void loadProfile(symbol).then((p) => live && setProfile(p));
    void loadNews(symbol).then((n) => live && setNews(n));
    void loadEvents([symbol]).then((es) => {
      if (!live) return;
      const next = es
        .filter((e) => e.symbol.toUpperCase() === symbol.toUpperCase())
        .sort((a, b) => a.date.localeCompare(b.date))[0];
      setEarn(next ?? null);
    });
    return () => {
      live = false;
    };
  }, [symbol, loadProfile, loadNews, loadEvents]);

  // Load this name's saved note + target when the symbol changes.
  useEffect(() => {
    const n = getNote(symbol);
    setNoteText(n.note ?? "");
    setTargetText(n.target != null ? String(n.target) : "");
    setAlertMsg("");
  }, [symbol]);

  function persistNote() {
    // An empty field clears that part (parseFloat("") is NaN → target removed).
    setNote(symbol, { note: noteText, target: parseFloat(targetText) });
  }

  // Prefer the live registry figures for the headline price (they tick), and
  // fall back to the profile snapshot for anything the registry doesn't carry.
  const name = inst?.name ?? profile?.name ?? symbol;
  const price = inst?.basePrice ?? profile?.price;
  const changePct = inst?.changePct ?? profile?.changePct ?? 0;
  const tone = changePct > 0.05 ? "up" : changePct < -0.05 ? "down" : "flat";

  const series = priceSeries(symbol);

  return (
    <div className="detail-scrim" onClick={onClose}>
      <aside
        className="detail-panel"
        role="dialog"
        aria-modal="true"
        aria-label={`${symbol} detail`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="detail-head">
          <div style={{ minWidth: 0 }}>
            <div className="detail-symbol">{symbol}</div>
            <div className="detail-name">{cap(name)}</div>
          </div>
          <button ref={closeRef} type="button" className="card-x" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </header>

        <div className="detail-price-row">
          <span className="detail-price tabular">
            {price != null ? formatPrice(price) : "—"}
          </span>
          <span className={`chg ${tone}`}>{exactPercent(changePct)}</span>
        </div>

        <Sparkline series={series} tone={tone} />

        <section className="detail-block detail-notes">
          <span className="detail-block-title">Your note & target</span>
          <div className="detail-target-row">
            <label className="detail-target-label">
              Target
              <span className="detail-target-input">
                <span aria-hidden="true">$</span>
                <input
                  inputMode="decimal"
                  placeholder="—"
                  value={targetText}
                  onChange={(e) => setTargetText(e.target.value)}
                  onBlur={persistNote}
                  aria-label="Target price"
                />
              </span>
            </label>
            {onSetTargetAlert && targetNum(targetText) && price != null ? (
              <button
                type="button"
                className="chip"
                onClick={() => {
                  const t = targetNum(targetText)!;
                  persistNote();
                  onSetTargetAlert(symbol, cap(name), t);
                  setAlertMsg(
                    `Alert set — I'll tell you when it ${t >= price ? "reaches" : "drops to"} ${formatPrice(t)}.`,
                  );
                }}
              >
                Set alert at target
              </button>
            ) : null}
          </div>
          {alertMsg ? <p className="detail-muted" style={{ marginTop: "var(--space-2)" }}>{alertMsg}</p> : null}
          <textarea
            className="detail-note-text"
            placeholder="A thesis, a level to watch, a reminder…"
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            onBlur={persistNote}
            aria-label="Note"
            rows={2}
          />
        </section>

        <section className="detail-ranges">
          <RangeBar
            label="Day range"
            low={profile?.low}
            high={profile?.high}
            value={price}
          />
          <RangeBar
            label="52-week range"
            low={profile?.week52Low}
            high={profile?.week52High}
            value={price}
          />
        </section>

        <Stats profile={profile} />

        <section className="detail-block">
          <span className="detail-block-title">Next earnings</span>
          {earn === undefined ? (
            <p className="detail-muted">Checking…</p>
          ) : earn ? (
            <p className="detail-line">
              {formatDate(earn.date)}
              {earn.when ? ` · ${whenLabel(earn.when)}` : ""}
              {" · "}
              <span className="detail-muted">{countdown(earn.date)}</span>
            </p>
          ) : (
            <p className="detail-muted">None on the calendar.</p>
          )}
        </section>

        <section className="detail-block">
          <span className="detail-block-title">Latest news</span>
          {news === null ? (
            <p className="detail-muted">Fetching headlines…</p>
          ) : news.length === 0 ? (
            <p className="detail-muted">Nothing recent on the wire.</p>
          ) : (
            <ul className="detail-news">
              {news.slice(0, 3).map((n, i) => (
                <li key={i}>
                  {n.url ? (
                    <a href={n.url} target="_blank" rel="noreferrer" className="detail-news-head">
                      {n.headline}
                    </a>
                  ) : (
                    <span className="detail-news-head">{n.headline}</span>
                  )}
                  <span className="detail-news-meta">
                    {n.source} · {relTime(n.datetime)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </aside>
    </div>
  );
}

/* ------------------------------------------------------------- Sparkline */

/** An intraday line from the session tape. Too few points → a quiet note. */
function Sparkline({ series, tone }: { series: Tick[]; tone: "up" | "down" | "flat" }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const cssW = canvas.clientWidth || 300;
    const cssH = canvas.clientHeight || 64;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);
    if (series.length < 2) return;

    const prices = series.map((p) => p.price);
    let min = Math.min(...prices);
    let max = Math.max(...prices);
    if (max - min < 1e-9) {
      // A flat line still deserves to sit mid-height rather than clip an edge.
      min -= 1;
      max += 1;
    }
    const pad = 6;
    const w = cssW - pad * 2;
    const h = cssH - pad * 2;
    const x = (i: number) => pad + (i / (series.length - 1)) * w;
    const y = (v: number) => pad + (1 - (v - min) / (max - min)) * h;

    const stroke =
      tone === "down"
        ? cssVar("--data-down", "#b0413e")
        : tone === "up"
          ? cssVar("--data-up", "#3f7d54")
          : cssVar("--ink-soft", "#8a8a8a");

    // A soft fill under the line.
    ctx.beginPath();
    ctx.moveTo(x(0), y(prices[0]));
    for (let i = 1; i < prices.length; i++) ctx.lineTo(x(i), y(prices[i]));
    ctx.lineTo(x(prices.length - 1), cssH - pad);
    ctx.lineTo(x(0), cssH - pad);
    ctx.closePath();
    ctx.fillStyle = withAlpha(stroke, 0.12);
    ctx.fill();

    // The line itself.
    ctx.beginPath();
    ctx.moveTo(x(0), y(prices[0]));
    for (let i = 1; i < prices.length; i++) ctx.lineTo(x(i), y(prices[i]));
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.75;
    ctx.lineJoin = "round";
    ctx.stroke();

    // A dot on the latest point.
    ctx.beginPath();
    ctx.arc(x(prices.length - 1), y(prices[prices.length - 1]), 2.6, 0, Math.PI * 2);
    ctx.fillStyle = stroke;
    ctx.fill();
  }, [series, tone]);

  return (
    <div className="detail-spark">
      <canvas ref={canvasRef} className="detail-spark-canvas" aria-hidden="true" />
      {series.length < 2 ? (
        <p className="detail-spark-note detail-muted">
          Gathering intraday points — the line fills in as prices tick.
        </p>
      ) : (
        <p className="detail-spark-note detail-muted">
          Intraday · this session
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------- Range bar */

/** low ──●── high, with a marker where `value` sits. Hidden if data's missing. */
function RangeBar({
  label,
  low,
  high,
  value,
}: {
  label: string;
  low?: number;
  high?: number;
  value?: number;
}) {
  if (low == null || high == null || high <= low) {
    return (
      <div className="detail-range">
        <div className="detail-range-label">{label}</div>
        <p className="detail-muted" style={{ margin: 0 }}>Not available.</p>
      </div>
    );
  }
  const v = value ?? (low + high) / 2;
  const pct = Math.min(100, Math.max(0, ((v - low) / (high - low)) * 100));
  return (
    <div className="detail-range">
      <div className="detail-range-label">{label}</div>
      <div className="detail-range-track">
        <span className="detail-range-fill" style={{ width: `${pct}%` }} />
        <span className="detail-range-dot" style={{ left: `${pct}%` }} />
      </div>
      <div className="detail-range-ends">
        <span>{formatPrice(low)}</span>
        <span>{formatPrice(high)}</span>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- Stats */

function Stats({ profile }: { profile: SymbolProfile | null }) {
  if (!profile) {
    return (
      <section className="detail-block">
        <span className="detail-block-title">Key figures</span>
        <p className="detail-muted">Loading…</p>
      </section>
    );
  }
  const rows: [string, string | undefined][] = [
    ["Open", profile.open != null ? formatPrice(profile.open) : undefined],
    ["Prev close", profile.prevClose != null ? formatPrice(profile.prevClose) : undefined],
    ["Day high", profile.high != null ? formatPrice(profile.high) : undefined],
    ["Day low", profile.low != null ? formatPrice(profile.low) : undefined],
    ["52-wk high", profile.week52High != null ? formatPrice(profile.week52High) : undefined],
    ["52-wk low", profile.week52Low != null ? formatPrice(profile.week52Low) : undefined],
    ["Market cap", profile.marketCapM != null ? marketCap(profile.marketCapM) : undefined],
  ];
  const present = rows.filter(([, v]) => v != null);
  if (present.length === 0) {
    return (
      <section className="detail-block">
        <span className="detail-block-title">Key figures</span>
        <p className="detail-muted">No figures available.</p>
      </section>
    );
  }
  return (
    <section className="detail-block">
      <span className="detail-block-title">Key figures</span>
      <dl className="detail-stats">
        {present.map(([k, v]) => (
          <div key={k} className="detail-stat">
            <dt>{k}</dt>
            <dd className="tabular">{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/* --------------------------------------------------------------- helpers */

/** A positive finite target from the field, or null. */
function targetNum(text: string): number | null {
  const n = parseFloat(text);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Market cap in millions → "$1.42T" / "$284.0B" / "$620M". */
function marketCap(m: number): string {
  if (m >= 1_000_000) return `$${(m / 1_000_000).toFixed(2)}T`;
  if (m >= 1_000) return `$${(m / 1_000).toFixed(1)}B`;
  return `$${Math.round(m)}M`;
}

function whenLabel(when: "bmo" | "amc" | "dmh"): string {
  return when === "bmo" ? "before the open" : when === "amc" ? "after the close" : "during the day";
}

/** "Aug 21" from a YYYY-MM-DD string, without a timezone shift. */
function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[m - 1]} ${d}`;
}

/** "in 3 days" / "today" from a YYYY-MM-DD date. */
function countdown(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const target = new Date(y, m - 1, d).getTime();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const days = Math.round((target - today) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "tomorrow";
  return `in ${days} days`;
}

/** "12m ago", "3h ago", "yesterday". */
function relTime(ms: number): string {
  const s = Math.max(0, (Date.now() - ms) / 1000);
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  const d = Math.round(s / 86400);
  return d <= 1 ? "yesterday" : `${d}d ago`;
}

/** Read a CSS custom property off :root, with a fallback for canvas strokes. */
function cssVar(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

/** Apply an alpha to a hex or rgb() color for the sparkline fill. */
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
