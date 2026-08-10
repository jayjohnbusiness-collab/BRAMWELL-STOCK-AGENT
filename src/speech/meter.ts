/*
 * Microphone amplitude metering for the voice surface.
 *
 * SpeechRecognition tells us *what* was said; this taps the raw mic stream to
 * tell us *how loudly*, so the orb can breathe with the voice. It is purely
 * decorative — every failure path degrades to a flat level, never an error.
 */
export class AudioMeter {
  static supported(): boolean {
    return (
      typeof navigator !== "undefined" &&
      !!navigator.mediaDevices?.getUserMedia &&
      (typeof AudioContext !== "undefined" ||
        "webkitAudioContext" in (globalThis as object))
    );
  }

  private ctx?: AudioContext;
  private analyser?: AnalyserNode;
  private stream?: MediaStream;
  // Backed by a plain ArrayBuffer so it matches the DOM signature exactly.
  private data?: Uint8Array<ArrayBuffer>;

  /** Best-effort start. Resolves false if the mic can't be opened. */
  async start(): Promise<boolean> {
    if (this.analyser) return true;
    if (!AudioMeter.supported()) return false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const ctx = new Ctor();
      await ctx.resume().catch(() => {});
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.8;
      ctx.createMediaStreamSource(stream).connect(analyser);
      this.stream = stream;
      this.ctx = ctx;
      this.analyser = analyser;
      this.data = new Uint8Array(new ArrayBuffer(analyser.fftSize));
      return true;
    } catch {
      return false;
    }
  }

  /** Current loudness in [0, 1] (RMS, scaled for a useful visual range). */
  level(): number {
    if (!this.analyser || !this.data) return 0;
    this.analyser.getByteTimeDomainData(this.data);
    let sum = 0;
    for (let i = 0; i < this.data.length; i++) {
      const v = (this.data[i] - 128) / 128;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / this.data.length);
    return Math.min(1, rms * 3.2);
  }

  stop(): void {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.ctx?.close().catch(() => {});
    this.stream = undefined;
    this.ctx = undefined;
    this.analyser = undefined;
    this.data = undefined;
  }
}
