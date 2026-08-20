/*
 * Concierge gating for the Analytic view. The $100 Concierge tier isn't
 * purchasable yet (no billing backend), so this is a soft flag rather than a
 * real entitlement check: on by default so the owner can preview it, flip to
 * off with localStorage `bramwell.concierge.v1 = "0"`. When billing exists,
 * this becomes the subscription check and the default becomes false.
 */

const KEY = "bramwell.concierge.v1";

export function conciergeEnabled(): boolean {
  try {
    return window.localStorage.getItem(KEY) !== "0";
  } catch {
    return true;
  }
}
