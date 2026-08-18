/*
 * Theme: light or dark, toggled and persisted. The initial value is applied
 * before paint by an inline script in index.html (so there's no flash); this
 * module is the React-side counterpart for reading and switching it.
 */

export type Theme = "light" | "dark" | "glass";

const KEY = "bramwell.theme";

function isTheme(v: unknown): v is Theme {
  return v === "dark" || v === "light" || v === "glass";
}

export function storedTheme(): Theme | null {
  try {
    const v = localStorage.getItem(KEY);
    return isTheme(v) ? v : null;
  } catch {
    return null;
  }
}

export function systemTheme(): Theme {
  return typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

/** Stored choice, else the OS preference. */
export function initialTheme(): Theme {
  return storedTheme() ?? systemTheme();
}

/** What's currently applied to the document (falls back to initial). */
export function currentTheme(): Theme {
  const t = document.documentElement.dataset.theme;
  return isTheme(t) ? t : initialTheme();
}

export function setTheme(theme: Theme): void {
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    /* private mode — the choice just won't persist */
  }
  document.documentElement.dataset.theme = theme;
}
