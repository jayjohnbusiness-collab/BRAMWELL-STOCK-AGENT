import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hasLLMKey, llmKey, setLLMKey, translate } from "./understand";

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

describe("translate — reply localization (BYO key path)", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it("returns English text unchanged for the English target", async () => {
    setLLMKey("sk-ant-x");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    expect(await translate("Your book is up 1.2% today.", "en")).toBe("Your book is up 1.2% today.");
    expect(fetchSpy).not.toHaveBeenCalled(); // English is a no-op, no model call
  });

  it("returns null (English stands) when understanding is off", async () => {
    // no key set → understandingEnabled() is false
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    expect(await translate("Your book is up.", "es")).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("translates to the target language via the model, stripping quotes", async () => {
    setLLMKey("sk-ant-x");
    const fetchSpy = vi.fn(async (_url: string, opts: { body: string }) => {
      const body = JSON.parse(opts.body);
      expect(body.system).toContain("Spanish");
      expect(body.messages[0].content).toBe("Meridian leads, up 3.2%.");
      return new Response(JSON.stringify({ content: [{ text: '"Meridian encabeza, sube 3,2%."' }] }), {
        status: 200,
      });
    });
    vi.stubGlobal("fetch", fetchSpy);
    expect(await translate("Meridian leads, up 3.2%.", "es")).toBe("Meridian encabeza, sube 3,2%.");
    expect(fetchSpy).toHaveBeenCalledOnce();
  });

  it("returns null on an upstream error so the English reply stands", async () => {
    setLLMKey("sk-ant-x");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 500 })));
    expect(await translate("Your book is up.", "fr")).toBeNull();
  });
});
