/*
 * A thin wrapper over the browser SpeechSynthesis API.
 *
 * Bramwell's spoken text is already speech-ready (the brain rounds numbers and
 * caps lists), so this only handles delivery: one voice at a time, unhurried
 * and low, cancelable mid-word for barge-in. It prefers a calm British voice
 * for the butler and falls back gracefully to whatever the browser has.
 */
export class Voice {
  static supported(): boolean {
    return typeof window !== "undefined" && "speechSynthesis" in window;
  }

  private voice: SpeechSynthesisVoice | null = null;

  constructor(private readonly onSpeakingChange?: (speaking: boolean) => void) {
    if (!Voice.supported()) return;
    this.pick();
    // Voices often load asynchronously; re-pick when they arrive.
    window.speechSynthesis.onvoiceschanged = () => this.pick();
  }

  private pick(): void {
    if (!Voice.supported()) return;
    const voices = window.speechSynthesis.getVoices();
    if (voices.length === 0) return;
    const prefer = ["Daniel", "Arthur", "Google UK English Male", "Oliver"];
    this.voice =
      voices.find((v) => prefer.some((p) => v.name.includes(p))) ??
      voices.find((v) => v.lang === "en-GB") ??
      voices.find((v) => v.lang?.startsWith("en")) ??
      voices[0];
  }

  speak(text: string): void {
    if (!Voice.supported() || !text.trim()) return;
    const synth = window.speechSynthesis;
    synth.cancel(); // one voice; never overlap
    const u = new SpeechSynthesisUtterance(text);
    if (this.voice) u.voice = this.voice;
    u.rate = 0.98; // unhurried
    u.pitch = 0.9; // low, composed
    u.onstart = () => this.onSpeakingChange?.(true);
    u.onend = () => this.onSpeakingChange?.(false);
    // Some engines fire error instead of end on cancel; treat both as "stopped".
    u.onerror = () => this.onSpeakingChange?.(false);
    synth.speak(u);
  }

  cancel(): void {
    if (Voice.supported()) window.speechSynthesis.cancel();
  }
}
