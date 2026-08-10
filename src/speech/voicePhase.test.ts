import { describe, it, expect } from "vitest";
import { voicePhase } from "./voicePhase";

describe("voicePhase priority", () => {
  const base = { speaking: false, working: false, listening: false };

  it("speaking wins over everything", () => {
    expect(voicePhase({ speaking: true, working: true, listening: true })).toBe("speaking");
  });
  it("working beats listening", () => {
    expect(voicePhase({ ...base, working: true, listening: true })).toBe("working");
  });
  it("listening when only listening", () => {
    expect(voicePhase({ ...base, listening: true })).toBe("listening");
  });
  it("idle when nothing is active", () => {
    expect(voicePhase(base)).toBe("idle");
  });
});
