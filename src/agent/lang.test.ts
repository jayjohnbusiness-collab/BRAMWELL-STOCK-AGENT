import { beforeEach, describe, expect, it } from "vitest";
import {
  LANGS,
  detectLang,
  getLang,
  setLang,
  isLangPinned,
  isEnglish,
  langBcp47,
  langName,
  ui,
} from "./lang";

class MemStore {
  private m = new Map<string, string>();
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { this.m.set(k, String(v)); }
  removeItem(k: string) { this.m.delete(k); }
  clear() { this.m.clear(); }
}
(globalThis as unknown as { localStorage: Storage }).localStorage = new MemStore() as unknown as Storage;

describe("language setting", () => {
  beforeEach(() => setLang("auto"));

  it("defaults to English when nothing is pinned", () => {
    expect(isLangPinned()).toBe(false);
    expect(getLang()).toBe("en");
    expect(isEnglish()).toBe(true);
  });

  it("pins and reads back an explicit language", () => {
    setLang("es");
    expect(isLangPinned()).toBe(true);
    expect(getLang()).toBe("es");
    expect(isEnglish()).toBe(false);
    expect(langBcp47()).toBe("es-ES");
  });

  it("clears the pin on auto and falls back to detection", () => {
    setLang("fr");
    expect(getLang()).toBe("fr");
    setLang("auto");
    expect(isLangPinned()).toBe(false);
    expect(getLang()).toBe(detectLang());
  });

  it("ignores an unsupported stored value", () => {
    localStorage.setItem("bramwell.lang", "zz");
    expect(getLang()).toBe("en");
    expect(isLangPinned()).toBe(false);
  });

  it("exposes the six supported languages with valid BCP-47 tags", () => {
    expect(LANGS.map((l) => l.code)).toEqual(["en", "es", "fr", "de", "pt", "it"]);
    for (const l of LANGS) expect(l.bcp47).toMatch(/^[a-z]{2}-[A-Z]{2}$/);
  });

  it("names languages and localizes the voice-surface strings", () => {
    expect(langName("de")).toBe("German");
    expect(ui("en").done).toBe("Done");
    expect(ui("es").listening).toBe("Escuchando");
    expect(ui("fr").done).toBe("Terminé");
  });
});
