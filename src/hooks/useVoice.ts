import { useEffect, useRef, useState } from "react";
import { Recognizer } from "../speech/recognition";
import { Voice } from "../speech/synthesis";
import { AudioMeter } from "../speech/meter";

/*
 * Wires speech recognition, synthesis, and mic metering to the app.
 *
 *   - toggle() enters/leaves voice mode. In voice mode Bramwell listens for the
 *     wake word and, once addressed, for follow-ups; the mic meter drives the
 *     surface's orb.
 *   - speak() reads a reply aloud, but only while in voice mode.
 *   - Barge-in: the moment the user starts speaking, Bramwell stops mid-word.
 *   - interim is the live (not-yet-final) transcript, for the surface.
 *
 * Recognition may be unavailable (e.g. Firefox); `available` reflects that and
 * the typed composer always remains the fallback.
 */
export function useVoice(onCommand: (text: string) => void) {
  const [available] = useState(() => Recognizer.supported());
  const [enabled, setEnabled] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [interim, setInterim] = useState("");
  const [meter, setMeter] = useState<AudioMeter | null>(null);

  const recRef = useRef<Recognizer | null>(null);
  const voiceRef = useRef<Voice | null>(null);
  const meterRef = useRef<AudioMeter | null>(null);
  const enabledRef = useRef(false);
  const commandRef = useRef(onCommand);
  commandRef.current = onCommand;

  useEffect(() => {
    voiceRef.current = Voice.supported() ? new Voice(setSpeaking) : null;
    return () => {
      recRef.current?.stop();
      voiceRef.current?.cancel();
      meterRef.current?.stop();
    };
  }, []);

  function ensureRecognizer(): Recognizer {
    if (recRef.current) return recRef.current;
    recRef.current = new Recognizer({
      onCommand: (text) => {
        voiceRef.current?.cancel(); // stop any current line before answering
        setInterim("");
        commandRef.current(text);
      },
      onInterim: setInterim,
      onListeningChange: (l) => {
        setListening(l);
        if (!l) setInterim("");
      },
      onSpeechStart: () => voiceRef.current?.cancel(), // barge-in, mid-word
      onError: () => {
        /* transient; the recognizer keeps itself alive */
      },
    });
    return recRef.current;
  }

  function toggle(): void {
    if (!available) return;
    if (enabledRef.current) {
      recRef.current?.stop();
      voiceRef.current?.cancel();
      meterRef.current?.stop();
      meterRef.current = null;
      setMeter(null);
      setInterim("");
      enabledRef.current = false;
      setEnabled(false);
      setListening(false);
    } else {
      ensureRecognizer().start();
      const m = new AudioMeter();
      meterRef.current = m;
      setMeter(m);
      void m.start(); // best-effort; the surface tolerates a flat level
      enabledRef.current = true;
      setEnabled(true);
    }
  }

  /** Speak a reply aloud — a no-op unless voice mode is on. */
  function speak(text: string): void {
    if (enabledRef.current) voiceRef.current?.speak(text);
  }

  function cancel(): void {
    voiceRef.current?.cancel();
  }

  return {
    available,
    enabled,
    listening,
    speaking,
    interim,
    meter,
    toggle,
    speak,
    cancel,
  };
}
