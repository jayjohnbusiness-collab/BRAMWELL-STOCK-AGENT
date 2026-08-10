import { useRef, useState } from "react";
import { Bramwell } from "./agent/bramwell";
import { Market } from "./agent/market";
import type { ScreenPayload } from "./agent/types";
import { createFeed } from "./feed";
import { createAttributor } from "./attribution";
import { useMarketFeed } from "./hooks/useMarketFeed";
import { useVoice } from "./hooks/useVoice";
import { loadWatchlist, saveWatchlist, loadCustom, saveCustom } from "./watchlist/storage";
import { hasToken } from "./feed/token";
import { Bell } from "./brand/Bell";
import { Conversation, type ChatMessage } from "./components/Conversation";
import { Composer } from "./components/Composer";
import { ScreenPanel } from "./components/ScreenPanel";
import { WatchlistManager } from "./components/WatchlistManager";
import { VoiceOverlay } from "./components/VoiceOverlay";
import { LiveDataControl } from "./components/LiveDataControl";
import "./styles/global.css";
import "./styles/app.css";

// A butler is always in the room: one quiet line of presence on arrival,
// no chime, no "Yes?".
const INTRO: ChatMessage = {
  id: "intro",
  from: "bramwell",
  text: "I'm watching the names you've set. I'll speak up when something's worth it.",
};

export default function App() {
  // The Market (read-model) and Bramwell (brain) are built once and shared:
  // the feed hydrates the Market, and the brain reads the same instance.
  const marketRef = useRef<Market | null>(null);
  if (marketRef.current === null) {
    const market = new Market();
    // Re-add any tickers the user added beyond the built-in set, so the saved
    // watchlist can reference them.
    for (const c of loadCustom()) {
      market.add({
        symbol: c.symbol,
        name: c.name,
        kind: "equity",
        basePrice: 0,
        changePct: 0,
        prevChangePct: 0,
        cause: null,
      });
    }
    const saved = loadWatchlist();
    if (saved) market.setWatchlist(saved); // the persisted list wins over defaults
    marketRef.current = market;
  }
  const market = marketRef.current;

  const agentRef = useRef<Bramwell | null>(null);
  if (agentRef.current === null) agentRef.current = new Bramwell(market);
  const agent = agentRef.current;

  const feedRef = useRef(createFeed());
  const attributorRef = useRef(createAttributor());
  const { alert, ack, feedStatus } = useMarketFeed(
    market,
    feedRef.current,
    attributorRef.current,
  );

  const idRef = useRef(1);
  const [messages, setMessages] = useState<ChatMessage[]>([INTRO]);
  const [working, setWorking] = useState(false);
  const [screen, setScreen] = useState<ScreenPayload>({ kind: "none" });
  const [awaitingChoice, setAwaitingChoice] = useState(false);
  const [, forceRender] = useState(0);

  // Voice dispatches spoken commands through the same pipeline as typing.
  // A ref breaks the definition cycle (the hook needs the handler, the handler
  // needs the hook's speak/cancel).
  const dispatchRef = useRef<(text: string) => void>(() => {});
  const voice = useVoice((text) => dispatchRef.current(text));

  function nextId(): string {
    idRef.current += 1;
    return `m${idRef.current}`;
  }

  // Persist the watchlist (and any user-added tickers) and re-render.
  function persist() {
    saveWatchlist(market.watchlistSymbols());
    saveCustom(market.customInstruments());
    forceRender((n) => n + 1);
  }

  function handleSend(text: string) {
    voice.cancel(); // a new request stops Bramwell mid-word
    setMessages((prev) => [...prev, { id: nextId(), from: "user", text }]);
    setWorking(true);

    // Answer inside two seconds or show a quiet working state; no filler.
    window.setTimeout(() => {
      const reply = agent.respond(text);
      setWorking(false);
      if (reply.spoken.trim().length > 0) {
        setMessages((prev) => [
          ...prev,
          { id: nextId(), from: "bramwell", text: reply.spoken },
        ]);
        voice.speak(reply.spoken); // spoken aloud only when voice is on
      }
      if (reply.screen && reply.screen.kind !== "none") {
        setScreen(reply.screen);
      }
      setAwaitingChoice(Boolean(reply.awaitingChoice));
      persist(); // Bramwell may have edited the watchlist ("watch Tesla")
    }, 650);
  }
  dispatchRef.current = handleSend;

  // Add a name to the watchlist. Known names resolve through the brain; an
  // unknown ticker is looked up live from the feed (name + quote) and added.
  async function handleAdd(text: string): Promise<string> {
    const res = market.resolve(text);
    if (res.status === "ambiguous") {
      const [a, b] = res.options;
      return `Which one — ${a.name}, or ${b.name}?`;
    }
    if (res.status === "ok") {
      if (market.isWatched(res.instrument.symbol)) {
        return `${res.instrument.name} is already on the list.`;
      }
      market.watch(res.instrument.symbol);
      persist();
      return "";
    }

    // Not a known name — look it up live: first as a ticker, then by company
    // name (e.g. "Amazon" → AMZN).
    const feed = feedRef.current;
    if (!feed.lookup) return "I don't have anything by that name.";

    const candidate = symbolCandidate(text);
    let found = candidate ? await feed.lookup(candidate) : null;
    if (!found && feed.search) {
      const hit = await feed.search(text);
      if (hit) found = await feed.lookup(hit.symbol);
    }

    if (found) {
      market.add({
        symbol: found.symbol,
        name: found.name,
        kind: "equity",
        basePrice: found.price,
        changePct: found.changePct,
        prevChangePct: 0,
        cause: null,
      });
      market.watch(found.symbol);
      persist();
      return "";
    }
    return hasToken()
      ? `I couldn't find anything for "${text.trim()}".`
      : `Connect live data to add "${text.trim()}".`;
  }

  function handleRemove(symbol: string) {
    market.unwatch(symbol);
    // A user-added ticker is dropped entirely so it isn't re-fetched.
    if (market.isCustom(symbol)) market.removeInstrument(symbol);
    persist();
  }

  const lastReply = [...messages].reverse().find((m) => m.from === "bramwell")?.text;

  return (
    <div className="app-shell">
      <header className="app-header">
        <Bell size={30} tone="brass" />
        <span className="wordmark">Bramwell</span>
        <div className="header-right">
          <span className="tagline small state-note">
            You'll hear from Bramwell when it matters.
          </span>
          <LiveDataControl />
        </div>
      </header>
      <hr className="rule" />

      {hasToken() ? (
        <p
          className="small"
          style={{
            margin: "var(--space-3) 0 0",
            color:
              feedStatus && feedStatus.ok === 0 && feedStatus.failed > 0
                ? "var(--data-down)"
                : "var(--ink-soft)",
          }}
        >
          {feedStatus == null
            ? "Live data — connecting…"
            : feedStatus.ok > 0
              ? `Live data · ${feedStatus.ok} symbols updating${
                  feedStatus.sample
                    ? ` — ${feedStatus.sample.symbol} at ${feedStatus.sample.price.toFixed(2)}`
                    : ""
                }.`
              : `Live data received no prices — ${feedStatus.error ?? "request failed"}. Prices shown are placeholders.`}
        </p>
      ) : null}

      <div className="app-grid">
        <section className="conv-pane" aria-label="Conversation">
          <Conversation messages={messages} working={working} />
          <Composer
            onSend={handleSend}
            awaitingChoice={awaitingChoice}
            voice={{
              available: voice.available,
              enabled: voice.enabled,
              listening: voice.listening,
              speaking: voice.speaking,
              onToggle: voice.toggle,
            }}
          />
        </section>

        <div className="screen-pane">
          <ScreenPanel
            payload={screen}
            alert={alert}
            onAck={alert ? () => ack(alert.id) : undefined}
          />
          <WatchlistManager
            watched={market.held()}
            onAdd={handleAdd}
            onRemove={handleRemove}
          />
        </div>
      </div>

      {voice.enabled ? (
        <VoiceOverlay
          interim={voice.interim}
          error={voice.error}
          working={working}
          speaking={voice.speaking}
          lastReply={lastReply}
          onExit={voice.toggle}
        />
      ) : null}
    </div>
  );
}

/** A plausible ticker from typed text (e.g. "googl" → "GOOGL", "brk.b" → "BRK.B"). */
function symbolCandidate(text: string): string | null {
  const m = text.trim().toUpperCase().match(/^[A-Z][A-Z.]{0,5}$/);
  return m ? m[0] : null;
}
