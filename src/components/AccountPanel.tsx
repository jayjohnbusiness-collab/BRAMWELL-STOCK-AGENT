import { useEffect, useRef, useState } from "react";
import type { CardContext } from "../cards/types";
import { hasToken, getToken, setToken, clearToken } from "../feed/token";
import {
  hasEleven,
  elevenKey,
  elevenVoice,
  setElevenKey,
  setElevenVoice,
  elevenLastError,
  ElevenVoice,
  DEFAULT_VOICE,
  BRITISH_VOICE,
} from "../speech/eleven";
import { hasLLMKey, llmKey, setLLMKey, understand, llmLastError, usingManagedProxy, understandingEnabled } from "../agent/understand";
import { LANGS, getLang, setLang, isLangPinned, detectLang, langName, type LangCode } from "../agent/lang";
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

        <Section title="Natural voice">
          <VoiceKeySection />
        </Section>

        <Section title="AI understanding">
          <UnderstandingSection />
        </Section>

        <Section title="Language">
          <LanguageSection />
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

/* ---------------------------------------------------------- Natural voice */

function VoiceKeySection() {
  const [connected, setConnected] = useState(() => hasEleven());
  const [key, setKey] = useState("");
  const [voice, setVoice] = useState(() => (elevenVoice() === DEFAULT_VOICE ? "" : elevenVoice()));
  const [testMsg, setTestMsg] = useState("");
  const [testing, setTesting] = useState(false);

  // Runs inside the click, so audio playback is unlocked. Confirms the key works
  // and the natural voice actually plays — or reports exactly why it can't.
  async function testVoice() {
    setTesting(true);
    setTestMsg("Testing…");
    const v = new ElevenVoice();
    v.unlock();
    let failed = false;
    await v.speak("Good evening. Bramwell here, at your service.", () => {
      failed = true;
    });
    setTesting(false);
    setTestMsg(
      failed
        ? `Couldn't use ElevenLabs — ${elevenLastError() || "unknown error"}`
        : "Playing now — you should hear the natural voice.",
    );
  }

  function connect(e: React.FormEvent) {
    e.preventDefault();
    const k = key.trim();
    if (!k) return;
    setElevenKey(k);
    setElevenVoice(voice.trim()); // empty → the default British voice
    setKey("");
    setConnected(true);
  }

  function disconnect() {
    setElevenKey("");
    setConnected(false);
  }

  if (connected) {
    return (
      <div className="account-live">
        <p className="account-line">
          <span className="live-dot" aria-hidden="true" /> Natural voice on
          <span className="account-muted"> · {maskKey(elevenKey())}</span>
        </p>
        <p className="account-muted" style={{ margin: "4px 0 0", fontSize: "0.8rem" }}>
          Voice: {elevenVoice() === DEFAULT_VOICE ? "Adam (free premade default)" : elevenVoice()}
        </p>
        <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
          <button type="button" className="btn" onClick={testVoice} disabled={testing}>
            {testing ? "Testing…" : "Test voice"}
          </button>
          <button type="button" className="chip" onClick={disconnect}>
            Turn off
          </button>
        </div>
        {testMsg ? (
          <p className="account-muted" style={{ margin: "8px 0 0", fontSize: "0.8rem" }}>
            {testMsg}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="account-live">
      <p className="account-muted" style={{ margin: 0 }}>
        Give Bramwell a natural voice with an{" "}
        <a href="https://elevenlabs.io" target="_blank" rel="noreferrer" style={{ color: "var(--brass)" }}>
          ElevenLabs
        </a>{" "}
        text-to-speech key. Use a TTS-only key with a spend cap — it's stored only in this browser.
      </p>
      <p className="account-muted" style={{ margin: "6px 0 0", fontSize: "0.78rem" }}>
        Paste the <b>full secret key</b> (it starts with <code>sk_</code>), shown when you create the key in
        ElevenLabs → Settings → API Keys — not the key's ID.
      </p>
      <p className="account-muted" style={{ margin: "6px 0 0", fontSize: "0.78rem" }}>
        Leave Voice ID blank for the free premade default (Adam). ElevenLabs’ free plan only allows premade voices via
        the API — the British butler voice “George” (<code>{BRITISH_VOICE}</code>) needs a paid plan.
      </p>
      {key.trim() && !key.trim().startsWith("sk_") ? (
        <p className="account-muted" style={{ margin: "6px 0 0", fontSize: "0.78rem", color: "var(--down, #e2726f)" }}>
          That doesn't look like a secret key — it should start with <code>sk_</code>. You may have copied the key ID.
        </p>
      ) : null}
      <form onSubmit={connect} className="account-live-form">
        <input
          aria-label="ElevenLabs API key"
          type="password"
          placeholder="ElevenLabs API key"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
        <input
          aria-label="Voice ID (optional)"
          type="text"
          placeholder="Voice ID (optional)"
          value={voice}
          onChange={(e) => setVoice(e.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
        <button type="submit" className="btn" disabled={!key.trim()}>
          Enable
        </button>
      </form>
    </div>
  );
}

/* -------------------------------------------------------- AI understanding */

function UnderstandingSection() {
  const managed = usingManagedProxy();
  const [connected, setConnected] = useState(() => hasLLMKey());
  const [key, setKey] = useState("");
  const [testMsg, setTestMsg] = useState("");
  const [testing, setTesting] = useState(false);

  function connect(e: React.FormEvent) {
    e.preventDefault();
    const k = key.trim();
    if (!k) return;
    setLLMKey(k);
    setKey("");
    setConnected(true);
    setTestMsg("");
  }

  function disconnect() {
    setLLMKey("");
    setConnected(false);
    setTestMsg("");
  }

  async function testUnderstanding() {
    setTesting(true);
    setTestMsg("Testing…");
    const canonical = await understand("any names worth keeping an eye on?");
    setTesting(false);
    setTestMsg(
      canonical
        ? `Working — understood that as “${canonical}”.`
        : `Couldn't reach it — ${llmLastError() || "unknown error"}`,
    );
  }

  // Managed proxy: understanding is on for everyone, no key to enter.
  if (managed) {
    return (
      <div className="account-live">
        <p className="account-line">
          <span className="live-dot" aria-hidden="true" /> AI understanding on
          <span className="account-muted"> · managed by Bramwell</span>
        </p>
        <p className="account-muted" style={{ margin: "4px 0 0", fontSize: "0.8rem" }}>
          Bramwell understands unfamiliar phrasing automatically — nothing to set up. It's used only as a fallback when
          his built-in understanding can't place a request, and it never invents market data.
        </p>
        <div style={{ marginTop: "8px" }}>
          <button type="button" className="btn" onClick={testUnderstanding} disabled={testing}>
            {testing ? "Testing…" : "Test"}
          </button>
        </div>
        {testMsg ? (
          <p className="account-muted" style={{ margin: "8px 0 0", fontSize: "0.8rem" }}>{testMsg}</p>
        ) : null}
      </div>
    );
  }

  if (connected) {
    return (
      <div className="account-live">
        <p className="account-line">
          <span className="live-dot" aria-hidden="true" /> AI understanding on
          <span className="account-muted"> · {maskKey(llmKey())}</span>
        </p>
        <p className="account-muted" style={{ margin: "4px 0 0", fontSize: "0.8rem" }}>
          Bramwell falls back to AI only when his built-in understanding can't place a request — so unfamiliar wording
          still lands on a real answer. It classifies the request; it never invents market data.
        </p>
        <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
          <button type="button" className="btn" onClick={testUnderstanding} disabled={testing}>
            {testing ? "Testing…" : "Test"}
          </button>
          <button type="button" className="chip" onClick={disconnect}>
            Turn off
          </button>
        </div>
        {testMsg ? (
          <p className="account-muted" style={{ margin: "8px 0 0", fontSize: "0.8rem" }}>
            {testMsg}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="account-live">
      <p className="account-muted" style={{ margin: 0 }}>
        Add an{" "}
        <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer" style={{ color: "var(--brass)" }}>
          Anthropic API key
        </a>{" "}
        so Bramwell can understand phrasings his built-in rules miss. Used only as a fallback; stored only in this
        browser. Use a key with a spend cap.
      </p>
      <form onSubmit={connect} className="account-live-form">
        <input
          aria-label="Anthropic API key"
          type="password"
          placeholder="Anthropic API key (sk-ant-…)"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
        <button type="submit" className="btn" disabled={!key.trim()}>
          Enable
        </button>
      </form>
    </div>
  );
}

/* --------------------------------------------------------------- Language */

function LanguageSection() {
  const [, force] = useState(0);
  const enabled = understandingEnabled();
  const pinned = isLangPinned();
  const current = getLang();
  const detected = detectLang();

  function choose(v: string) {
    setLang(v === "auto" ? "auto" : (v as LangCode));
    force((n) => n + 1);
  }

  return (
    <div className="account-live">
      <p className="account-muted" style={{ margin: 0 }}>
        Bramwell listens and replies in your language. It follows your device by default — change it any time.
      </p>
      <label className="account-lang-field">
        <span className="account-muted" style={{ fontSize: "0.8rem" }}>
          Speak &amp; reply in
        </span>
        <select
          className="account-select"
          aria-label="Language"
          value={pinned ? current : "auto"}
          onChange={(e) => choose(e.target.value)}
        >
          <option value="auto">Auto-detect (now: {langName(detected)})</option>
          {LANGS.map((l) => (
            <option key={l.code} value={l.code}>
              {l.native} — {l.label}
            </option>
          ))}
        </select>
      </label>
      {current !== "en" && !enabled ? (
        <p className="account-muted" style={{ margin: "8px 0 0", fontSize: "0.8rem" }}>
          To understand and reply in {langName(current)}, turn on <strong>AI understanding</strong> above. Without it
          Bramwell will still hear you in {langName(current)}, but answer in English.
        </p>
      ) : null}
    </div>
  );
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
