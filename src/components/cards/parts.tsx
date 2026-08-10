import { exactPercent } from "../../agent/format";

/** Small shared bits for card bodies. */

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
