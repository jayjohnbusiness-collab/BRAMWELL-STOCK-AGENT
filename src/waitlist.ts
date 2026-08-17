/*
 * Early-access waitlist capture (Phase 0 — validate the $100 Concierge price).
 *
 * The site is static (GitHub Pages, no backend), so signups go to an external
 * form you own. Two transports are supported:
 *
 *   A) Google Forms (configured below in GOOGLE_FORM) — submitted as
 *      url-encoded entry.<id> fields to the form's /formResponse endpoint via a
 *      hidden iframe. Google sends no CORS headers, so the response is opaque:
 *      the submission still records in the form, we just can't read a status,
 *      and treat a completed submit as success.
 *
 *   B) A JSON endpoint (Formspree / Netlify / serverless) — set via
 *      ?waitlist=<url>, a bramwell.waitlist.endpoint localStorage key, or the
 *      VITE_WAITLIST_ENDPOINT build env. POSTed as JSON.
 *
 * A configured JSON endpoint takes precedence (handy for testing); otherwise the
 * Google Form is used if its entry IDs are filled in. With neither configured,
 * submissions are kept on-device only and the UI still confirms — so the flow is
 * testable — but no lead reaches you. See docs/CONCIERGE_ROADMAP.md.
 */

const ENDPOINT_KEY = "bramwell.waitlist.endpoint";
const REQUESTED_KEY = "bramwell.waitlist.requested.v1";

/*
 * Google Form target. `action` is the form's share link with /viewform… swapped
 * for /formResponse. The two entry IDs come from the form's "Get pre-filled
 * link" (Forms → ⋮ → Get pre-filled link → fill dummy values → copy). Leave an
 * ID empty to skip that field; leave `email` empty to disable the Google path.
 */
export const GOOGLE_FORM = {
  action:
    "https://docs.google.com/forms/d/e/1FAIpQLSflj0WPxx3txHvIT6EZeYBjQKodCxoH20qf345GiamNiF0NXQ/formResponse",
  emailField: "", // e.g. "entry.1234567890"  — the email question
  interestField: "", // e.g. "entry.0987654321" — the "$100/mo" question (optional)
};

export function googleFormConfigured(): boolean {
  return GOOGLE_FORM.emailField.startsWith("entry.");
}

/** Build the url-encoded entry.<id> field map for a Google Form submission. */
export function googleFormFields(email: string, interest: string): Record<string, string> {
  const fields: Record<string, string> = {};
  if (GOOGLE_FORM.emailField.startsWith("entry.")) fields[GOOGLE_FORM.emailField] = email;
  if (GOOGLE_FORM.interestField.startsWith("entry.")) fields[GOOGLE_FORM.interestField] = interest;
  return fields;
}

/** Resolve a JSON form endpoint from URL → localStorage → build env, if any. */
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
  /** True when nothing was configured — captured on-device only. */
  local?: boolean;
  error?: string;
}

/**
 * Submit an early-access request via a hidden-iframe form POST to Google Forms.
 * The cross-origin response is opaque, so we resolve once the submission has had
 * time to complete and treat it as sent. Requires a DOM (browser only).
 */
function submitGoogleForm(email: string, interest: string): Promise<WaitlistResult> {
  return new Promise((resolve) => {
    try {
      const iframe = document.createElement("iframe");
      iframe.name = "bramwell-gform-sink";
      iframe.style.display = "none";
      document.body.appendChild(iframe);

      const form = document.createElement("form");
      form.action = GOOGLE_FORM.action;
      form.method = "POST";
      form.target = iframe.name;
      form.style.display = "none";

      for (const [name, value] of Object.entries(googleFormFields(email, interest))) {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = name;
        input.value = value;
        form.appendChild(input);
      }

      document.body.appendChild(form);
      form.submit();

      // Google's response is opaque; give the POST time to land, then report
      // success. Clean up the DOM later so the in-flight request isn't aborted.
      window.setTimeout(() => {
        rememberRequested();
        resolve({ ok: true });
      }, 900);
      window.setTimeout(() => {
        form.remove();
        iframe.remove();
      }, 5000);
    } catch {
      resolve({ ok: false, error: "We couldn't reach the sign-up service. Please try again." });
    }
  });
}

/** POST the signup as JSON to a Formspree-style endpoint. */
async function submitJson(endpoint: string, email: string, interest: string): Promise<WaitlistResult> {
  const payload = { email, interest, tier: "Bramwell Concierge", source: "landing/pricing" };
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

/**
 * Submit an early-access request. A configured JSON endpoint wins (useful for
 * tests); else the Google Form if its entry IDs are set; else record on-device.
 */
export async function submitWaitlist(email: string, interest: string): Promise<WaitlistResult> {
  const trimmed = email.trim();
  if (!looksLikeEmail(trimmed)) {
    return { ok: false, error: "Please enter a valid email address." };
  }

  const endpoint = waitlistEndpoint();
  if (endpoint) return submitJson(endpoint, trimmed, interest);
  if (googleFormConfigured()) return submitGoogleForm(trimmed, interest);

  rememberRequested();
  return { ok: true, local: true };
}
