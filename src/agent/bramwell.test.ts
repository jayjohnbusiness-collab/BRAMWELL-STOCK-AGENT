import { describe, it, expect } from "vitest";
import { Bramwell } from "./bramwell";
import { Market } from "./market";
import { FIXTURE } from "../test/fixture";

/*
 * Behavior tests for the butler brain (conversation spec §3–§11). These lock
 * in the voice: an LLM swap behind nlu.ts must keep every one of these green.
 */
function mk() {
  return new Bramwell(new Market(FIXTURE));
}

describe("summaries, not leaderboards (§3)", () => {
  it("names the shape, gives three, and offers the connective tissue", () => {
    const r = mk().respond("Hey Bramwell, what's moving on the Nasdaq today?");
    expect(r.spoken).toContain("Sunrise Micro");
    expect(r.spoken).toContain("carrying it");
    // Top three are all semiconductors → one sector story.
    expect(r.spoken).toMatch(/sector story/i);
    // A summary, not a recital: the fourth name is never read aloud.
    expect(r.spoken).not.toContain("Biocorp");
    expect(r.screen?.kind).toBe("table");
  });

  it("caps the spoken list at three items", () => {
    const r = mk().respond("What's moving today?");
    const named = ["Sunrise Micro", "Moon Systems", "Star Logic", "Biocorp"].filter((n) =>
      r.spoken.includes(n),
    );
    expect(named.length).toBeLessThanOrEqual(3);
  });
});

describe("subject memory across follow-ups (§6)", () => {
  it("holds the universe, then the metric, then narrows to the watchlist", () => {
    const b = mk();
    b.respond("What's moving on the Nasdaq today?");

    const losers = b.respond("What about the losers?");
    expect(losers.spoken).toContain("Autohaus");
    expect(losers.spoken.toLowerCase()).toContain("down");

    const mine = b.respond("Just the ones I hold.");
    expect(mine.spoken).toContain("Autohaus");
    expect(mine.spoken).toContain("Wheelworks");
    // The watchlist losers only — the Delta names are not held.
    expect(mine.spoken).not.toContain("Delta");
  });
});

describe("ticker recognition (§5)", () => {
  it("resolves out loud: says the company, not the symbol", () => {
    const r = mk().respond("How's SUN?");
    expect(r.spoken).toContain("Sunrise Micro");
    expect(r.spoken).toContain("up eight percent");
    expect(r.screen?.kind).toBe("quote");
  });

  it("proposes an either/or on genuine ambiguity, then resolves it", () => {
    const b = mk();
    const ask = b.respond("How's Delta?");
    expect(ask.awaitingChoice).toBe(true);
    expect(ask.spoken).toContain("Delta Air Lines");
    expect(ask.spoken).toContain("Delta Apparel");

    const pick = b.respond("The airline.");
    expect(pick.spoken).toContain("Delta Air Lines");
    expect(pick.spoken.toLowerCase()).toContain("down");
  });
});

describe("day-shift follow-up (§6)", () => {
  it("re-prices the held name for the prior session", () => {
    const b = mk();
    b.respond("How's SUN?");
    const y = b.respond("And yesterday?");
    expect(y.spoken).toContain("Sunrise Micro");
    expect(y.spoken).toContain("yesterday");
    expect(y.spoken).toContain("one percent");
  });

  it("a named instrument with a day word quotes the name, not the held list", () => {
    const b = mk();
    // A prior movers question leaves a list subject (metric = gainers).
    b.respond("What's moving on the Nasdaq today?");
    // Naming an instrument must win over that subject, despite the "today".
    const r = b.respond("How's Sunrise Micro's performance today?");
    expect(r.screen?.kind).toBe("quote");
    expect(r.spoken).toContain("Sunrise Micro");
    expect(r.spoken).not.toMatch(/carrying it/i); // not a movers list
  });
});

describe("conversational depth (category 3)", () => {
  it("catches me up: breadth plus the standout mover each way, with cause", () => {
    const r = mk().respond("catch me up");
    expect(r.spoken.toLowerCase()).toContain("names you follow");
    // SUN is held and up 8% with a Reuters cause; AUTO is held and down 4%.
    expect(r.spoken).toContain("Sunrise Micro");
    expect(r.spoken).toContain("Autohaus");
    expect(r.screen?.kind).toBe("table");
  });

  it("compares two names side by side, naming the stronger", () => {
    const r = mk().respond("Sunrise Micro vs Autohaus");
    expect(r.spoken).toContain("Sunrise Micro");
    expect(r.spoken).toContain("Autohaus");
    expect(r.spoken).toMatch(/better of it/i);
    // SUN (+8%) beats AUTO (−4%).
    expect(r.spoken).toMatch(/Sunrise Micro has the better of it/i);
    expect(r.screen?.kind).toBe("table");
  });

  it("answers a bare 'why?' against the held subject", () => {
    const b = mk();
    b.respond("How's SUN?"); // subject becomes SUN
    const why = b.respond("why?");
    expect(why.spoken).toContain("Sunrise Micro");
    expect(why.spoken.toLowerCase()).toContain("supply agreement"); // its cause
  });

  it("answers 'why is X down?' by naming that instrument's cause", () => {
    const r = mk().respond("why is Autohaus down?");
    expect(r.spoken).toContain("Autohaus");
    expect(r.spoken.toLowerCase()).toContain("delivery"); // autos cause
  });
});

describe("uncertainty is stated, never invented (§7)", () => {
  it("admits it has no cause for a notable move", () => {
    const r = mk().respond("How's Biocorp?");
    expect(r.spoken).toMatch(/don't have a reason/i);
  });
});

describe("requests for advice are declined in character (§8)", () => {
  it("declines, then hands back the facts, with no recommendation", () => {
    const r = mk().respond("Should I buy Autohaus?");
    expect(r.spoken).toMatch(/not mine to say/i);
    expect(r.spoken).toContain("Autohaus");
    expect(r.spoken).not.toMatch(/\byou should\b/i);
    expect(r.spoken).not.toMatch(/recommend/i);
  });
});

describe("failure and scope states (§10)", () => {
  it("declines out-of-scope briefly, without a capability list", () => {
    const r = mk().respond("What's the weather?");
    expect(r.spoken).toMatch(/outside what I follow/i);
  });

  it("repeats what it heard rather than asking to repeat", () => {
    const r = mk().respond("How's Meridian?");
    expect(r.spoken).toContain('I heard "Meridian."');
  });

  it("echoes a lowercase voice mishear that's close to a name", () => {
    // No capital to key off — the resolver's near-miss drives the echo.
    const r = mk().respond("how's biocrop");
    expect(r.spoken).toContain('I heard "Biocrop."');
  });
});

describe("the wake word is acknowledged silently (§2)", () => {
  it("says nothing to a bare wake word", () => {
    const r = mk().respond("Bramwell");
    expect(r.spoken).toBe("");
  });
});
