import { useEffect, useRef } from "react";
import { VoiceOrb } from "./VoiceOrb";
import "../styles/voice.css";

/*
 * The dark, voice-activated surface. Immersive, but still Bramwell: the same
 * ink/brass/parchment, inverted onto a dark ground.
 *
 * The orb breathes on its own (a synthetic wave, so no second microphone
 * capture competes with speech recognition) and swells while the user talks or
 * Bramwell speaks. The focal text always shows the latest state — the live
 * transcript, then Bramwell's answer — so a reply is visible even if the
 * browser's text-to-speech stays silent. Reduced motion holds the orb still.
 */
export function VoiceOverlay({
  interim,
  error,
  working,
  speaking,
  lastReply,
  onExit,
}: {
  interim: string;
  error: string;
  working: boolean;
  speaking: boolean;
  lastReply?: string;
  onExit: () => void;
}) {
  const exitRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    exitRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onExit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onExit]);

  const label = error
    ? ""
    : working
      ? ""
      : interim.trim()
        ? "Listening"
        : lastReply
          ? "Bramwell"
          : "Listening";

  return (
    <div className="voice-overlay" role="dialog" aria-modal="true" aria-label="Voice mode">
      <button ref={exitRef} type="button" className="voice-exit" onClick={onExit}>
        Done
      </button>

      <div className="voice-orb-wrap">
        <VoiceOrb
          speaking={speaking}
          working={working}
          listening={interim.trim().length > 0}
        />
      </div>

      <div className="voice-readout">
        <div className="voice-label" aria-live="polite">
          {label}
        </div>

        {error ? (
          <p className="voice-error">{error}</p>
        ) : working ? (
          <div className="voice-working" aria-label="Working">
            <span />
            <span />
            <span />
          </div>
        ) : interim.trim() ? (
          <p className="voice-transcript" aria-live="polite">
            {interim}
          </p>
        ) : lastReply ? (
          <p className="voice-answer">{lastReply}</p>
        ) : (
          <p className="voice-transcript">Say “Hey Bramwell,” then your question.</p>
        )}
      </div>
    </div>
  );
}
