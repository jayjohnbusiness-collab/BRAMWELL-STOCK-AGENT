/*
 * A thin wrapper over the browser SpeechSynthesis API.
 *
 * Bramwell's spoken text is already speech-ready (the brain rounds numbers and
 * caps lists), so this only handles delivery: one voice at a time, unhurried
 * and low, cancelable mid-word for barge-in. It matches the voice to the
 * client's language — a calm British voice for English, the best available
 * voice for the tongue otherwise — and falls back gracefully to whatever the
 * browser has.
 */
import { getLang, langBcp47 } from "../agent/lang";

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
    const lang = getLang();
    const two = lang; // our codes are the 2-letter prefix
    if (lang === "en") {
      // The butler's English voice: a calm British male where offered.
      const prefer = ["Daniel", "Arthur", "Google UK English Male", "Oliver"];
      this.voice =
        voices.find((v) => prefer.some((p) => v.name.includes(p))) ??
        voices.find((v) => v.lang === "en-GB") ??
        voices.find((v) => v.lang?.startsWith("en")) ??
        voices[0];
      return;
    }
    // Otherwise the best voice for the chosen tongue, preferring the exact
    // region we recognise in; fall back to any voice for that language.
    const bcp = langBcp47();
    this.voice =
      voices.find((v) => v.lang === bcp) ??
      voices.find((v) => v.lang?.toLowerCase().startsWith(two)) ??
      voices.find((v) => v.lang?.startsWith("en")) ??
      voices[0];
  }

  speak(text: string): void {
    if (!Voice.supported() || !text.trim()) return;
    // The chosen voice can change between lines (the client switched language);
    // re-pick so this line speaks in the right tongue.
    this.pick();
    const synth = window.speechSynthesis;
    synth.cancel(); // one voice; never overlap
    const u = new SpeechSynthesisUtterance(text);
    if (this.voice) u.voice = this.voice;
    u.lang = this.voice?.lang || langBcp47();
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
