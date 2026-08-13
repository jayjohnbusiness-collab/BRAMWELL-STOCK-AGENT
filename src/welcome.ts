/*
 * First-run gate for the welcome card. Shown once per browser; the flag is set
 * when the visitor dismisses it, so it never greets a returning user twice.
 */

const KEY = "bramwell.welcomed.v1";

export function hasWelcomed(): boolean {
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return true; // storage blocked → don't nag
  }
}

export function markWelcomed(): void {
  try {
    window.localStorage.setItem(KEY, "1");
  } catch {
    /* storage unavailable — it may greet again, no harm done */
  }
}
