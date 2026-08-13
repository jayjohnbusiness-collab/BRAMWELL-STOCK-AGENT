import { describe, it, expect } from "vitest";
import { joinIncome, totalAnnual, incomeWithin, yieldOnValue, nextPayment } from "./income";
import { projectDates, hashPhase } from "./schedule";
import type { DividendInfo } from "../feed/types";

function info(over: Partial<DividendInfo>): DividendInfo {
  return {
    symbol: "AAPL",
    amount: 0.25,
    frequency: 4,
    annualPerShare: 1.0,
    yieldPct: 0.5,
    exDate: "2026-09-01",
    payDate: "2026-09-19",
    estimated: false,
    ...over,
  };
}

describe("dividend income", () => {
  it("joins holdings to payments and yearly income", () => {
    const rows = joinIncome(
      [info({ symbol: "AAPL", amount: 0.25, annualPerShare: 1.0 })],
      [{ symbol: "AAPL", shares: 100, cost: 150 }],
    );
    expect(rows[0].payment).toBeCloseTo(25); // 100 × 0.25
    expect(rows[0].annualIncome).toBeCloseTo(100); // 100 × 1.0
  });

  it("treats a watched-but-unheld payer as zero income", () => {
    const rows = joinIncome([info({ symbol: "MSFT" })], []);
    expect(rows[0].shares).toBe(0);
    expect(rows[0].payment).toBe(0);
  });

  it("sums yearly income across the book", () => {
    const rows = joinIncome(
      [
        info({ symbol: "AAPL", annualPerShare: 1.0 }),
        info({ symbol: "MSFT", annualPerShare: 3.0 }),
      ],
      [
        { symbol: "AAPL", shares: 100, cost: 0 },
        { symbol: "MSFT", shares: 50, cost: 0 },
      ],
    );
    expect(totalAnnual(rows)).toBeCloseTo(100 + 150);
  });

  it("counts only payments whose pay-date is inside the window", () => {
    const now = Date.parse("2026-09-01T00:00:00Z");
    const rows = joinIncome(
      [
        info({ symbol: "AAPL", amount: 1, payDate: "2026-09-10" }), // in 30d
        info({ symbol: "MSFT", amount: 1, payDate: "2026-12-01" }), // out
      ],
      [
        { symbol: "AAPL", shares: 10, cost: 0 },
        { symbol: "MSFT", shares: 10, cost: 0 },
      ],
    );
    expect(incomeWithin(rows, now, 30)).toBeCloseTo(10); // only AAPL
  });

  it("computes yield on market value", () => {
    expect(yieldOnValue(250, 10000)).toBeCloseTo(2.5);
    expect(yieldOnValue(250, 0)).toBe(0);
  });

  it("finds the soonest upcoming payment on a held name", () => {
    const now = Date.parse("2026-09-01T00:00:00Z");
    const rows = joinIncome(
      [
        info({ symbol: "MSFT", payDate: "2026-10-21", amount: 0.8 }),
        info({ symbol: "AAPL", payDate: "2026-09-28", amount: 0.25 }),
        info({ symbol: "JPM", payDate: "2026-08-01", amount: 1 }), // past → skipped
      ],
      [
        { symbol: "MSFT", shares: 10, cost: 0 },
        { symbol: "AAPL", shares: 10, cost: 0 },
        { symbol: "JPM", shares: 10, cost: 0 },
      ],
    );
    const next = nextPayment(rows, now);
    expect(next?.symbol).toBe("AAPL"); // Sep 28 is the soonest future pay-date
  });
});

describe("dividend schedule projection", () => {
  it("projects a future ex-date and a pay-date ~18 days later", () => {
    const now = Date.parse("2026-08-13T00:00:00Z");
    const { exDate, payDate } = projectDates(hashPhase("AAPL"), now);
    expect(exDate >= "2026-08-13").toBe(true);
    expect(Date.parse(`${payDate}T00:00:00Z`)).toBeGreaterThan(Date.parse(`${exDate}T00:00:00Z`));
  });

  it("spreads different symbols onto different phases", () => {
    // Two distinct tickers should (almost always) get different phases.
    expect(hashPhase("AAPL")).not.toBe(hashPhase("JPM"));
  });
});
