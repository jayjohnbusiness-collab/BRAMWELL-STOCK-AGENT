import { beforeEach, describe, expect, it } from "vitest";
import { hasLLMKey, llmKey, setLLMKey } from "./understand";

class MemStore {
  private m = new Map<string, string>();
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { this.m.set(k, String(v)); }
  removeItem(k: string) { this.m.delete(k); }
  clear() { this.m.clear(); }
}
(globalThis as unknown as { localStorage: Storage }).localStorage = new MemStore() as unknown as Storage;

describe("understand — key config", () => {
  beforeEach(() => localStorage.clear());

  it("is off with no key", () => {
    expect(hasLLMKey()).toBe(false);
    expect(llmKey()).toBe("");
  });

  it("stores and trims a key, turning understanding on", () => {
    setLLMKey("  sk-ant-abc123  ");
    expect(llmKey()).toBe("sk-ant-abc123");
    expect(hasLLMKey()).toBe(true);
  });

  it("clears the key when set empty", () => {
    setLLMKey("sk-ant-abc123");
    setLLMKey("  ");
    expect(hasLLMKey()).toBe(false);
  });
});
