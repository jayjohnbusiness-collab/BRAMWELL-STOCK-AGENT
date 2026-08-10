/*
 * Where the market-data token comes from, in order of precedence:
 *   1. a `?finnhub=KEY` URL parameter (captured to localStorage, then stripped
 *      from the address bar so it isn't left lying around);
 *   2. a key the user pasted in the app (localStorage);
 *   3. a build-time VITE_FINNHUB_TOKEN (for a site-wide live deployment).
 *
 * A quick-demo key lives only in the visitor's own browser — it is never
 * committed or baked into the shared bundle. It is still a client-side secret,
 * so use a free, disposable key. A production deployment should proxy the feed
 * through a backend instead of shipping any key to the browser.
 */
const KEY = "bramwell.finnhub.token";

export function getToken(): string {
  try {
    const url = new URL(window.location.href);
    const fromUrl = url.searchParams.get("finnhub");
    if (fromUrl && fromUrl.trim()) {
      localStorage.setItem(KEY, fromUrl.trim());
      url.searchParams.delete("finnhub");
      window.history.replaceState({}, "", url.toString());
      return fromUrl.trim();
    }
  } catch {
    /* no window/URL — fall through */
  }
  try {
    const stored = localStorage.getItem(KEY);
    if (stored && stored.trim()) return stored.trim();
  } catch {
    /* storage unavailable */
  }
  return import.meta.env.VITE_FINNHUB_TOKEN?.trim() ?? "";
}

export function hasToken(): boolean {
  return getToken().length > 0;
}

export function setToken(token: string): void {
  try {
    localStorage.setItem(KEY, token.trim());
  } catch {
    /* storage unavailable */
  }
}

export function clearToken(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable */
  }
}
