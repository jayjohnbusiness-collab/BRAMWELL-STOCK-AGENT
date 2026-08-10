import { useState } from "react";

/*
 * The composer. Suggestion chips double as a tour of the behaviors the spec
 * cares about: a summary, a quote, a follow-up, a declined recommendation,
 * and a watchlist read.
 */
const SUGGESTIONS = [
  "What's moving on the Nasdaq today?",
  "How's NVDA?",
  "What about the losers?",
  "Should I buy Tesla?",
  "How are my holdings?",
  "How's Delta?",
];

export function Composer({
  onSend,
  awaitingChoice,
}: {
  onSend: (text: string) => void;
  awaitingChoice: boolean;
}) {
  const [value, setValue] = useState("");

  function submit(text: string) {
    const t = text.trim();
    if (!t) return;
    onSend(t);
    setValue("");
  }

  return (
    <form
      className="composer"
      onSubmit={(e) => {
        e.preventDefault();
        submit(value);
      }}
    >
      <div className="chips" aria-label="Suggestions">
        {SUGGESTIONS.map((s) => (
          <button type="button" key={s} className="chip" onClick={() => submit(s)}>
            {s}
          </button>
        ))}
      </div>
      <div className="composer-row">
        <input
          aria-label="Ask Bramwell"
          placeholder={awaitingChoice ? "Which one?" : "Ask Bramwell…"}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoFocus
        />
        <button type="submit" className="btn">
          Ask
        </button>
      </div>
    </form>
  );
}
