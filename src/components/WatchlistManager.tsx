import { useEffect, useRef, useState } from "react";
import type { Instrument } from "../agent/types";
import type { CardSize } from "../cards/types";
import { rowLimit } from "../cards/types";
import { PriceCell } from "./PriceCell";

type Suggestion = { symbol: string; name: string };

/*
 * The watchlist body — the one piece of real user state. Editable here or by
 * asking Bramwell ("watch Tesla", "stop watching Apple"); both paths persist.
 * Chromeless: the card frame supplies the title. Size caps how many rows show.
 */
export function WatchlistManager({
  watched,
  onAdd,
  onRemove,
  onSuggest,
  onOpen,
  size = "lg",
}: {
  watched: Instrument[];
  /** Returns a message to show (empty on success). May look a ticker up live. */
  onAdd: (text: string) => Promise<string>;
  onRemove: (symbol: string) => void;
  /** Live typeahead: closest matching tickers for a partial query. */
  onSuggest?: (query: string) => Promise<Suggestion[]>;
  /** Open the detail drawer for a name; makes each row's label clickable. */
  onOpen?: (symbol: string) => void;
  size?: CardSize;
}) {
  const limit = rowLimit(size, { sm: 3, md: 6, lg: 99 });
  const shown = watched.slice(0, limit);
  const hidden = watched.length - shown.length;
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  // The single best live match, shown inline in the field (no dropdown).
  const [top, setTop] = useState<Suggestion | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Guards against out-of-order responses: only the latest query's results win.
  const seq = useRef(0);

  // Debounced best-match as the user types (min 2 chars, ~200ms quiet).
  useEffect(() => {
    const q = value.trim();
    if (!onSuggest || q.length < 2) {
      setTop(null);
      return;
    }
    const mine = ++seq.current;
    const timer = window.setTimeout(async () => {
      const hits = await onSuggest(q);
      if (mine !== seq.current) return; // a newer keystroke has superseded this
      setTop(hits[0] ?? null);
    }, 200);
    return () => window.clearTimeout(timer);
  }, [value, onSuggest]);

  // When the match's symbol continues what's typed, offer the rest as ghost
  // text in the field (e.g. "nv" → "nvDA"). Preserve the user's own casing.
  const trimmed = value.trim();
  const completion =
    top && trimmed.length > 0 && top.symbol.toUpperCase().startsWith(trimmed.toUpperCase())
      ? top.symbol.slice(trimmed.length)
      : "";
  // A name-only match (symbol isn't a prefix, e.g. "apple" → AAPL) shows the
  // ticker as a quiet hint at the right edge instead.
  const hint = top && !completion && trimmed.length > 0 ? top.symbol : "";

  function acceptCompletion() {
    if (!completion) return false;
    setValue(value + completion);
    setTop(null);
    return true;
  }

  async function add(text: string) {
    const t = text.trim();
    if (!t || busy) return;
    seq.current++; // cancel any in-flight suggestion for the old text
    setTop(null);
    setBusy(true);
    setNote("Looking it up…");
    const message = await onAdd(t);
    setBusy(false);
    setNote(message);
    if (!message) setValue("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    // Enter takes the best match when there is one, so the ticker the field is
    // hinting at is exactly what gets added.
    await add(top ? top.symbol : value);
  }

  return (
    <>
      {watched.length === 0 ? (
        <p className="small" style={{ color: "var(--ink-soft)", margin: "0 0 var(--space-3)" }}>
          Nothing on the watch yet. Add a name and I'll keep an eye on it.
        </p>
      ) : (
        <div style={{ marginBottom: "var(--space-4)" }}>
          {shown.map((i) => (
            <div
              key={i.symbol}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "var(--space-4)",
                padding: "var(--space-3) 0",
                borderTop: "var(--hairline) solid var(--rule)",
              }}
            >
              <span style={{ minWidth: 0, display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                <button
                  type="button"
                  className="chip"
                  aria-label={`Stop watching ${i.name}`}
                  title={`Stop watching ${i.name}`}
                  onClick={() => onRemove(i.symbol)}
                  style={{ padding: "0 10px", lineHeight: 1.7 }}
                >
                  ×
                </button>
                {onOpen ? (
                  <button
                    type="button"
                    className="ticker-open"
                    onClick={() => onOpen(i.symbol)}
                    title={`Open ${i.symbol} details`}
                    style={{
                      minWidth: 0,
                      textAlign: "left",
                      background: "none",
                      border: "none",
                      padding: "2px 6px",
                      margin: "-2px -6px",
                      font: "inherit",
                    }}
                  >
                    <span className="label" style={{ color: "var(--ink)", display: "block" }}>
                      {i.symbol}
                    </span>
                    <span className="small" style={{ color: "var(--ink-soft)" }}>
                      {cap(i.name)}
                    </span>
                  </button>
                ) : (
                  <span>
                    <span className="label" style={{ color: "var(--ink)", display: "block" }}>
                      {i.symbol}
                    </span>
                    <span className="small" style={{ color: "var(--ink-soft)" }}>
                      {cap(i.name)}
                    </span>
                  </span>
                )}
              </span>
              <PriceCell instrument={i} />
            </div>
          ))}
          {hidden > 0 ? (
            <p
              className="small"
              style={{
                color: "var(--ink-soft)",
                margin: "var(--space-2) 0 0",
                borderTop: "var(--hairline) solid var(--rule)",
                paddingTop: "var(--space-3)",
              }}
            >
              +{hidden} more — enlarge the card to see {hidden === 1 ? "it" : "them"}.
            </p>
          ) : null}
        </div>
      )}

      <form onSubmit={submit} className="composer-row">
        <div className="typeahead">
          {/* Ghost layer behind the (transparent) input: the typed text is
              invisible here, the completion trails it in muted ink. */}
          <div className="field-ghost" aria-hidden="true">
            <span className="ghost-typed">{value}</span>
            <span className="ghost-rest">{completion}</span>
          </div>
          {hint ? (
            <span className="field-hint" aria-hidden="true">
              {hint}
            </span>
          ) : null}
          <input
            ref={inputRef}
            aria-label="Add a name to the watchlist"
            aria-autocomplete="inline"
            placeholder="Add a name or symbol…"
            value={value}
            disabled={busy}
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => {
              setValue(e.target.value);
              if (note) setNote("");
            }}
            onKeyDown={(e) => {
              // Tab / → (caret at the end) accept the inline completion.
              const el = e.currentTarget;
              const atEnd = el.selectionStart === value.length && el.selectionEnd === value.length;
              if (completion && (e.key === "Tab" || (e.key === "ArrowRight" && atEnd))) {
                e.preventDefault();
                acceptCompletion();
              } else if (e.key === "Escape") {
                setTop(null);
              }
            }}
          />
        </div>
        <button type="submit" className="btn" disabled={busy}>
          {busy ? "…" : "Add"}
        </button>
      </form>
      {note ? (
        <p className="small" style={{ color: "var(--ink-soft)", margin: "var(--space-2) 0 0" }}>
          {note}
        </p>
      ) : null}
    </>
  );
}

function cap(s: string): string {
  const t = s.replace(/^the\s+/i, "");
  return t.charAt(0).toUpperCase() + t.slice(1);
}
