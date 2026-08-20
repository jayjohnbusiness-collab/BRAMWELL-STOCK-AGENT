/*
 * ElevenLabs text-to-speech — a natural neural voice for Bramwell.
 *
 * The key and chosen voice live only in this browser (localStorage), entered in
 * Account → Live data, exactly like the Finnhub key. NEVER hard-code a key here.
 * This is a soft client-side setup: the key is readable in the bundle, so use a
 * TTS-only key with a spend cap. A production Concierge tier proxies this
 * server-side.
 *
 * When no key is set, Bramwell falls back to the browser's built-in voice.
 */

const KEY = "bramwell.elevenlabs.key";
const VOICE = "bramwell.elevenlabs.voice";
/** "George" — a warm, composed British voice; a fitting butler default. */
export const DEFAULT_VOICE = "JBFqnCBsd6RMkjVDRZzb";

export function elevenKey(): string {
  try {
    return localStorage.getItem(KEY)?.trim() ?? "";
  } catch {
    return "";
  }
}

export function elevenVoice(): string {
  try {
    return localStorage.getItem(VOICE)?.trim() || DEFAULT_VOICE;
  } catch {
    return DEFAULT_VOICE;
  }
}

export function hasEleven(): boolean {
  return elevenKey().length > 0;
}

export function setElevenKey(k: string): void {
  try {
    const v = k.trim();
    if (v) localStorage.setItem(KEY, v);
    else localStorage.removeItem(KEY);
  } catch {
    /* private mode */
  }
}

export function setElevenVoice(v: string): void {
  try {
    const s = v.trim();
    if (s) localStorage.setItem(VOICE, s);
    else localStorage.removeItem(VOICE);
  } catch {
    /* private mode */
  }
}

/**
 * Speaks one line at a time via ElevenLabs, cancelable mid-word for barge-in.
 * Mirrors the Voice interface (speak/cancel + a speaking callback). On any
 * failure it calls onFail so the caller can fall back to the browser voice.
 */
export class ElevenVoice {
  private audio: HTMLAudioElement | null = null;
  private abort: AbortController | null = null;
  private gen = 0; // bumped to supersede an in-flight request

  constructor(private readonly onSpeakingChange?: (speaking: boolean) => void) {}

  async speak(text: string, onFail?: () => void): Promise<void> {
    const t = text.trim();
    if (!t) return;
    this.cancel();
    const key = elevenKey();
    if (!key) {
      onFail?.();
      return;
    }
    const my = ++this.gen;
    const abort = new AbortController();
    this.abort = abort;
    try {
      const res = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${elevenVoice()}?output_format=mp3_44100_128`,
        {
          method: "POST",
          headers: {
            "xi-api-key": key,
            "Content-Type": "application/json",
            Accept: "audio/mpeg",
          },
          body: JSON.stringify({
            text: t,
            model_id: "eleven_turbo_v2_5",
            voice_settings: {
              stability: 0.45,
              similarity_boost: 0.8,
              style: 0,
              use_speaker_boost: true,
            },
          }),
          signal: abort.signal,
        },
      );
      if (my !== this.gen) return; // superseded while awaiting
      if (!res.ok) {
        onFail?.();
        return;
      }
      const url = URL.createObjectURL(await res.blob());
      if (my !== this.gen) {
        URL.revokeObjectURL(url);
        return;
      }
      const a = new Audio(url);
      this.audio = a;
      const done = () => {
        this.onSpeakingChange?.(false);
        URL.revokeObjectURL(url);
      };
      a.onplay = () => this.onSpeakingChange?.(true);
      a.onended = done;
      a.onerror = done;
      await a.play().catch(() => {
        done();
        onFail?.();
      });
    } catch (e) {
      if ((e as { name?: string })?.name === "AbortError") return;
      onFail?.();
    }
  }

  cancel(): void {
    this.gen++; // any in-flight request/response is now stale
    this.abort?.abort();
    this.abort = null;
    if (this.audio) {
      this.audio.pause();
      this.audio.src = "";
      this.audio = null;
    }
    this.onSpeakingChange?.(false);
  }
}
