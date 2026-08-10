import { hasToken, setToken } from "../feed/token";

/*
 * Header market-data indicator.
 *
 * Once live, this is a plain, non-interactive badge — there is deliberately no
 * way to switch back to simulated data from here. When not yet connected, it
 * offers the one action that makes sense: connect a live key.
 */
export function LiveDataControl() {
  if (hasToken()) {
    return (
      <span
        title="Live prices via Finnhub"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "var(--space-2)",
          fontFamily: "var(--font-body)",
          fontSize: "var(--step-small)",
          color: "var(--ink-soft)",
        }}
      >
        <span
          aria-hidden="true"
          style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--data-up)" }}
        />
        Live data
      </span>
    );
  }

  function connect() {
    const key = window.prompt(
      "Paste your free Finnhub API key (sign up at finnhub.io).\n\nIt's saved only in this browser and used for live prices.",
    );
    if (key && key.trim()) {
      setToken(key);
      window.location.reload();
    }
  }

  return (
    <button
      type="button"
      className="chip"
      onClick={connect}
      title="Connect a free Finnhub key for live prices"
      style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-2)" }}
    >
      <span
        aria-hidden="true"
        style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--ink-soft)" }}
      />
      Connect live data
    </button>
  );
}
