/*
 * A seeded newsroom for the simulated attributor.
 *
 * Deliberately uneven, so attribution has something honest to do:
 *   - NVDA / PLTR / AVGO / TSLA: major-wire stories → reportable causes.
 *   - AMD: only an aggregator has it → an "unconfirmed" cause.
 *   - MRNA: nothing on the wire, though it moved 6% → attribution returns null,
 *     and Bramwell says he has no reason for it yet.
 */
export interface SeedStory {
  headline: string;
  source: string;
  url?: string;
  /** How long ago it broke, relative to "now" at read time. */
  minutesAgo: number;
}

export const SIM_NEWS: Record<string, SeedStory[]> = {
  NVDA: [
    {
      headline: "Taiwan foundry agrees multi-year supply deal for advanced chips",
      source: "Reuters",
      url: "https://www.reuters.com/technology/",
      minutesAgo: 42,
    },
  ],
  PLTR: [
    {
      headline: "Government software contract said to expand into new agencies",
      source: "Bloomberg",
      url: "https://www.bloomberg.com/technology/",
      minutesAgo: 95,
    },
  ],
  AVGO: [
    {
      headline: "Semiconductor demand outlook lifted across the sector",
      source: "CNBC",
      url: "https://www.cnbc.com/technology/",
      minutesAgo: 180,
    },
  ],
  AMD: [
    {
      headline: "Chip names rally as supply worries ease, traders say",
      source: "Yahoo Finance",
      minutesAgo: 120,
    },
  ],
  TSLA: [
    {
      headline: "Sector delivery figures come in below estimates",
      source: "Bloomberg",
      url: "https://www.bloomberg.com/",
      minutesAgo: 150,
    },
  ],
  // MRNA intentionally absent: a real move with nothing behind it.
};
