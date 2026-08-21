import { useEffect, useRef, useState } from "react";
import { Recognizer } from "../speech/recognition";
import { Speaker } from "../speech/speaker";

/*
 * Wires speech recognition and synthesis to the app.
 *
 *   - toggle() enters/leaves voice mode. In voice mode Bramwell only acts when
 *     addressed: an utterance must open with "Hey Bramwell". After a reply a
 *     short follow-up window stays open so "and yesterday?" works without
 *     repeating his name.
 *   - speak() reads a reply aloud, but only while in voice mode.
 *   - Barge-in: the moment the user starts speaking, Bramwell stops mid-word.
 *   - interim is the live (not-yet-final) transcript; error surfaces a real
 *     recognition problem (blocked mic, unreachable service) instead of silence.
 *
 * Only one consumer of the microphone runs (the recognizer). A second capture
 * for amplitude metering is deliberately avoided — on some browsers it starves
 * SpeechRecognition of audio, which reads as "Bramwell doesn't respond."
 */
export function useVoice(onCommand: (text: string) => void, onWake?: () => void) {
  const [available] = useState(() => Recognizer.supported());
  const [enabled, setEnabled] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState("");

  const recRef = useRef<Recognizer | null>(null);
  const voiceRef = useRef<Speaker | null>(null);
  const enabledRef = useRef(false);
  const commandRef = useRef(onCommand);
  commandRef.current = onCommand;
  const wakeRef = useRef(onWake);
  wakeRef.current = onWake;

  // Self-echo guard. Bramwell's spoken reply plays through the speakers, and on
  // any device without headphones the microphone hears it. Without this the
  // recognizer treats his own voice as the user talking — barging in to cut him
  // off mid-word, and even feeding his words back as a fresh command (an endless
  // loop). So while he is speaking — and for a short tail afterwards, to swallow
  // the last of the echo — the mic's input is ignored.
  const speakingRef = useRef(false);
  const muteUntilRef = useRef(0);
  const selfEcho = () => speakingRef.current || Date.now() < muteUntilRef.current;

  useEffect(() => {
    const onSpeaking = (s: boolean) => {
      speakingRef.current = s;
      if (!s) muteUntilRef.current = Date.now() + 700; // tail after he stops
      setSpeaking(s);
    };
    voiceRef.current = Speaker.supported() ? new Speaker(onSpeaking) : null;
    return () => {
      recRef.current?.stop();
      voiceRef.current?.cancel();
    };
  }, []);

  function ensureRecognizer(): Recognizer {
    if (recRef.current) return recRef.current;
    recRef.current = new Recognizer(
      {
        onCommand: (text) => {
          if (selfEcho()) return; // his own reply echoing back — not a command
          setError("");
          setInterim("");
          voiceRef.current?.cancel(); // stop any current line before answering
          commandRef.current(text);
        },
        onInterim: (text) => {
          if (selfEcho()) return; // don't show his own words as the user's transcript
          setInterim(text);
        },
        onListeningChange: setListening,
        onSpeechStart: () => {
          if (selfEcho()) return; // don't barge in on his own voice
          voiceRef.current?.cancel(); // real barge-in, mid-word
        },
        onWake: () => {
          if (selfEcho()) return;
          setError("");
          setInterim("");
          wakeRef.current?.();
        },
        onError: (e) => {
          const message = friendlyError(e);
          if (message) setError(message);
        },
      },
      // Bramwell only acts when addressed: an utterance must open with
      // "Hey Bramwell" (a short follow-up window then stays open for "and
      // yesterday?" without repeating his name).
      { requireWake: true },
    );
    return recRef.current;
  }

  function toggle(): void {
    if (!available) return;
    if (enabledRef.current) {
      recRef.current?.stop();
      voiceRef.current?.cancel();
      setInterim("");
      setError("");
      enabledRef.current = false;
      setEnabled(false);
      setListening(false);
    } else {
      setError("");
      ensureRecognizer().start();
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
    error,
    toggle,
    speak,
    cancel,
  };
}

/** Turn a SpeechRecognition error code into something the user can act on. */
function friendlyError(code: string): string | null {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return "Microphone access is blocked. Allow it via the icon in the address bar, then toggle voice again.";
    case "audio-capture":
      return "No microphone was found.";
    case "network":
      return "The speech service is unreachable right now — check your connection.";
    case "language-not-supported":
      return "This browser's speech recognition doesn't support the language.";
    case "unsupported":
      return "This browser doesn't support speech recognition — try Chrome or Edge.";
    default:
      return null; // transient (no-speech, aborted) — not worth surfacing
  }
}
