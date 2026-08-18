import { useEffect, useRef, useState } from "react";
import type { CardContext } from "../cards/types";
import { hasToken, getToken, setToken, clearToken } from "../feed/token";
import { currentTheme, setTheme, type Theme } from "../theme";
import { chimeMuted, setChimeMuted } from "../chime";
import { PortfolioCard } from "./cards/PortfolioCard";
import { TriggersCard } from "./cards/TriggersCard";
import { WatchlistManager } from "./WatchlistManager";
import "../styles/account.css";

/*
 * The Account panel — one clean place for the user's own data, so the board
 * stays a display, not a set of forms. It gathers what was scattered: the
 * holdings editor, the watchlist editor, the live-data connection, and the
 * preferences (theme, alert sound, notifications). A slide-in over a scrim,
 * like the detail drawer, closing on the backdrop or Escape.
 */
export function AccountPanel({ ctx, onClose }: { ctx: CardContext; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="account-scrim" onClick={onClose}>
      <aside
        className="account-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Account"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="account-head">
          <div>
            <div className="account-title">Account</div>
            <div className="account-sub">Your holdings, watchlist, and settings.</div>
          </div>
          <button ref={closeRef} type="button" className="card-x" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </header>

        <Section title="Holdings">
          <PortfolioCard ctx={ctx} size="lg" />
        </Section>

        <Section title="Watchlist">
          <WatchlistManager
            watched={ctx.market.held()}
            onAdd={ctx.watchAdd}
            onRemove={ctx.watchRemove}
            onSuggest={ctx.watchSuggest}
            size="lg"
          />
        </Section>

        <Section title="Alerts & triggers">
          <TriggersCard ctx={ctx} size="lg" hideControls />
        </Section>

        <Section title="Live data">
          <LiveDataSection />
        </Section>

        <Section title="Preferences">
          <Preferences ctx={ctx} />
        </Section>
      </aside>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="account-section">
      <span className="account-section-title">{title}</span>
      {children}
    </section>
  );
}

/* -------------------------------------------------------------- Live data */

function LiveDataSection() {
  const connected = hasToken();
  const [key, setKey] = useState("");

  function connect(e: React.FormEvent) {
    e.preventDefault();
    const k = key.trim();
    if (!k) return;
    setToken(k);
    // The feed reads the token when it's constructed, so a reload swaps
    // simulated data for live cleanly.
    window.location.reload();
  }

  function disconnect() {
    clearToken();
    window.location.reload();
  }

  if (connected) {
    // Show a masked hint of the stored key, never the whole thing.
    const masked = maskKey(getToken());
    return (
      <div className="account-live">
        <p className="account-line">
          <span className="live-dot" aria-hidden="true" /> Connected to Finnhub
          <span className="account-muted"> · {masked}</span>
        </p>
        <button type="button" className="chip" onClick={disconnect}>
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div className="account-live">
      <p className="account-muted" style={{ margin: 0 }}>
        Paste a free{" "}
        <a href="https://finnhub.io" target="_blank" rel="noreferrer" style={{ color: "var(--brass)" }}>
          Finnhub
        </a>{" "}
        key for live prices. It's stored only in this browser.
      </p>
      <form onSubmit={connect} className="account-live-form">
        <input
          aria-label="Finnhub API key"
          type="password"
          placeholder="Finnhub API key"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
        <button type="submit" className="btn" disabled={!key.trim()}>
          Connect
        </button>
      </form>
    </div>
  );
}

/** "abc1…wxyz" — a short masked hint so the user recognises which key is stored. */
function maskKey(k: string): string {
  if (k.length <= 6) return "••••";
  return `${k.slice(0, 4)}…${k.slice(-4)}`;
}

/* ------------------------------------------------------------ Preferences */

function Preferences({ ctx }: { ctx: CardContext }) {
  const [theme, setThemeState] = useState<Theme>(() => currentTheme());
  const [muted, setMuted] = useState(() => chimeMuted());
  const notify = ctx.triggers.notifyState;

  function chooseTheme(next: Theme) {
    setTheme(next);
    setThemeState(next);
  }

  function toggleSound() {
    const next = !muted;
    setChimeMuted(next);
    setMuted(next);
  }

  return (
    <div className="account-prefs">
      <Pref label="Theme">
        <div className="seg" role="group" aria-label="Theme">
          <button
            type="button"
            className={`seg-btn${theme === "light" ? " on" : ""}`}
            aria-pressed={theme === "light"}
            onClick={() => chooseTheme("light")}
          >
            Light
          </button>
          <button
            type="button"
            className={`seg-btn${theme === "dark" ? " on" : ""}`}
            aria-pressed={theme === "dark"}
            onClick={() => chooseTheme("dark")}
          >
            Dark
          </button>
          <button
            type="button"
            className={`seg-btn${theme === "glass" ? " on" : ""}`}
            aria-pressed={theme === "glass"}
            onClick={() => chooseTheme("glass")}
          >
            Glass
          </button>
        </div>
      </Pref>

      <Pref label="Alert sound">
        <button type="button" className="chip" aria-pressed={!muted} onClick={toggleSound}>
          {muted ? "🔕 Off" : "🔔 On"}
        </button>
      </Pref>

      <Pref label="Notifications">
        {notify === "granted" ? (
          <span className="account-muted">Enabled</span>
        ) : notify === "denied" ? (
          <span className="account-muted">Blocked in browser</span>
        ) : notify === "unsupported" ? (
          <span className="account-muted">Not supported</span>
        ) : (
          <button type="button" className="chip" onClick={ctx.triggers.requestNotify}>
            Enable
          </button>
        )}
      </Pref>
    </div>
  );
}

function Pref({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="account-pref">
      <span className="account-pref-label">{label}</span>
      {children}
    </div>
  );
}
