import { useEffect, useState } from "react";
import App from "./App";
import { Landing } from "./components/Landing";

/*
 * The front door. Prospects land on the marketing page; the moment they choose
 * to try it, we drop them into the live app and remember them, so a return
 * visit goes straight in — a subscription-like feel with no backend. The hash
 * offers an escape hatch either way: #app forces the app, #home the landing.
 */

const ENTERED_KEY = "bramwell.entered.v1";

function hasEntered(): boolean {
  try {
    if (window.location.hash === "#home") return false;
    if (window.location.hash === "#app") return true;
    if (window.localStorage.getItem(ENTERED_KEY) === "1") return true;
    // Anyone who has already used the app skips the landing — the once-shown
    // welcome, a saved board, or a saved watchlist all mark a returning user.
    const usedBefore =
      window.localStorage.getItem("bramwell.welcomed.v1") === "1" ||
      window.localStorage.getItem("bramwell.cards.v1") != null ||
      window.localStorage.getItem("bramwell.watchlist.v1") != null;
    return usedBefore;
  } catch {
    return false;
  }
}

export function Root() {
  const [entered, setEntered] = useState(() => hasEntered());

  // Keep in step with manual hash changes (e.g. someone types #home to preview).
  useEffect(() => {
    const onHash = () => setEntered(hasEntered());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  function enter() {
    try {
      window.localStorage.setItem(ENTERED_KEY, "1");
    } catch {
      /* private mode — they'll just see the landing again next time */
    }
    if (window.location.hash === "#home") {
      // Clear the preview hash so the app view sticks.
      history.replaceState(null, "", window.location.pathname + window.location.search);
    }
    setEntered(true);
  }

  return entered ? <App /> : <Landing onEnter={enter} />;
}
