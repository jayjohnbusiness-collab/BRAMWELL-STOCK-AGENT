import type { Instrument } from "../agent/types";

/*
 * A deterministic registry for the behavior tests. Shaped so each hard case
 * has something unambiguous to act on:
 *   - SUN / MOON / STAR: a clean one-sector story (all semiconductors).
 *   - BIO: a notable move with NO cause — exercises "no reason for it yet".
 *   - DAL / DLA: a "Delta" collision — exercises the either/or proposal.
 *   - SUN / AUTO / WHEEL are held (the watchlist).
 */
export const FIXTURE: Instrument[] = [
  {
    symbol: "IXIC",
    name: "the Nasdaq",
    kind: "index",
    basePrice: 19_000,
    changePct: 0.6,
    prevChangePct: -0.1,
    cause: null,
  },
  {
    symbol: "SUN",
    name: "Sunrise Micro",
    kind: "equity",
    sector: "semiconductors",
    basePrice: 100,
    changePct: 8.0,
    prevChangePct: 1.0,
    held: true,
    cause: { text: "the move began after Reuters reported a supply agreement", source: "Reuters" },
  },
  {
    symbol: "MOON",
    name: "Moon Systems",
    kind: "equity",
    sector: "semiconductors",
    basePrice: 50,
    changePct: 6.0,
    prevChangePct: 0.4,
    cause: null,
  },
  {
    symbol: "STAR",
    name: "Star Logic",
    kind: "equity",
    sector: "semiconductors",
    basePrice: 75,
    changePct: 5.5,
    prevChangePct: -0.2,
    cause: null,
  },
  {
    symbol: "BIO",
    name: "Biocorp",
    kind: "equity",
    sector: "biotech",
    basePrice: 30,
    changePct: 4.2,
    prevChangePct: -1.0,
    cause: null,
  },
  {
    symbol: "AUTO",
    name: "Autohaus",
    kind: "equity",
    sector: "autos",
    basePrice: 40,
    changePct: -4.0,
    prevChangePct: 0.5,
    held: true,
    cause: { text: "the whole autos group is lower on weaker delivery figures", source: "Bloomberg" },
  },
  {
    symbol: "WHEEL",
    name: "Wheelworks",
    kind: "equity",
    sector: "autos",
    basePrice: 20,
    changePct: -2.0,
    prevChangePct: 0.1,
    held: true,
    cause: null,
  },
  {
    symbol: "DAL",
    name: "Delta Air Lines",
    kind: "equity",
    sector: "airlines",
    basePrice: 60,
    changePct: -1.5,
    prevChangePct: 0.3,
    aliases: ["delta"],
    cause: { text: "airlines are lower on higher fuel costs", source: null },
  },
  {
    symbol: "DLA",
    name: "Delta Apparel",
    kind: "equity",
    sector: "apparel",
    basePrice: 4,
    changePct: 0.5,
    prevChangePct: -0.4,
    aliases: ["delta"],
    cause: null,
  },
];
