import type { Instrument } from "../agent/types";
import { PriceCell } from "./PriceCell";

/** One line of the ledger: symbol, name, and the exact price + change. */
export function InstrumentRow({
  instrument,
  day = "today",
}: {
  instrument: Instrument;
  day?: "today" | "yesterday";
}) {
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
      <span style={{ minWidth: 0 }}>
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
      </span>
      <PriceCell instrument={instrument} day={day} />
    </div>
  );
}

function cap(s: string): string {
  const t = s.replace(/^the\s+/i, "");
  return t.charAt(0).toUpperCase() + t.slice(1);
}
