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

/** The reason the last ElevenLabs attempt fell back to the browser voice, for
 * diagnostics (surfaced by the Account panel's "Test" button). "" = no failure. */
let lastError = "";
export function elevenLastError(): string {
  return lastError;
}

/**
 * Speaks one line at a time via ElevenLabs, cancelable mid-word for barge-in.
 * Mirrors the Voice interface (speak/cancel + a speaking callback). On any
 * failure it records why and calls onFail so the caller can fall back.
 *
 * Playback goes through the Web Audio API, not an <audio> element. A reply is
 * spoken from a speech-recognition callback — not a direct click — so the
 * browser's autoplay policy blocks a bare Audio.play(); an AudioContext that was
 * resumed inside the user's tap (unlock(), called when voice mode is entered)
 * stays allowed to play afterwards. Without this the natural voice silently fell
 * back to the browser voice every time.
 */
export class ElevenVoice {
  private ctx: AudioContext | null = null;
  private src: AudioBufferSourceNode | null = null;
  private abort: AbortController | null = null;
  private gen = 0; // bumped to supersede an in-flight request

  constructor(private readonly onSpeakingChange?: (speaking: boolean) => void) {}

  private audioCtx(): AudioContext | null {
    if (this.ctx) return this.ctx;
    const AC =
      typeof window !== "undefined"
        ? window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
        : undefined;
    if (!AC) return null;
    try {
      this.ctx = new AC();
    } catch {
      return null;
    }
    return this.ctx;
  }

  /** Resume the audio context inside a user gesture so later playback is allowed. */
  unlock(): void {
    const ctx = this.audioCtx();
    if (!ctx) return;
    if (ctx.state === "suspended") void ctx.resume();
    // A one-sample silent blip fully satisfies stricter policies (iOS Safari).
    try {
      const b = ctx.createBuffer(1, 1, 22050);
      const s = ctx.createBufferSource();
      s.buffer = b;
      s.connect(ctx.destination);
      s.start(0);
    } catch {
      /* ignore */
    }
  }

  async speak(text: string, onFail?: () => void): Promise<void> {
    const t = text.trim();
    if (!t) return;
    this.cancel();
    const key = elevenKey();
    if (!key) {
      lastError = "No API key set.";
      onFail?.();
      return;
    }
    const ctx = this.audioCtx();
    if (!ctx) {
      lastError = "Web Audio isn't available in this browser.";
      onFail?.();
      return;
    }
    if (ctx.state === "suspended") {
      try {
        await ctx.resume();
      } catch {
        /* played later may still work */
      }
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
            voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0, use_speaker_boost: true },
          }),
          signal: abort.signal,
        },
      );
      if (my !== this.gen) return; // superseded while awaiting
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        lastError =
          res.status === 401
            ? "Key rejected (401). Check the ElevenLabs API key."
            : `ElevenLabs error ${res.status}. ${body.slice(0, 120)}`;
        onFail?.();
        return;
      }
      const bytes = await res.arrayBuffer();
      if (my !== this.gen) return;
      const buffer = await ctx.decodeAudioData(bytes);
      if (my !== this.gen) return;
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(ctx.destination);
      this.src = src;
      src.onended = () => {
        if (this.src === src) {
          this.src = null;
          this.onSpeakingChange?.(false);
        }
      };
      this.onSpeakingChange?.(true);
      src.start(0);
      lastError = "";
    } catch (e) {
      if ((e as { name?: string })?.name === "AbortError") return;
      lastError = String((e as { message?: string })?.message || e);
      onFail?.();
    }
  }

  cancel(): void {
    this.gen++; // any in-flight request/response is now stale
    this.abort?.abort();
    this.abort = null;
    if (this.src) {
      try {
        this.src.stop();
      } catch {
        /* already stopped */
      }
      try {
        this.src.disconnect();
      } catch {
        /* ignore */
      }
      this.src = null;
    }
    this.onSpeakingChange?.(false);
  }
}
