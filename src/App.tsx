import { useRef, useState } from "react";
import { Bramwell } from "./agent/bramwell";
import { Market } from "./agent/market";
import type { ScreenPayload } from "./agent/types";
import { createFeed } from "./feed";
import { useMarketFeed } from "./hooks/useMarketFeed";
import { Bell } from "./brand/Bell";
import { Conversation, type ChatMessage } from "./components/Conversation";
import { Composer } from "./components/Composer";
import { ScreenPanel } from "./components/ScreenPanel";
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
  if (marketRef.current === null) marketRef.current = new Market();
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

  function nextId(): string {
    idRef.current += 1;
    return `m${idRef.current}`;
  }

  function handleSend(text: string) {
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
      }
      if (reply.screen && reply.screen.kind !== "none") {
        setScreen(reply.screen);
      }
      setAwaitingChoice(Boolean(reply.awaitingChoice));
    }, 650);
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
          <Composer onSend={handleSend} awaitingChoice={awaitingChoice} />
        </section>

        <div className="screen-pane">
          <ScreenPanel
            payload={screen}
            watchlist={market.held()}
            alert={alert}
            onAck={alert ? () => ack(alert.id) : undefined}
          />
        </div>
      </div>
    </div>
  );
}
