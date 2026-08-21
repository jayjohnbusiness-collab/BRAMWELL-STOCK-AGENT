import { useEffect, useRef } from "react";
import { Mark } from "../brand/Mark";
import { hasToken } from "../feed/token";
import "../styles/welcome.css";

/*
 * The first-run welcome — a one-time card that introduces Bramwell in his own
 * register (a butler reporting for duty), says plainly what he does, and offers
 * a couple of ways in. Shown once per browser; dismissed with Get started, the
 * backdrop, or Escape.
 */
export function Welcome({
  onClose,
  onConnect,
}: {
  onClose: () => void;
  onConnect: () => void;
}) {
  const startRef = useRef<HTMLButtonElement>(null);
  const connected = hasToken();

  useEffect(() => {
    startRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="welcome-scrim" onClick={onClose}>
      <section
        className="welcome-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="welcome-mark">
          <Mark size={34} tone="brass" />
          <span className="welcome-word">Bramwell</span>
        </div>

        <h1 id="welcome-title" className="welcome-title">
          {salutation()}. At your service.
        </h1>
        <p className="welcome-intro">
          I keep an eye on your market and speak up the moment something's worth your while — a
          mover, a level you've set, the story behind a jump. Ask me anything, by keyboard or voice.
        </p>

        <ul className="welcome-points">
          <li>
            <EyeIcon />
            <span>
              <strong>Watch names.</strong> Follow the names you care about and I'll track them live.
            </span>
          </li>
          <li>
            <BellDot />
            <span>
              <strong>Set alerts.</strong> Name a level and I'll tell you the moment it's reached.
            </span>
          </li>
          <li>
            <ChatIcon />
            <span>
              <strong>Just ask.</strong> “How's NVIDIA?” or “What's moving today?” — type or speak.
            </span>
          </li>
        </ul>

        <div className="welcome-actions">
          <button ref={startRef} type="button" className="btn welcome-start" onClick={onClose}>
            Get started
          </button>
          {!connected ? (
            <button type="button" className="chip welcome-connect" onClick={onConnect}>
              Connect live data
            </button>
          ) : null}
        </div>

        {!connected ? (
          <p className="welcome-note">
            You're on sample data for now — connect a free key any time for live prices.
          </p>
        ) : null}
      </section>
    </div>
  );
}

function salutation(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

/* --- small line icons, in the accent --- */

function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12Z"
        stroke="var(--brass)"
        strokeWidth="1.6"
      />
      <circle cx="12" cy="12" r="2.6" fill="var(--brass)" />
    </svg>
  );
}

function BellDot() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6 16.5c0-1 .8-1.6.8-4.5 0-3 2-5 5.2-5s5.2 2 5.2 5c0 2.9.8 3.5.8 4.5Z"
        stroke="var(--brass)"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M10.2 19a1.9 1.9 0 0 0 3.6 0" stroke="var(--brass)" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="17.5" cy="6.5" r="2.4" fill="var(--brass)" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 5.5h16v10H9l-4 3.5v-3.5H4Z"
        stroke="var(--brass)"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}
