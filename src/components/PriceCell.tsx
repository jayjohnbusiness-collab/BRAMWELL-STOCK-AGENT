import { useEffect, useRef, useState } from "react";
import type { Instrument } from "../agent/types";
import { exactPercent, formatPrice } from "../agent/format";

/*
 * A single price + change, on screen and exact.
 *   - Tabular figures, so digits hold position as they tick.
 *   - Prices cross-fade rather than flash; nothing pulses or counts up.
 *   - Change carries a written sign (+/−) as well as a data color, so it
 *     survives for colorblind users. Green/red live ONLY here.
 */
export function PriceCell({ instrument, day = "today" }: { instrument: Instrument; day?: "today" | "yesterday" }) {
  const change = day === "yesterday" ? instrument.prevChangePct : instrument.changePct;
  const color =
    change > 0 ? "var(--data-up)" : change < 0 ? "var(--data-down)" : "var(--ink-soft)";

  return (
    <span style={{ display: "inline-flex", alignItems: "baseline", gap: "var(--space-3)" }}>
      <CrossfadePrice value={instrument.basePrice} />
      <span className="price tabular" style={{ color, minWidth: "5.5ch", textAlign: "right" }}>
        {exactPercent(change)}
      </span>
    </span>
  );
}

/** Cross-fades on value change: a soft opacity dip, never a color flash. */
function CrossfadePrice({ value }: { value: number }) {
  const [display, setDisplay] = useState(value);
  const [dim, setDim] = useState(false);
  const prev = useRef(value);

  useEffect(() => {
    if (value === prev.current) return;
    prev.current = value;
    setDim(true);
    const t = window.setTimeout(() => {
      setDisplay(value);
      setDim(false);
    }, 120);
    return () => window.clearTimeout(t);
  }, [value]);

  return (
    <span
      className="price tabular"
      style={{
        color: "var(--ink)",
        minWidth: "8ch",
        textAlign: "right",
        opacity: dim ? 0.35 : 1,
        transition: "opacity var(--fade)",
      }}
    >
      {formatPrice(display)}
    </span>
  );
}
