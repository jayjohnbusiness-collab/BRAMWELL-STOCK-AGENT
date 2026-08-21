import { beforeEach, describe, expect, it } from "vitest";
import { clearLearned, learnedAnswer, learnedCount, normalizeQ, teach } from "./learned";

class MemStore {
  private m = new Map<string, string>();
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { this.m.set(k, String(v)); }
  removeItem(k: string) { this.m.delete(k); }
  clear() { this.m.clear(); }
}
(globalThis as unknown as { localStorage: Storage }).localStorage = new MemStore() as unknown as Storage;

describe("learned answers", () => {
  beforeEach(() => clearLearned());

  it("returns null before anything is taught", () => {
    expect(learnedAnswer("what is the wash sale rule")).toBeNull();
  });

  it("answers the second time after being taught", () => {
    const q = "Bramwell, what's the wash sale rule?";
    expect(learnedAnswer(q)).toBeNull();
    teach(q, "You can't claim a loss if you rebuy within 30 days.");
    expect(learnedAnswer(q)).toBe("You can't claim a loss if you rebuy within 30 days.");
  });

  it("matches despite wake word, case, and punctuation differences", () => {
    teach("What is the PE ratio?", "Price divided by earnings per share.");
    expect(learnedAnswer("hey bramwell what is the pe ratio")).toBe("Price divided by earnings per share.");
    expect(learnedAnswer("what's the PE ratio???")).toBe("Price divided by earnings per share.");
  });

  it("replaces an earlier answer for the same question", () => {
    teach("define beta", "first");
    teach("define beta", "second");
    expect(learnedAnswer("define beta")).toBe("second");
    expect(learnedCount()).toBe(1);
  });

  it("normalizes away polite scaffolding", () => {
    expect(normalizeQ("Bramwell, could you tell me what is the VIX?")).toBe("the vix");
  });
});
