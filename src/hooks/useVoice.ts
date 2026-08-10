import { useEffect, useRef, useState } from "react";
import { Recognizer } from "../speech/recognition";
import { Voice } from "../speech/synthesis";

/*
 * Wires speech recognition and synthesis to the app.
 *
 *   - toggle() turns the mic on/off. When on, Bramwell listens for the wake
 *     word and, once addressed, for follow-ups.
 *   - speak() reads a reply aloud, but only while voice is enabled.
 *   - Barge-in: the moment the user starts speaking, Bramwell stops mid-word.
 *
 * Recognition may be unavailable (e.g. Firefox); `available` reflects that and
 * the typed composer always remains the fallback.
 */
export function useVoice(onCommand: (text: string) => void) {
  const [available] = useState(() => Recognizer.supported());
  const [enabled, setEnabled] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  const recRef = useRef<Recognizer | null>(null);
  const voiceRef = useRef<Voice | null>(null);
  const enabledRef = useRef(false);
  const commandRef = useRef(onCommand);
  commandRef.current = onCommand;

  useEffect(() => {
    voiceRef.current = Voice.supported() ? new Voice(setSpeaking) : null;
    return () => {
      recRef.current?.stop();
      voiceRef.current?.cancel();
    };
  }, []);

  function ensureRecognizer(): Recognizer {
    if (recRef.current) return recRef.current;
    recRef.current = new Recognizer({
      onCommand: (text) => {
        voiceRef.current?.cancel(); // stop any current line before answering
        commandRef.current(text);
      },
      onListeningChange: setListening,
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
      enabledRef.current = false;
      setEnabled(false);
      setListening(false);
    } else {
      ensureRecognizer().start();
      enabledRef.current = true;
      setEnabled(true);
    }
  }

  /** Speak a reply aloud — a no-op unless voice is enabled. */
  function speak(text: string): void {
    if (enabledRef.current) voiceRef.current?.speak(text);
  }

  function cancel(): void {
    voiceRef.current?.cancel();
  }

  return { available, enabled, listening, speaking, toggle, speak, cancel };
}
