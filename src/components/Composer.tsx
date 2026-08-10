import { useState } from "react";

/*
 * The composer. Suggestion chips double as a tour of the behaviors the spec
 * cares about: a summary, a quote, a follow-up, a declined recommendation,
 * and a watchlist read. Above them, the voice controls — a mic toggle and a
 * quiet status line (a butler does not chime on wake).
 */
// Four starters, one per behavior: a market summary, a single quote, the
// losers, and a watchlist read. Shown only before the first message.
const SUGGESTIONS = [
  "What's moving on the Nasdaq today?",
  "How's NVDA?",
  "What about the losers?",
  "How are my holdings?",
];

export interface VoiceState {
  available: boolean;
  enabled: boolean;
  listening: boolean;
  speaking: boolean;
  onToggle: () => void;
}

export function Composer({
  onSend,
  awaitingChoice,
  voice,
  showSuggestions,
}: {
  onSend: (text: string) => void;
  awaitingChoice: boolean;
  voice: VoiceState;
  /** Starter prompts only make sense before the conversation begins. */
  showSuggestions: boolean;
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
      {/* A status line only when it says something: in voice mode, or when
          voice isn't available. At rest the mic's own tooltip carries it. */}
      {voice.enabled || !voice.available ? (
        <div className="voicebar">
          <span className="small state-note" aria-live="polite">
            {voiceStatus(voice)}
          </span>
        </div>
      ) : null}

      {showSuggestions ? (
        <div className="chips" aria-label="Suggestions">
          {SUGGESTIONS.map((s) => (
            <button type="button" key={s} className="chip" onClick={() => submit(s)}>
              {s}
            </button>
          ))}
        </div>
      ) : null}
      <div className="composer-row">
        <input
          aria-label="Ask Bramwell"
          placeholder={awaitingChoice ? "Which one?" : "Ask Bramwell…"}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoFocus
        />
        <button
          type="button"
          className={`mic${voice.enabled ? " on" : ""}${voice.listening ? " listening" : ""}`}
          aria-pressed={voice.enabled}
          aria-label={voice.enabled ? "Leave voice mode" : "Enter voice mode"}
          disabled={!voice.available}
          title={
            voice.available
              ? voice.enabled
                ? "Leave voice mode"
                : "Enter voice mode"
              : "Voice isn't supported in this browser"
          }
          onClick={voice.onToggle}
        >
          <MicGlyph />
        </button>
        <button type="submit" className="btn">
          Ask
        </button>
      </div>
    </form>
  );
}

function voiceStatus(v: VoiceState): string {
  if (!v.available) return "Voice isn't supported here — type instead.";
  if (!v.enabled) return "Enter voice mode.";
  return "In voice mode.";
}

function MicGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" />
      <path
        d="M6 11a6 6 0 0 0 12 0M12 17v3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
