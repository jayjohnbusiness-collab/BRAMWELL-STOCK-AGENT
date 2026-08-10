import { detectWake } from "./wakeword";

/*
 * A thin wrapper over the browser SpeechRecognition API.
 *
 * It listens continuously and only surfaces a command when Bramwell was
 * addressed: on the wake word, or during the short follow-up window that
 * stays open after an exchange (so "and yesterday?" works without saying his
 * name again). It never chimes on wake — acknowledgement is a silent state
 * change (onListeningChange). onSpeechStart is the barge-in signal.
 *
 * The Web Speech types aren't in the standard DOM lib, so the vendor surface
 * is reached through `any` and kept entirely inside this file.
 */
export interface RecognizerHandlers {
  onCommand: (text: string) => void;
  onListeningChange?: (listening: boolean) => void;
  /** Live, not-yet-final transcript — for the voice surface to show. */
  onInterim?: (text: string) => void;
  /** Fires the instant the user starts speaking — used to stop Bramwell. */
  onSpeechStart?: () => void;
  onError?: (error: string) => void;
}

export class Recognizer {
  /** Whether this browser exposes SpeechRecognition at all. */
  static supported(): boolean {
    if (typeof window === "undefined") return false;
    const w = window as unknown as Record<string, unknown>;
    return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
  }

  private rec: any = null;
  private running = false;
  private primed = false;
  private idle: number | undefined;
  private readonly followupMs = 12_000;
  private readonly requireWake: boolean;

  constructor(
    private readonly h: RecognizerHandlers,
    opts: { requireWake?: boolean } = {},
  ) {
    // In the always-listening ambient case the wake word gates commands. In
    // explicit voice mode the user has already addressed Bramwell by entering
    // it, so every utterance is a command (a leading wake word is just stripped).
    this.requireWake = opts.requireWake ?? true;
  }

  start(): void {
    if (this.running) return;
    const w = window as unknown as Record<string, unknown>;
    const Ctor = (w.SpeechRecognition || w.webkitSpeechRecognition) as
      | (new () => any)
      | undefined;
    if (!Ctor) {
      this.h.onError?.("unsupported");
      return;
    }
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true; // needed for the live transcript on the surface
    rec.lang = "en-US";
    rec.onspeechstart = () => this.h.onSpeechStart?.();
    rec.onresult = (ev: any) => {
      const result = ev.results?.[ev.results.length - 1];
      const transcript: string = result?.[0]?.transcript ?? "";
      if (!result?.isFinal) {
        if (transcript.trim()) this.h.onInterim?.(transcript);
        return;
      }
      if (transcript.trim()) this.handle(transcript);
    };
    rec.onerror = (ev: any) => {
      // Silence and aborts are normal in continuous mode; ignore them.
      if (ev?.error && ev.error !== "no-speech" && ev.error !== "aborted") {
        this.h.onError?.(String(ev.error));
      }
    };
    rec.onend = () => {
      // Keep the mic open across the browser's automatic stops.
      if (this.running) {
        try {
          rec.start();
        } catch {
          /* already starting */
        }
      }
    };
    this.rec = rec;
    this.running = true;
    // Voice mode is active the moment the mic is on — reflect it immediately.
    if (!this.requireWake) this.h.onListeningChange?.(true);
    try {
      rec.start();
    } catch {
      /* start races are harmless */
    }
  }

  stop(): void {
    this.running = false;
    this.clearPrimed();
    if (this.idle) window.clearTimeout(this.idle);
    try {
      this.rec?.stop();
    } catch {
      /* nothing to stop */
    }
  }

  private handle(transcript: string): void {
    const { woke, command } = detectWake(transcript);

    if (!this.requireWake) {
      // Every utterance is a command; strip a leading wake word if present.
      const text = woke ? command : transcript;
      if (text.trim()) this.h.onCommand(text);
      return;
    }

    if (woke) {
      if (command) this.deliver(command);
      else this.open(); // silent acknowledgement; await the command
      return;
    }
    // Not the wake word: only a command if the follow-up window is open.
    if (this.primed) this.deliver(transcript);
  }

  private open(): void {
    this.primed = true;
    this.h.onListeningChange?.(true);
    this.resetIdle();
  }

  private deliver(command: string): void {
    this.open();
    this.h.onCommand(command);
  }

  private resetIdle(): void {
    if (this.idle) window.clearTimeout(this.idle);
    this.idle = window.setTimeout(() => this.clearPrimed(), this.followupMs);
  }

  private clearPrimed(): void {
    if (!this.primed) return;
    this.primed = false;
    this.h.onListeningChange?.(false);
  }
}
