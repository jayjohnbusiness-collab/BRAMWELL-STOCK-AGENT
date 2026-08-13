import type { DividendInfo } from "../feed/types";
import type { Position } from "../portfolio/types";

/*
 * Turning dividends into income. Pure and testable: join a company's dividend
 * with what the user holds to get the next payment and the yearly total, then
 * roll those up across the book.
 */

export interface DividendRow extends DividendInfo {
  /** Shares held (0 if the name is watched but not owned). */
  shares: number;
  /** Income from the next payment: shares × amount. */
  payment: number;
  /** Income over a year: shares × annualPerShare. */
  annualIncome: number;
}

/** Join dividend info with positions, newest-payment first (by ex-date). */
export function joinIncome(infos: DividendInfo[], positions: Position[]): DividendRow[] {
  const shares = new Map(positions.map((p) => [p.symbol.toUpperCase(), p.shares]));
  return infos
    .map((info) => {
      const held = shares.get(info.symbol.toUpperCase()) ?? 0;
      return {
        ...info,
        shares: held,
        payment: held * info.amount,
        annualIncome: held * info.annualPerShare,
      };
    })
    .sort((a, b) => a.exDate.localeCompare(b.exDate));
}

/** Total yearly income across held payers. */
export function totalAnnual(rows: DividendRow[]): number {
  return rows.reduce((s, r) => s + r.annualIncome, 0);
}

/** Income from payments whose pay-date falls within `days` of `nowMs`. */
export function incomeWithin(rows: DividendRow[], nowMs: number, days: number): number {
  const end = nowMs + days * 86_400_000;
  return rows.reduce((s, r) => {
    const pay = Date.parse(`${r.payDate}T00:00:00Z`);
    return Number.isFinite(pay) && pay >= nowMs && pay <= end ? s + r.payment : s;
  }, 0);
}

/** Portfolio yield: annual income as a percent of market value. */
export function yieldOnValue(annual: number, marketValue: number): number {
  return marketValue > 0 ? (annual / marketValue) * 100 : 0;
}

/** The soonest upcoming payment on a held name, or null. */
export function nextPayment(rows: DividendRow[], nowMs: number): DividendRow | null {
  const upcoming = rows
    .filter((r) => r.shares > 0 && Date.parse(`${r.payDate}T00:00:00Z`) >= nowMs)
    .sort((a, b) => a.payDate.localeCompare(b.payDate));
  return upcoming[0] ?? null;
}
