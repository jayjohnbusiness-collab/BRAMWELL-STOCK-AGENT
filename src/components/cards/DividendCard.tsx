import { useEffect, useState } from "react";
import type { CardContext, CardSize } from "../../cards/types";
import { rowLimit } from "../../cards/types";
import type { DividendInfo } from "../../feed/types";
import { joinIncome, totalAnnual, nextPayment, yieldOnValue } from "../../dividend/income";
import { Empty, money } from "./parts";

/*
 * Dividends: what the user's names pay, and what that's worth to them. The next
 * ex-/pay-date and per-share amount for each payer, plus — for the ones held —
 * the income from the next payment and over a year, rolled up into an estimated
 * annual figure and a yield on the book.
 */
export function DividendCard({ ctx, size }: { ctx: CardContext; size: CardSize }) {
  const held = ctx.market.held();
  const positions = ctx.portfolio.all();
  const symbols = Array.from(
    new Set([...held.map((i) => i.symbol), ...positions.map((p) => p.symbol)]),
  );
  const key = symbols.slice().sort().join(",");

  const [infos, setInfos] = useState<DividendInfo[] | null>(null);
  useEffect(() => {
    let live = true;
    setInfos(null);
    void ctx.dividends(symbols).then((d) => {
      if (live) setInfos(d);
    });
    return () => {
      live = false;
    };
    // Refetch only when the set of names changes; amounts/dates don't tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (infos === null) {
    return <Empty>Checking dividends…</Empty>;
  }
  if (infos.length === 0) {
    return <Empty>None of your names pay a dividend just now.</Empty>;
  }

  const rows = joinIncome(infos, positions);
  const annual = totalAnnual(rows);
  const next = nextPayment(rows, Date.now());
  const marketValue = positions.reduce(
    (s, p) => s + p.shares * (ctx.market.bySymbol(p.symbol)?.basePrice ?? 0),
    0,
  );
  const yld = yieldOnValue(annual, marketValue);
  const hasIncome = annual > 0;
  const estimated = rows.some((r) => r.estimated);

  const limit = rowLimit(size, { sm: 3, md: 5, lg: 20 });
  const shown = rows.slice(0, limit);
  const hidden = rows.length - shown.length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
      {hasIncome ? (
        <div className="pf-totals">
          <div className="pf-total">
            <span className="pf-total-num" style={{ color: "var(--data-up)" }}>
              {money(annual)}
            </span>
            <span className="small" style={{ color: "var(--ink-soft)" }}>
              a year, est.
            </span>
          </div>
          <div className="pf-total">
            <span className="pf-total-num">{next ? money(next.payment) : "—"}</span>
            <span className="small" style={{ color: "var(--ink-soft)" }}>
              {next ? `next · ${fmtDate(next.payDate)}` : "next payment"}
            </span>
          </div>
          <div className="pf-total">
            <span className="pf-total-num">{yld.toFixed(2)}%</span>
            <span className="small" style={{ color: "var(--ink-soft)" }}>
              yield on book
            </span>
          </div>
        </div>
      ) : (
        <p className="small" style={{ color: "var(--ink-soft)", margin: 0 }}>
          Record holdings and I'll total the income you're due.
        </p>
      )}

      <div>
        {shown.map((r) => (
          <div key={r.symbol} className="pf-row">
            <button
              type="button"
              className="pf-name"
              title={`Open ${r.symbol} details`}
              onClick={() => ctx.openDetail(r.symbol)}
            >
              <span className="label" style={{ color: "var(--ink)" }}>
                {r.symbol}
              </span>
              <span className="small" style={{ color: "var(--ink-soft)" }}>
                ex {fmtDate(r.exDate)} · pays {fmtDate(r.payDate)}
              </span>
            </button>
            <span className="pf-figures">
              <span className="small tabular" style={{ color: "var(--ink-soft)" }}>
                {money(r.amount)}/sh
              </span>
              {r.shares > 0 ? (
                <span className="price tabular" title="Your next payment">
                  {money(r.payment)}
                </span>
              ) : (
                <span className="small" style={{ color: "var(--ink-soft)" }}>
                  —
                </span>
              )}
            </span>
          </div>
        ))}
        {hidden > 0 ? (
          <p className="small" style={{ color: "var(--ink-soft)", margin: "var(--space-2) 0 0" }}>
            +{hidden} more — enlarge the card to see {hidden === 1 ? "it" : "them"}.
          </p>
        ) : null}
      </div>

      {estimated ? (
        <p className="small" style={{ color: "var(--ink-soft)", margin: 0 }}>
          Dates are estimated from the annual rate.
        </p>
      ) : null}
    </div>
  );
}

/** "Sep 1" from a YYYY-MM-DD string, without a timezone shift. */
function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-").map((n) => parseInt(n, 10));
  if (!y || !m || !d) return iso;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[m - 1]} ${d}`;
}
