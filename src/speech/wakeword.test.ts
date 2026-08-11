import { describe, it, expect } from "vitest";
import { detectWake } from "./wakeword";

describe("wake-word detection (§2)", () => {
  it("wakes on 'Hey Bramwell' and returns the command", () => {
    const r = detectWake("Hey Bramwell, what's moving today?");
    expect(r.woke).toBe(true);
    expect(r.command).toBe("what's moving today?");
  });

  it("accepts a bare 'Bramwell' with no command (silent, awaiting)", () => {
    const r = detectWake("Bramwell");
    expect(r.woke).toBe(true);
    expect(r.command).toBe("");
  });

  it("rejects 'Bram' alone — not enough separation", () => {
    expect(detectWake("Bram").woke).toBe(false);
    expect(detectWake("bramble jam").woke).toBe(false);
  });

  it("does not wake on ordinary speech, and passes it through", () => {
    const r = detectWake("what's moving today?");
    expect(r.woke).toBe(false);
    expect(r.command).toBe("what's moving today?");
  });

  it("tolerates a leading 'ok' and punctuation", () => {
    expect(detectWake("ok Bramwell how's NVDA").command).toBe("how's NVDA");
    expect(detectWake("Bramwell — losers?").command).toBe("losers?");
  });

  it("accepts the common mishearings of the name", () => {
    // Recognizers routinely hear "Bramwell" as one of these.
    expect(detectWake("well's, how's NVDA").woke).toBe(true);
    expect(detectWake("well's, how's NVDA").command).toBe("how's NVDA");
    expect(detectWake("wells what's moving").woke).toBe(true);
    expect(detectWake("bram well losers?").woke).toBe(true);
    expect(detectWake("bram well losers?").command).toBe("losers?");
    expect(detectWake("bramwells").woke).toBe(true);
    expect(detectWake("hey well's").woke).toBe(true);
  });

  it("still rejects a bare 'well' — too common a word to be a wake", () => {
    expect(detectWake("well done").woke).toBe(false);
    expect(detectWake("well, that's interesting").woke).toBe(false);
    expect(detectWake("well").woke).toBe(false);
  });
});
