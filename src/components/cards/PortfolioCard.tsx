import { useState } from "react";
import type { CardContext, CardSize } from "../../cards/types";
import { rowLimit } from "../../cards/types";
import { valuePosition, portfolioTotals } from "../../portfolio/types";
import { cap, Empty, money, signedMoney, TickNumber } from "./parts";

/*
 * Portfolio: your positions valued live. Shares at an average cost become
 * market value, unrealized P/L, and today's dollar move — per name and in
 * total. Set a position here, or tell Bramwell ("I own 100 NVDA at 150").
 */
export function PortfolioCard({
  ctx,
  size,
  readOnly = false,
}: {
  ctx: CardContext;
  size: CardSize;
  /** A view-only card (no add form, no remove) — editing lives in the Account panel. */
  readOnly?: boolean;
}) {
  const held = ctx.market.held();
  const [symbol, setSymbol] = useState("");
  const [shares, setShares] = useState("");
  const [cost, setCost] = useState("");

  const values = ctx.portfolio
    .all()
    .map((p) => {
      const i = ctx.market.bySymbol(p.symbol);
      return valuePosition(p, {
        price: i?.basePrice ?? 0,
        changePct: i?.changePct ?? 0,
        name: i?.name ?? p.symbol,
      });
    })
    .sort((a, b) => b.marketValue - a.marketValue);
  const totals = portfolioTotals(values);

  const limit = rowLimit(size, { sm: 3, md: 6, lg: 20 });
  const shown = values.slice(0, limit);
  const hidden = values.length - shown.length;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const sym = symbol || held[0]?.symbol;
    const sh = parseFloat(shares);
    if (!sym || !Number.isFinite(sh) || sh <= 0) return;
    // Blank cost → use the current price as the basis (P/L starts at zero).
    const price = ctx.market.bySymbol(sym)?.basePrice ?? 0;
    const c = cost.trim() ? Math.abs(parseFloat(cost)) : price;
    ctx.portfolio.set(sym, sh, Number.isFinite(c) ? c : 0);
    setShares("");
    setCost("");
  }

  function edit(sym: string, sh: number, c: number) {
    setSymbol(sym);
    setShares(String(sh));
    setCost(c ? String(c) : "");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
      {values.length > 0 ? (
        <div className="pf-totals">
          <div className="pf-total">
            <TickNumber className="pf-total-num" value={totals.marketValue}>
              {money(totals.marketValue)}
            </TickNumber>
            <span className="small" style={{ color: "var(--ink-soft)" }}>
              value
            </span>
          </div>
          {totals.hasBasis ? (
            <div className="pf-total">
              <TickNumber className="pf-total-num" value={totals.plAbs} style={{ color: plColor(totals.plAbs) }}>
                {signedMoney(totals.plAbs)}
              </TickNumber>
              <span className="small" style={{ color: "var(--ink-soft)" }}>
                overall ({totals.plPct >= 0 ? "+" : "−"}
                {Math.abs(totals.plPct).toFixed(1)}%)
              </span>
            </div>
          ) : null}
          <div className="pf-total">
            <TickNumber className="pf-total-num" value={totals.dayAbs} style={{ color: plColor(totals.dayAbs) }}>
              {signedMoney(totals.dayAbs)}
            </TickNumber>
            <span className="small" style={{ color: "var(--ink-soft)" }}>
              today
            </span>
          </div>
        </div>
      ) : (
        <Empty>
          {readOnly
            ? 'No positions yet. Add holdings in your Account, or tell me "I own 100 NVDA at 150".'
            : 'No positions yet. Add one below, or tell me "I own 100 NVDA at 150".'}
        </Empty>
      )}

      {shown.length > 0 ? (
        <div>
          {shown.map((v) => (
            <div key={v.symbol} className="pf-row">
              <button
                type="button"
                className="pf-name"
                title={readOnly ? `Open ${v.symbol} details` : "Edit this position"}
                onClick={() =>
                  readOnly ? ctx.openDetail(v.symbol) : edit(v.symbol, v.shares, v.cost)
                }
              >
                <span className="label" style={{ color: "var(--ink)" }}>
                  {v.symbol}
                </span>
                <span className="small" style={{ color: "var(--ink-soft)" }}>
                  {trim(v.shares)} sh{v.hasBasis ? ` @ ${v.cost.toFixed(2)}` : ""}
                </span>
              </button>
              <TickNumber className="pf-figures" value={v.marketValue}>
                {v.hasBasis ? (
                  <span
                    className="small tabular"
                    style={{ color: plColor(v.plAbs), minWidth: "6ch", textAlign: "left" }}
                  >
                    {v.plPct >= 0 ? "+" : "−"}
                    {Math.abs(v.plPct).toFixed(1)}%
                  </span>
                ) : (
                  <span className="small" style={{ color: "var(--ink-soft)" }}>
                    —
                  </span>
                )}
                <span className="price tabular">{money(v.marketValue)}</span>
              </TickNumber>
              {readOnly ? null : (
                <button
                  type="button"
                  className="chip pf-x"
                  aria-label={`Remove ${cap(v.name)} position`}
                  title="Remove"
                  onClick={() => ctx.portfolio.remove(v.symbol)}
                >
                  ×
                </button>
              )}
            </div>
          ))}
          {hidden > 0 ? (
            <p className="small" style={{ color: "var(--ink-soft)", margin: "var(--space-2) 0 0" }}>
              +{hidden} more — enlarge the card to see {hidden === 1 ? "it" : "them"}.
            </p>
          ) : null}
        </div>
      ) : null}

      {readOnly ? (
        <button type="button" className="chip manage-link" onClick={ctx.openAccount}>
          Manage in Account
        </button>
      ) : held.length === 0 ? (
        <p className="small" style={{ color: "var(--ink-soft)", margin: 0 }}>
          Add a name to your watchlist first, then record what you hold.
        </p>
      ) : (
        <form onSubmit={submit} className="pf-add">
          <select
            aria-label="Name"
            value={symbol || held[0]?.symbol}
            onChange={(e) => setSymbol(e.target.value)}
          >
            {held.map((i) => (
              <option key={i.symbol} value={i.symbol}>
                {i.symbol}
              </option>
            ))}
          </select>
          <input
            aria-label="Shares"
            inputMode="decimal"
            placeholder="shares"
            value={shares}
            onChange={(e) => setShares(e.target.value)}
          />
          <input
            aria-label="Average cost"
            inputMode="decimal"
            placeholder="avg cost"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
          />
          <button type="submit" className="btn">
            Save
          </button>
        </form>
      )}
    </div>
  );
}

function plColor(n: number): string {
  return n > 0 ? "var(--data-up)" : n < 0 ? "var(--data-down)" : "var(--ink)";
}

function trim(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(4)));
}
