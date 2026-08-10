import { useEffect, useRef } from "react";

export interface ChatMessage {
  id: string;
  from: "user" | "bramwell";
  text: string;
}

/** The conversation transcript, plus the quiet, wordless working state. */
export function Conversation({
  messages,
  working,
}: {
  messages: ChatMessage[];
  working: boolean;
}) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, working]);

  return (
    <div className="messages" role="log" aria-live="polite">
      {messages.map((m) => (
        <div key={m.id} className={`msg msg-${m.from}`}>
          <div className="label msg-who">{m.from === "user" ? "You" : "Bramwell"}</div>
          <p className="msg-body">{m.text}</p>
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
      <div ref={endRef} />
    </div>
  );
}
