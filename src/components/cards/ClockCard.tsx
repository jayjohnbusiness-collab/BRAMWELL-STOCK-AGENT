import { useEffect, useState } from "react";
import type { CardSize } from "../../cards/types";
import { etParts, marketStatus } from "../../market/hours";

/*
 * A market clock for US hours, computed in America/New_York so it's right
 * wherever the user is. Recognises pre-market and after-hours alongside the
 * regular session. Ticks once a second. Pure client side — no data.
 */
export function ClockCard({ size }: { size: CardSize }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const status = marketStatus(now);
  const et = etParts(now);
  const pillClass = status.phase === "open" ? "open" : status.phase === "closed" ? "closed" : "ext";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
        <span className={`clock-pill ${pillClass}`}>{status.label}</span>
        <span className="small" style={{ color: "var(--ink-soft)" }}>
          {status.detail}
        </span>
      </div>
      {size !== "sm" ? (
        <p className="small tabular" style={{ color: "var(--ink-soft)", margin: 0 }}>
          {et.label} ET · New York
        </p>
      ) : null}
    </div>
  );
}
