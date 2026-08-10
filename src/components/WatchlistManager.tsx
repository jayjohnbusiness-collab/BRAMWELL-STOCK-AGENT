import { useState } from "react";
import type { Instrument } from "../agent/types";
import { PriceCell } from "./PriceCell";

/*
 * The watchlist — the one piece of real user state. Editable here or by asking
 * Bramwell ("watch Tesla", "stop watching Apple"); both paths persist. Kept in
 * the brand's key: hairline rows, ink controls, no data color on furniture.
 */
export function WatchlistManager({
  watched,
  onAdd,
  onRemove,
}: {
  watched: Instrument[];
  /** Returns a message to show (in Bramwell's voice), or "" on success. */
  onAdd: (text: string) => string;
  onRemove: (symbol: string) => void;
}) {
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = value.trim();
    if (!t) return;
    const message = onAdd(t);
    setNote(message);
    if (!message) setValue("");
  }

  return (
    <section aria-label="Watchlist" style={{ marginTop: "var(--space-2)" }}>
      <h2 className="h2" style={{ marginBottom: "var(--space-3)" }}>
        The names you follow
      </h2>

      {watched.length === 0 ? (
        <p className="small" style={{ color: "var(--ink-soft)", margin: "0 0 var(--space-3)" }}>
          Nothing on the watch yet. Add a name and I'll keep an eye on it.
        </p>
      ) : (
        <div style={{ borderBottom: "var(--hairline) solid var(--rule)", marginBottom: "var(--space-4)" }}>
          {watched.map((i) => (
            <div
              key={i.symbol}
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                gap: "var(--space-4)",
                padding: "var(--space-3) 0",
                borderTop: "var(--hairline) solid var(--rule)",
              }}
            >
              <span style={{ minWidth: 0, display: "flex", alignItems: "baseline", gap: "var(--space-3)" }}>
                <button
                  type="button"
                  className="chip"
                  aria-label={`Stop watching ${i.name}`}
                  title={`Stop watching ${i.name}`}
                  onClick={() => onRemove(i.symbol)}
                  style={{ padding: "0 8px", lineHeight: 1.6 }}
                >
                  ×
                </button>
                <span>
                  <span className="label" style={{ color: "var(--ink)", display: "block" }}>
                    {i.symbol}
                  </span>
                  <span className="small" style={{ color: "var(--ink-soft)" }}>
                    {cap(i.name)}
                  </span>
                </span>
              </span>
              <PriceCell instrument={i} />
            </div>
          ))}
        </div>
      )}

      <form onSubmit={submit} className="composer-row">
        <input
          aria-label="Add a name to the watchlist"
          placeholder="Add a name or symbol…"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (note) setNote("");
          }}
        />
        <button type="submit" className="btn">
          Add
        </button>
      </form>
      {note ? (
        <p className="small" style={{ color: "var(--ink-soft)", margin: "var(--space-2) 0 0" }}>
          {note}
        </p>
      ) : null}
    </section>
  );
}

function cap(s: string): string {
  const t = s.replace(/^the\s+/i, "");
  return t.charAt(0).toUpperCase() + t.slice(1);
}
