import type { Instrument } from "../agent/types";
import { PriceCell } from "./PriceCell";

/** One line of the ledger: symbol, name, and the exact price + change. */
export function InstrumentRow({
  instrument,
  day = "today",
  onOpen,
}: {
  instrument: Instrument;
  day?: "today" | "yesterday";
  /** Open the detail drawer for this name; makes the label clickable. */
  onOpen?: (symbol: string) => void;
}) {
  const label = (
    <>
      <span className="label" style={{ color: "var(--ink)", display: "block" }}>
        {instrument.symbol}
      </span>
      <span
        className="small"
        style={{
          color: "var(--ink-soft)",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          display: "block",
        }}
      >
        {cap(instrument.name)}
      </span>
    </>
  );
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "var(--space-4)",
        padding: "var(--space-3) 0",
        borderTop: "var(--hairline) solid var(--rule)",
      }}
    >
      {onOpen ? (
        <button
          type="button"
          className="ticker-open"
          onClick={() => onOpen(instrument.symbol)}
          title={`Open ${instrument.symbol} details`}
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
          {label}
        </button>
      ) : (
        <span style={{ minWidth: 0 }}>{label}</span>
      )}
      <PriceCell instrument={instrument} day={day} />
    </div>
  );
}

function cap(s: string): string {
  const t = s.replace(/^the\s+/i, "");
  return t.charAt(0).toUpperCase() + t.slice(1);
}
