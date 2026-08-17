/*
 * Early-access waitlist capture (Phase 0 — validate the $100 Concierge price).
 *
 * The site is static (GitHub Pages, no backend), so signups are POSTed to an
 * external form-service endpoint you own — Formspree, Google Forms, Netlify
 * Forms, a serverless function, anything that accepts a JSON POST. Set the
 * endpoint any of three ways (checked in this order), so you can switch capture
 * on WITHOUT a rebuild:
 *
 *   1. URL:          ?waitlist=https://formspree.io/f/xxxx
 *   2. localStorage: bramwell.waitlist.endpoint = "https://…"
 *   3. build env:    VITE_WAITLIST_ENDPOINT=https://…  (baked at build time)
 *
 * Until an endpoint is set, submissions are kept on-device only and the UI
 * still confirms — so the flow is testable — but no lead reaches you. Set the
 * endpoint before you rely on the signal. See docs/CONCIERGE_ROADMAP.md.
 */

const ENDPOINT_KEY = "bramwell.waitlist.endpoint";
const REQUESTED_KEY = "bramwell.waitlist.requested.v1";

/** Resolve the form endpoint from URL → localStorage → build env, if any. */
export function waitlistEndpoint(): string | null {
  try {
    const q = new URLSearchParams(location.search).get("waitlist");
    if (q) {
      localStorage.setItem(ENDPOINT_KEY, q);
      return q;
    }
    const stored = localStorage.getItem(ENDPOINT_KEY);
    if (stored) return stored;
  } catch {
    /* ignore private-mode / parse errors */
  }
  const env = import.meta.env.VITE_WAITLIST_ENDPOINT as string | undefined;
  return env && env.length > 0 ? env : null;
}

/** True once this browser has been recorded as having requested access. */
export function hasRequestedAccess(): boolean {
  try {
    return localStorage.getItem(REQUESTED_KEY) === "1";
  } catch {
    return false;
  }
}

function rememberRequested(): void {
  try {
    localStorage.setItem(REQUESTED_KEY, "1");
  } catch {
    /* ignore */
  }
}

/** Loose email sanity check — enough to catch typos, not a spec parser. */
export function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export interface WaitlistResult {
  ok: boolean;
  /** True when no endpoint was configured — captured on-device only. */
  local?: boolean;
  error?: string;
}

/**
 * Submit an early-access request. POSTs JSON to the configured endpoint; if
 * none is set, records locally and reports success so the flow still completes.
 */
export async function submitWaitlist(email: string, interest: string): Promise<WaitlistResult> {
  const trimmed = email.trim();
  if (!looksLikeEmail(trimmed)) {
    return { ok: false, error: "Please enter a valid email address." };
  }

  const payload = {
    email: trimmed,
    interest,
    tier: "Bramwell Concierge",
    source: "landing/pricing",
  };

  const endpoint = waitlistEndpoint();
  if (!endpoint) {
    rememberRequested();
    return { ok: true, local: true };
  }

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      return { ok: false, error: "That didn't go through — do try again in a moment." };
    }
    rememberRequested();
    return { ok: true };
  } catch {
    return { ok: false, error: "We couldn't reach the sign-up service. Please try again." };
  }
}
