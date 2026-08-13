import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { exactPercent } from "../../agent/format";

/** Small shared bits for card bodies. */

/*
 * A value that flashes on each update — green on an up-tick, red on a down-tick,
 * like a trading terminal. The flash direction follows whether `value` rose or
 * fell since the last render, independent of the number's own sign, so a name at
 * a loss still flashes green when its price ticks up. Reduced motion skips it.
 */
export function TickNumber({
  value,
  className,
  style,
  children,
}: {
  value: number;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const prev = useRef(value);
  useEffect(() => {
    const delta = value - prev.current;
    prev.current = value;
    const el = ref.current;
    if (!el || Math.abs(delta) < 1e-9) return;
    // Restart the one-shot flash animation from the top.
    el.classList.remove("tick-up", "tick-down");
    void el.offsetWidth;
    el.classList.add(delta > 0 ? "tick-up" : "tick-down");
  }, [value]);
  return (
    <span ref={ref} className={`tick${className ? ` ${className}` : ""}`} style={style}>
      {children}
    </span>
  );
}

export function cap(s: string): string {
  const t = s.replace(/^the\s+/i, "");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="small" style={{ color: "var(--ink-soft)", margin: 0 }}>
      {children}
    </p>
  );
}

/** A compact ± percent pill, matching the watchlist's change styling. */
export function ChangePill({ pct }: { pct: number }) {
  const dir = pct > 0.005 ? "up" : pct < -0.005 ? "down" : "flat";
  return <span className={`chg ${dir}`}>{exactPercent(pct)}</span>;
}

/** "$1,234.56" (whole dollars once it's four figures). */
export function money(n: number): string {
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: Math.abs(n) >= 1000 ? 0 : 2,
  });
}

/** "+$1,234" / "−$1,234", using a real minus sign. */
export function signedMoney(n: number): string {
  return `${n >= 0 ? "+" : "−"}${money(Math.abs(n))}`;
}
