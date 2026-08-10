import { hasToken, setToken, clearToken } from "../feed/token";

/*
 * A small header control to connect live market data with a free Finnhub key.
 * The key is stored only in this browser and never leaves it except in the
 * requests to Finnhub. Switching either way reloads so the feed is rebuilt.
 */
export function LiveDataControl() {
  const live = hasToken();

  function connect() {
    const key = window.prompt(
      "Paste your free Finnhub API key (sign up at finnhub.io).\n\nIt's saved only in this browser and used for live prices.",
    );
    if (key && key.trim()) {
      setToken(key);
      window.location.reload();
    }
  }

  function disconnect() {
    if (window.confirm("Switch back to simulated data and remove the saved key from this browser?")) {
      clearToken();
      window.location.reload();
    }
  }

  return (
    <button
      type="button"
      className="chip"
      onClick={live ? disconnect : connect}
      title={
        live
          ? "Live prices via Finnhub — click to switch back to simulated"
          : "Connect a free Finnhub key for live prices"
      }
      style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-2)" }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: live ? "var(--data-up)" : "var(--ink-soft)",
        }}
      />
      {live ? "Live data" : "Connect live data"}
    </button>
  );
}
