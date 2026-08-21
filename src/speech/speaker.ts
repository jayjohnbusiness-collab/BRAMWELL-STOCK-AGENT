/*
 * The speaker Bramwell actually uses: natural ElevenLabs voice when a key is
 * set (Account → Live data), otherwise the browser's built-in voice. If an
 * ElevenLabs request fails (no key, network, quota), it falls back to the
 * browser voice for that line, so Bramwell is never left silent.
 */
import { Voice } from "./synthesis";
import { ElevenVoice, hasEleven } from "./eleven";
import { forSpeech } from "./normalize";
import { isEnglish } from "../agent/lang";

export class Speaker {
  static supported(): boolean {
    // The browser voice needs SpeechSynthesis; ElevenLabs works anywhere fetch +
    // audio do. If neither the built-in voice nor a key is available there's
    // nothing to speak with — but ElevenLabs alone is enough.
    return Voice.supported() || typeof window !== "undefined";
  }

  private web: Voice | null;
  private eleven: ElevenVoice | null = null;

  constructor(private readonly onSpeakingChange?: (speaking: boolean) => void) {
    this.web = Voice.supported() ? new Voice(onSpeakingChange) : null;
  }

  speak(text: string): void {
    if (!text.trim()) return;
    // Expand compact units ("8h 30m" → "8 hours 30 minutes") so whichever engine
    // speaks reads them naturally. The on-screen text keeps its compact form.
    // English only — the expansions are English words, and a translated reply is
    // already spelled out for its own language.
    const spoken = isEnglish() ? forSpeech(text) : text;
    if (hasEleven()) {
      if (!this.eleven) this.eleven = new ElevenVoice(this.onSpeakingChange);
      // Stop the browser voice in case it was mid-line, then speak naturally;
      // fall back to the browser voice if the request fails.
      this.web?.cancel();
      void this.eleven.speak(spoken, () => this.web?.speak(spoken));
    } else {
      this.eleven?.cancel();
      this.web?.speak(spoken);
    }
  }

  /** Unlock audio playback inside a user gesture (autoplay policy). Called when
   * the user enters voice mode, so the ElevenLabs reply can actually play. */
  unlock(): void {
    if (!hasEleven()) return;
    if (!this.eleven) this.eleven = new ElevenVoice(this.onSpeakingChange);
    this.eleven.unlock();
  }

  cancel(): void {
    this.eleven?.cancel();
    this.web?.cancel();
  }
}
