/*
 * The speaker Bramwell actually uses: natural ElevenLabs voice when a key is
 * set (Account → Live data), otherwise the browser's built-in voice. If an
 * ElevenLabs request fails (no key, network, quota), it falls back to the
 * browser voice for that line, so Bramwell is never left silent.
 */
import { Voice } from "./synthesis";
import { ElevenVoice, hasEleven } from "./eleven";

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
    if (hasEleven()) {
      if (!this.eleven) this.eleven = new ElevenVoice(this.onSpeakingChange);
      // Stop the browser voice in case it was mid-line, then speak naturally;
      // fall back to the browser voice if the request fails.
      this.web?.cancel();
      void this.eleven.speak(text, () => this.web?.speak(text));
    } else {
      this.eleven?.cancel();
      this.web?.speak(text);
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
