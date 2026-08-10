import type { Instrument } from "./types";

/*
 * Seed instruments for the simulated feed.
 *
 * A few deliberate shapes are encoded here so the agent's harder behaviors
 * have something to act on:
 *   - NVDA / PLTR / AVGO: a one-sector story (semiconductors & adjacent).
 *   - MRNA: a real move with NO established cause — exercises "I don't have a
 *     reason for it yet" and keeps it below the unprompted alert bar.
 *   - DAL / DLA: a spoken collision ("Delta") — exercises the proposal path.
 *   - SPX / IXIC: indices, used for the market's overall shape.
 */
export const SEED: Instrument[] = [
  {
    symbol: "IXIC",
    name: "the Nasdaq",
    kind: "index",
    basePrice: 19_650.4,
    changePct: 0.62,
    prevChangePct: -0.18,
    cause: {
      text: "the strength is concentrated in a handful of large semiconductors",
      source: null,
    },
  },
  {
    symbol: "SPX",
    name: "the S&P 500",
    kind: "index",
    basePrice: 6011.3,
    changePct: 0.44,
    prevChangePct: 0.05,
    cause: null,
  },
  {
    symbol: "NVDA",
    name: "NVIDIA",
    kind: "equity",
    sector: "semiconductors",
    basePrice: 181.44,
    changePct: 7.21,
    prevChangePct: 1.02,
    held: true,
    cause: {
      text: "the move began shortly after Reuters reported a Taiwan supply agreement; nothing from the company itself yet",
      source: "Reuters",
    },
  },
  {
    symbol: "PLTR",
    name: "Palantir",
    kind: "equity",
    sector: "software",
    basePrice: 187.22,
    changePct: 9.14,
    prevChangePct: 2.3,
    cause: {
      text: "it is trading with the semiconductor names rather than on any filing of its own",
      source: null,
    },
  },
  {
    symbol: "AVGO",
    name: "Broadcom",
    kind: "equity",
    sector: "semiconductors",
    basePrice: 1_642.1,
    changePct: 4.53,
    prevChangePct: -0.4,
    cause: {
      text: "part of the same sector move; no separate news on the wire",
      source: null,
    },
  },
  {
    symbol: "AAPL",
    name: "Apple",
    kind: "equity",
    sector: "hardware",
    basePrice: 228.09,
    changePct: -1.06,
    prevChangePct: 0.33,
    held: true,
    cause: {
      text: "down with the broader hardware group; no company-specific news",
      source: null,
    },
  },
  {
    symbol: "MSFT",
    name: "Microsoft",
    kind: "equity",
    sector: "software",
    basePrice: 431.6,
    changePct: 0.21,
    prevChangePct: -0.12,
    held: true,
    cause: null,
  },
  {
    symbol: "MRNA",
    name: "Moderna",
    kind: "equity",
    sector: "biotech",
    basePrice: 74.18,
    changePct: 6.4,
    prevChangePct: -2.1,
    // Intentionally no cause: a real move with nothing behind it yet.
    cause: null,
  },
  {
    symbol: "TSLA",
    name: "Tesla",
    kind: "equity",
    sector: "autos",
    basePrice: 254.7,
    changePct: -3.85,
    prevChangePct: 1.4,
    held: true,
    cause: {
      text: "the whole autos group is lower after weaker delivery figures across the sector",
      source: "Bloomberg",
    },
  },
  {
    symbol: "AMD",
    name: "AMD",
    kind: "equity",
    sector: "semiconductors",
    basePrice: 168.9,
    changePct: 3.9,
    prevChangePct: 0.7,
    cause: {
      text: "moving with the rest of the semiconductor group",
      source: null,
    },
  },
  {
    symbol: "DAL",
    name: "Delta Air Lines",
    kind: "equity",
    sector: "airlines",
    basePrice: 61.24,
    changePct: -2.12,
    prevChangePct: 0.5,
    aliases: ["delta"],
    cause: {
      text: "airlines are lower on higher fuel costs",
      source: null,
    },
  },
  {
    symbol: "DLA",
    name: "Delta Apparel",
    kind: "equity",
    sector: "apparel",
    basePrice: 4.31,
    changePct: 1.1,
    prevChangePct: -0.9,
    aliases: ["delta"],
    cause: null,
  },
  {
    symbol: "JPM",
    name: "JPMorgan",
    kind: "equity",
    sector: "banks",
    basePrice: 268.45,
    changePct: 0.88,
    prevChangePct: 0.2,
    cause: null,
  },
];
