/*
 * Positions — turning the watchlist into a book.
 *
 * A position is shares of a name at an average cost. Valued against the live
 * price, it yields market value, unrealized P/L, and today's dollar change.
 * All pure and testable; no prices are stored, only what the user owns.
 */

export interface Position {
  symbol: string;
  shares: number;
  /** Average cost per share. 0 means "basis unknown". */
  cost: number;
}

export interface PositionValue {
  symbol: string;
  name: string;
  shares: number;
  cost: number;
  price: number;
  marketValue: number;
  costValue: number;
  /** Unrealized gain/loss in dollars and percent (percent is 0 when basis unknown). */
  plAbs: number;
  plPct: number;
  hasBasis: boolean;
  /** Today's change in dollars for this holding. */
  dayAbs: number;
}

export interface PortfolioTotals {
  marketValue: number;
  costValue: number;
  plAbs: number;
  plPct: number;
  hasBasis: boolean;
  dayAbs: number;
}

export function valuePosition(
  p: Position,
  q: { price: number; changePct: number; name: string },
): PositionValue {
  const price = q.price;
  const marketValue = p.shares * price;
  const hasBasis = p.cost > 0;
  const costValue = p.shares * p.cost;
  const plAbs = hasBasis ? marketValue - costValue : 0;
  const plPct = hasBasis ? ((price - p.cost) / p.cost) * 100 : 0;
  // Back out the prior close from today's percent change to get the $ move.
  const prevClose = q.changePct > -100 ? price / (1 + q.changePct / 100) : price;
  const dayAbs = p.shares * (price - prevClose);
  return {
    symbol: p.symbol,
    name: q.name,
    shares: p.shares,
    cost: p.cost,
    price,
    marketValue,
    costValue,
    plAbs,
    plPct,
    hasBasis,
    dayAbs,
  };
}

export function portfolioTotals(values: PositionValue[]): PortfolioTotals {
  const marketValue = values.reduce((s, v) => s + v.marketValue, 0);
  const costValue = values.reduce((s, v) => s + (v.hasBasis ? v.costValue : 0), 0);
  const dayAbs = values.reduce((s, v) => s + v.dayAbs, 0);
  const hasBasis = values.some((v) => v.hasBasis);
  const plAbs = marketValue - values.reduce((s, v) => s + (v.hasBasis ? v.costValue : v.marketValue), 0);
  const plPct = costValue > 0 ? (plAbs / costValue) * 100 : 0;
  return { marketValue, costValue, plAbs, plPct, hasBasis, dayAbs };
}
