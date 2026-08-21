/*
 * Language — which tongue Bramwell listens and replies in.
 *
 * A small, curated set (the ones browser speech recognition and ElevenLabs
 * both handle well). The choice auto-detects from the device on first run and
 * can be overridden in Account; it is stored as an explicit code, or left unset
 * to mean "follow the device". English is always the safe fallback.
 *
 * This module only holds the SETTING and its metadata. The actual work —
 * transcribing in-language, understanding foreign phrasing, and translating
 * replies — is wired through the recognizer, the speaker, and the Concierge
 * (see understand.ts). When the Concierge is off, non-English speech is still
 * transcribed but can't be understood or translated; the UI says so.
 */

export type LangCode = "en" | "es" | "fr" | "de" | "pt" | "it";

export interface LangDef {
  code: LangCode;
  /** English name, for our own labels. */
  label: string;
  /** Endonym — the language's name in itself, for the picker. */
  native: string;
  /** BCP-47 tag for SpeechRecognition / SpeechSynthesis. */
  bcp47: string;
}

export const LANGS: LangDef[] = [
  { code: "en", label: "English", native: "English", bcp47: "en-US" },
  { code: "es", label: "Spanish", native: "Español", bcp47: "es-ES" },
  { code: "fr", label: "French", native: "Français", bcp47: "fr-FR" },
  { code: "de", label: "German", native: "Deutsch", bcp47: "de-DE" },
  { code: "pt", label: "Portuguese", native: "Português", bcp47: "pt-BR" },
  { code: "it", label: "Italian", native: "Italiano", bcp47: "it-IT" },
];

const KEY = "bramwell.lang";

function isCode(v: string | null | undefined): v is LangCode {
  return !!v && LANGS.some((l) => l.code === v);
}

/** The best-supported language for this device, or English. */
export function detectLang(): LangCode {
  try {
    const nav = navigator as Navigator;
    const tags = nav.languages?.length ? nav.languages : [nav.language];
    for (const tag of tags) {
      const two = (tag || "").slice(0, 2).toLowerCase();
      if (isCode(two)) return two;
    }
  } catch {
    /* no navigator */
  }
  return "en";
}

/** The active language: an explicit override if set, else the device's. */
export function getLang(): LangCode {
  try {
    const v = localStorage.getItem(KEY);
    if (isCode(v)) return v;
  } catch {
    /* private mode */
  }
  return detectLang();
}

/** Set an explicit language, or pass "auto" to follow the device again. */
export function setLang(code: LangCode | "auto"): void {
  try {
    if (code === "auto") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, code);
  } catch {
    /* private mode */
  }
}

/** Whether the user has pinned a language (vs following the device). */
export function isLangPinned(): boolean {
  try {
    return isCode(localStorage.getItem(KEY));
  } catch {
    return false;
  }
}

export function isEnglish(): boolean {
  return getLang() === "en";
}

export function langDef(code: LangCode = getLang()): LangDef {
  return LANGS.find((l) => l.code === code) ?? LANGS[0];
}

export function langBcp47(): string {
  return langDef().bcp47;
}

export function langName(code: LangCode): string {
  return langDef(code).label;
}

/* The few immersive-surface strings Bramwell shows while speaking — kept in
   step with the reply language so the voice mode doesn't read half-English.
   "Bramwell" is a name and never translated. */
type UIStrings = { listening: string; prompt: string; done: string };
const UI: Record<LangCode, UIStrings> = {
  en: { listening: "Listening", prompt: "Listening — just ask your question.", done: "Done" },
  es: { listening: "Escuchando", prompt: "Escuchando — solo haga su pregunta.", done: "Listo" },
  fr: { listening: "À l'écoute", prompt: "À l'écoute — posez simplement votre question.", done: "Terminé" },
  de: { listening: "Höre zu", prompt: "Ich höre zu — stellen Sie einfach Ihre Frage.", done: "Fertig" },
  pt: { listening: "Ouvindo", prompt: "Ouvindo — basta fazer a sua pergunta.", done: "Concluído" },
  it: { listening: "In ascolto", prompt: "In ascolto — faccia pure la sua domanda.", done: "Fatto" },
};

export function ui(code: LangCode = getLang()): UIStrings {
  return UI[code] ?? UI.en;
}
