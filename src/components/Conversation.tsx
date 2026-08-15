import { useEffect, useRef } from "react";

export interface ChatMessage {
  id: string;
  from: "user" | "bramwell";
  text: string;
  /** Epoch milliseconds when the message was sent. */
  ts?: number;
}

/** "3:42 PM · Aug 15, 2026" — the time and date under a message. */
function stamp(ms: number): string {
  try {
    const time = new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
    }).format(ms);
    const date = new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(ms);
    return `${time} · ${date}`;
  } catch {
    return "";
  }
}

/** The conversation transcript, plus the quiet, wordless working state. */
export function Conversation({
  messages,
  working,
}: {
  messages: ChatMessage[];
  working: boolean;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  // Stick to the bottom only while the reader is already there. If they've
  // scrolled up to read history, a new message won't yank them back down.
  const stick = useRef(true);

  useEffect(() => {
    const el = listRef.current;
    // Jump (not animate) to the bottom — a smooth scroll here fights the wheel.
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [messages.length, working]);

  function handleScroll() {
    const el = listRef.current;
    if (!el) return;
    stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }

  return (
    <div
      className="messages"
      role="log"
      aria-live="polite"
      ref={listRef}
      onScroll={handleScroll}
    >
      {messages.map((m) => (
        <div key={m.id} className={`msg msg-${m.from}`}>
          <div className="label msg-who">{m.from === "user" ? "You" : "Bramwell"}</div>
          <p className="msg-body">{m.text}</p>
          {m.ts ? <div className="msg-time">{stamp(m.ts)}</div> : null}
        </div>
      ))}
      {working ? (
        <div className="msg msg-bramwell" aria-label="Bramwell is working">
          <div className="label msg-who">Bramwell</div>
          <div className="working" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        </div>
      ) : null}
    </div>
  );
}
