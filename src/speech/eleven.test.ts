import { beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_VOICE,
  elevenKey,
  elevenVoice,
  hasEleven,
  setElevenKey,
  setElevenVoice,
} from "./eleven";

class MemStore {
  private m = new Map<string, string>();
  getItem(k: string) {
    return this.m.has(k) ? this.m.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, String(v));
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
  clear() {
    this.m.clear();
  }
}
(globalThis as unknown as { localStorage: Storage }).localStorage = new MemStore() as unknown as Storage;

describe("eleven config", () => {
  beforeEach(() => localStorage.clear());

  it("is off with no key, and reports the default voice", () => {
    expect(hasEleven()).toBe(false);
    expect(elevenKey()).toBe("");
    expect(elevenVoice()).toBe(DEFAULT_VOICE);
  });

  it("stores and trims a key, turning natural voice on", () => {
    setElevenKey("  sk_abc123  ");
    expect(elevenKey()).toBe("sk_abc123");
    expect(hasEleven()).toBe(true);
  });

  it("clears the key when set empty", () => {
    setElevenKey("sk_abc123");
    setElevenKey("   ");
    expect(hasEleven()).toBe(false);
  });

  it("keeps the default voice unless overridden", () => {
    setElevenVoice("   ");
    expect(elevenVoice()).toBe(DEFAULT_VOICE);
    setElevenVoice("customVoiceId");
    expect(elevenVoice()).toBe("customVoiceId");
  });
});
