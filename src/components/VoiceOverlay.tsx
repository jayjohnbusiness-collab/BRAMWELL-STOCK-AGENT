import { useEffect, useRef } from "react";
import { Bell } from "../brand/Bell";
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
  const orbRef = useRef<HTMLDivElement>(null);
  const exitRef = useRef<HTMLButtonElement>(null);
  const activeRef = useRef(false);
  activeRef.current = speaking || interim.trim().length > 0;

  useEffect(() => {
    const orb = orbRef.current;
    if (!orb) return;
    const reduced = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduced) {
      orb.style.setProperty("--level", "0.2");
      return;
    }
    let raf = 0;
    let t0 = 0;
    const loop = (ts: number) => {
      if (!t0) t0 = ts;
      const t = (ts - t0) / 1000;
      const idle = 0.12 + 0.05 * Math.sin(t * 2.0);
      const boost = activeRef.current ? 0.28 + 0.16 * Math.abs(Math.sin(t * 9)) : 0;
      orb.style.setProperty("--level", String(Math.min(1, idle + boost)));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

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

      <div className="voice-orb" ref={orbRef} aria-hidden="true">
        <span className="halo" />
        <span className="ring" />
        <span className="core" />
        <span className="bell">
          <Bell size={60} tone="brass" title="Bramwell" />
        </span>
      </div>

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
        <p className="voice-transcript">Ask me anything — say a name, or “what's moving today?”</p>
      )}

      <p className="voice-hint">Speak naturally. Chrome or Edge work best. Press Done to leave.</p>
    </div>
  );
}
