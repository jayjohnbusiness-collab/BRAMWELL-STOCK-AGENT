import type { Instrument } from "./types";

/*
 * Seed instruments for the simulated feed — the registry of names Bramwell can
 * resolve and watch, with the shape of the trading day baked in.
 *
 * Causes start null on purpose: a price feed knows the move, not the reason.
 * The attributor supplies causes at runtime from the newsroom (attribution/
 * news.ts), so the demo exercises the real pipeline — including MRNA, which
 * moves 6% with nothing on the wire and so stays uncaused.
 *
 * Deliberate shapes:
 *   - NVDA / PLTR / AVGO / AMD: a one-sector story (semiconductors & adjacent).
 *   - DAL / DLA: a spoken collision ("Delta") — exercises the proposal path.
 *   - SPX / IXIC: indices, for the market's overall shape.
 */
export const SEED: Instrument[] = [
  {
    symbol: "IXIC",
    name: "the Nasdaq",
    kind: "index",
    basePrice: 19_650.4,
    changePct: 0.62,
    prevChangePct: -0.18,
    cause: null,
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
    cause: null,
  },
  {
    symbol: "PLTR",
    name: "Palantir",
    kind: "equity",
    sector: "software",
    basePrice: 187.22,
    changePct: 9.14,
    prevChangePct: 2.3,
    cause: null,
  },
  {
    symbol: "AVGO",
    name: "Broadcom",
    kind: "equity",
    sector: "semiconductors",
    basePrice: 1_642.1,
    changePct: 4.53,
    prevChangePct: -0.4,
    cause: null,
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
    cause: null,
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
    cause: null,
  },
  {
    symbol: "AMD",
    name: "Advanced Micro Devices",
    aliases: ["amd"],
    kind: "equity",
    sector: "semiconductors",
    basePrice: 168.9,
    changePct: 3.9,
    prevChangePct: 0.7,
    cause: null,
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
    cause: null,
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
