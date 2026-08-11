/*
 * A discreet alert chime, synthesised with the Web Audio API — no asset file,
 * nothing to load. Two soft descending notes on a sine, gently enveloped so it
 * reads as a butler's "ahem" rather than an alarm.
 *
 * The AudioContext can only make sound after the user has interacted with the
 * page; alerts fire from the background poll loop, so if the context is still
 * suspended (no prior gesture) the chime simply stays silent that once. A
 * persisted mute lets the user switch it off entirely.
 */

const MUTE_KEY = "bramwell.chime.muted";
let ctx: AudioContext | null = null;

/** Whether the chime is muted (persisted). */
export function chimeMuted(): boolean {
  try {
    return window.localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

/** Turn the chime on or off (persisted). Returns the new muted state. */
export function setChimeMuted(muted: boolean): void {
  try {
    window.localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
  } catch {
    /* storage unavailable — the choice just won't persist */
  }
}

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext })
      .AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) {
    try {
      ctx = new Ctor();
    } catch {
      return null;
    }
  }
  return ctx;
}

/** Play the two-note chime, unless muted or audio is unavailable/suspended. */
export function playChime(): void {
  if (chimeMuted()) return;
  const ac = audio();
  if (!ac) return;
  // Best-effort resume; if there's been no user gesture it stays suspended and
  // the notes below are inaudible — acceptable, and it recovers next time.
  if (ac.state === "suspended") void ac.resume().catch(() => {});

  const now = ac.currentTime;
  const notes = [
    { freq: 880, at: 0 }, // A5
    { freq: 660, at: 0.14 }, // E5, a soft fall
  ];
  for (const n of notes) {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = "sine";
    osc.frequency.value = n.freq;
    const t0 = now + n.at;
    // A quick swell and a gentle 180ms tail — quiet, never jarring.
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.12, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18);
    osc.connect(gain).connect(ac.destination);
    osc.start(t0);
    osc.stop(t0 + 0.2);
  }
}
