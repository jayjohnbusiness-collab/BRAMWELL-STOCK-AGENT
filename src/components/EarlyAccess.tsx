import { useEffect, useRef, useState } from "react";
import { Mark } from "../brand/Mark";
import { hasRequestedAccess, looksLikeEmail, submitWaitlist } from "../waitlist";
import "../styles/earlyaccess.css";

/*
 * Early-access capture for Bramwell Concierge (Phase 0 — price validation).
 * A calm modal in the welcome/login register: email + an optional "what would
 * make it worth $100" signal, which is the real validation gold. Submits to the
 * configured form endpoint (see src/waitlist.ts); confirms with a founding-list
 * message. Dismissed by backdrop or Escape.
 */

const INTERESTS = [
  "The voice squawk that calls me",
  "AI analyst over filings & earnings",
  "Portfolio linked & risk-watched",
  "Licensed real-time data",
  "All of it — the full butler",
];

export function EarlyAccess({ onClose }: { onClose: () => void }) {
  const emailRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState("");
  const [interest, setInterest] = useState(INTERESTS[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(() => hasRequestedAccess());

  useEffect(() => {
    if (!done) emailRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, done]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!looksLikeEmail(email)) {
      setError("Please enter a valid email address.");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await submitWaitlist(email, interest);
    setBusy(false);
    if (res.ok) {
      setDone(true);
    } else {
      setError(res.error ?? "Something went wrong. Please try again.");
    }
  }

  return (
    <div className="ea-scrim" onClick={onClose}>
      <section
        className="ea-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ea-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ea-mark">
          <Mark size={30} tone="brass" />
          <span className="ea-word">Bramwell Concierge</span>
        </div>

        {done ? (
          <>
            <h1 id="ea-title" className="ea-title">
              You're on the list.
            </h1>
            <p className="ea-intro">
              Thank you — you'll be among the first invited when Concierge opens, with founding
              pricing held for you. In the meantime, the live demo is yours to explore.
            </p>
            <button type="button" className="btn ea-submit" onClick={onClose}>
              Back to Bramwell
            </button>
          </>
        ) : (
          <>
            <h1 id="ea-title" className="ea-title">
              Request early access.
            </h1>
            <p className="ea-intro">
              A voice-first market analyst on call. Join the founding list and lock in launch
              pricing — no card, no commitment.
            </p>

            <form className="ea-form" onSubmit={submit}>
              <label className="ea-field">
                <span>Email</span>
                <input
                  ref={emailRef}
                  type="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError(null);
                  }}
                />
              </label>

              <label className="ea-field">
                <span>What would make it worth $100/mo? (optional)</span>
                <select value={interest} onChange={(e) => setInterest(e.target.value)}>
                  {INTERESTS.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </label>

              {error ? (
                <p className="ea-error" role="alert">
                  {error}
                </p>
              ) : null}

              <button type="submit" className="btn ea-submit" disabled={busy}>
                {busy ? "Sending…" : "Request access"}
              </button>
            </form>

            <p className="ea-note">
              We'll only email you about Concierge early access.
            </p>
          </>
        )}
      </section>
    </div>
  );
}
