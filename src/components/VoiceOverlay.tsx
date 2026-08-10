import { useEffect, useRef } from "react";
import { Bell } from "../brand/Bell";
import type { AudioMeter } from "../speech/meter";
import { voicePhase } from "../speech/voicePhase";
import "../styles/voice.css";

/*
 * The dark, voice-activated surface. Immersive, but still Bramwell: the same
 * ink/brass/parchment, inverted onto a dark ground. The orb breathes with the
 * mic amplitude (driven by a ref, not React state, so it animates at frame rate
 * without re-rendering), and reduced motion holds it still.
 */
export function VoiceOverlay({
  meter,
  interim,
  working,
  listening,
  speaking,
  lastReply,
  onExit,
}: {
  meter: AudioMeter | null;
  interim: string;
  working: boolean;
  listening: boolean;
  speaking: boolean;
  lastReply?: string;
  onExit: () => void;
}) {
  const orbRef = useRef<HTMLDivElement>(null);
  const exitRef = useRef<HTMLButtonElement>(null);
  const phase = voicePhase({ speaking, working, listening });

  // Drive the orb from the mic meter at frame rate, via a CSS variable.
  useEffect(() => {
    const orb = orbRef.current;
    if (!orb) return;
    const reduced = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduced || !meter) {
      orb.style.setProperty("--level", reduced ? "0.2" : "0");
      if (reduced) return;
    }
    let raf = 0;
    const loop = () => {
      orb.style.setProperty("--level", String(meter?.level() ?? 0));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [meter]);

  // Escape leaves voice mode; focus the exit control on entry.
  useEffect(() => {
    exitRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onExit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onExit]);

  return (
    <div className="voice-overlay" role="dialog" aria-modal="true" aria-label="Voice mode">
      <button ref={exitRef} type="button" className="voice-exit" onClick={onExit}>
        Done
      </button>

      <div className="voice-orb" ref={orbRef} aria-hidden="true">
        <span className="halo" />
        <span className="ring" />
        <span className="core" />
        <span className="bell">
          <Bell size={60} tone="brass" title="Bramwell" />
        </span>
      </div>

      <div className="voice-label" aria-live="polite">
        {label(phase)}
      </div>

      {/* The focal text: the answer while speaking, the live transcript while
          listening, a quiet working state in between. */}
      {phase === "speaking" ? (
        <p className="voice-answer">{lastReply}</p>
      ) : phase === "working" ? (
        <div className="voice-working" aria-label="Working">
          <span />
          <span />
          <span />
        </div>
      ) : phase === "listening" ? (
        <p className="voice-transcript" aria-live="polite">
          {interim || "…"}
        </p>
      ) : (
        <>
          <p className="voice-transcript">Say “Hey Bramwell.”</p>
          {lastReply ? <p className="voice-context">{lastReply}</p> : null}
        </>
      )}
    </div>
  );
}

function label(phase: ReturnType<typeof voicePhase>): string {
  switch (phase) {
    case "speaking":
      return "Bramwell";
    case "working":
      return "";
    case "listening":
      return "Listening";
    default:
      return "Standing by";
  }
}
