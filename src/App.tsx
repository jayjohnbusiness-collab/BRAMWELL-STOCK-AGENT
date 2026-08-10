import { useEffect, useRef, useState } from "react";
import { Bramwell } from "./agent/bramwell";
import { leadAlert } from "./agent/alerts";
import type { Alert, ScreenPayload } from "./agent/types";
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
  const agentRef = useRef<Bramwell | null>(null);
  if (agentRef.current === null) agentRef.current = new Bramwell();
  const agent = agentRef.current;

  const idRef = useRef(1);
  const stepRef = useRef(0);

  const [messages, setMessages] = useState<ChatMessage[]>([INTRO]);
  const [working, setWorking] = useState(false);
  const [screen, setScreen] = useState<ScreenPayload>({ kind: "none" });
  const [alert, setAlert] = useState<Alert | null>(null);
  const [awaitingChoice, setAwaitingChoice] = useState(false);
  const [, setTick] = useState(0);

  // The simulated feed ticks calmly; prices cross-fade, nothing pulses.
  useEffect(() => {
    const id = window.setInterval(() => {
      stepRef.current += 1;
      agent.market.tick(stepRef.current);
      setTick((t) => t + 1);
    }, 1600);
    return () => window.clearInterval(id);
  }, [agent]);

  // The one unprompted alert of the session, surfaced a beat after arrival —
  // the whole point being that most of the time there is nothing here.
  useEffect(() => {
    const id = window.setTimeout(() => setAlert(leadAlert(agent.market)), 3500);
    return () => window.clearTimeout(id);
  }, [agent]);

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
            watchlist={agent.market.held()}
            alert={alert}
            onAck={() => setAlert(null)}
          />
        </div>
      </div>
    </div>
  );
}
