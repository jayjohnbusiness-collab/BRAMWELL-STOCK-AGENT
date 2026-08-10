import { useRef, useState } from "react";
import { Bramwell } from "./agent/bramwell";
import { Market } from "./agent/market";
import type { ScreenPayload } from "./agent/types";
import { createFeed } from "./feed";
import { useMarketFeed } from "./hooks/useMarketFeed";
import { useVoice } from "./hooks/useVoice";
import { loadWatchlist, saveWatchlist } from "./watchlist/storage";
import { Bell } from "./brand/Bell";
import { Conversation, type ChatMessage } from "./components/Conversation";
import { Composer } from "./components/Composer";
import { ScreenPanel } from "./components/ScreenPanel";
import { WatchlistManager } from "./components/WatchlistManager";
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
    const saved = loadWatchlist();
    if (saved) market.setWatchlist(saved); // the persisted list wins over defaults
    marketRef.current = market;
  }
  const market = marketRef.current;

  const agentRef = useRef<Bramwell | null>(null);
  if (agentRef.current === null) agentRef.current = new Bramwell(market);
  const agent = agentRef.current;

  const feedRef = useRef(createFeed());
  const { alert, ack } = useMarketFeed(market, feedRef.current);

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

  // Persist the watchlist and re-render after any change (spoken or clicked).
  function persist() {
    saveWatchlist(market.watchlistSymbols());
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

  // The watchlist editor resolves through the same brain, reporting in voice.
  function handleAdd(text: string): string {
    const res = market.resolve(text);
    if (res.status === "ambiguous") {
      const [a, b] = res.options;
      return `Which one — ${a.name}, or ${b.name}?`;
    }
    if (res.status !== "ok") return "I don't have anything by that name.";
    if (market.isWatched(res.instrument.symbol)) {
      return `${res.instrument.name} is already on the list.`;
    }
    market.watch(res.instrument.symbol);
    persist();
    return "";
  }

  function handleRemove(symbol: string) {
    market.unwatch(symbol);
    persist();
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <Bell size={30} tone="brass" />
        <span className="wordmark">Bramwell</span>
        <p className="tagline small state-note">
          You'll hear from Bramwell when it matters.
        </p>
      </header>
      <hr className="rule" />

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
          <hr className="rule" style={{ margin: "var(--space-5) 0" }} />
          <WatchlistManager
            watched={market.held()}
            onAdd={handleAdd}
            onRemove={handleRemove}
          />
        </div>
      </div>
    </div>
  );
}
