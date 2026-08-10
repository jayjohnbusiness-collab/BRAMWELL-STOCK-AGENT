# Bramwell

> You'll hear from Bramwell when it matters.

Bramwell is a market-monitoring agent with the manner of a butler. He watches
the tickers and indices you set, and speaks only when something is worth the
interruption. Every competitor sells more; Bramwell sells less.

This repository is a **full agent scaffold** — a running front-end that
embodies the brand system and, behind it, a transport-agnostic "butler" brain
that implements the conversation spec against a simulated market feed. It is
the foundation the real product is built on, not a throwaway mock.

## Running it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build to dist/
npm test           # run the agent-brain test suite (Vitest)
npm run typecheck  # types only
```

By default there are no API keys and no network calls: fonts are bundled
locally and the market feed is simulated, so it runs fully offline.

### Going live

The feed is swappable behind a `Feed` interface. Provide a
[Finnhub](https://finnhub.io) token and the app runs against real prices with
no other changes:

```bash
echo 'VITE_FINNHUB_TOKEN=your_token_here' > .env.local
npm run dev
```

The real adapter reports honestly within its limits: indices and prior-session
change aren't on the free tier, and it attaches no cause to a move — which is
exactly what makes Bramwell say "I don't have a reason for it yet." (The token
rides in the browser for this dev scaffold; a production deployment should
proxy the feed through a backend.)

## What's here

The left pane is the conversation; the right pane is **the screen** — the same
answer delivered twice, differently. Spoken, Bramwell rounds and caps at three
items; on screen the figures are exact and tabular. Try the suggestion chips:

- **"What's moving on the Nasdaq today?"** — a *summary*, not a leaderboard:
  the shape of the day, three examples, and the connective tissue.
- **"What about the losers?"** then **"Just the ones I hold."** — follow-ups
  resolve against the held subject without restatement.
- **"How's NVDA?"** then **"And yesterday?"** — resolve-out-loud (he says
  "NVIDIA"), then a day-shift on the same name.
- **"How's Moderna?"** — a real move with no established cause. He says so; he
  never invents one.
- **"Should I buy Tesla?"** — declined in character, then the facts handed back.
- **"How's Delta?"** then **"The airline."** — a genuine ambiguity is proposed
  as an either/or, never silently guessed.

Shortly after load, one **unprompted alert** appears — the only kind that
clears the bar: a real move *with* a probable cause attached. Most of the time
that panel is quiet, and that is Bramwell working correctly.

### Voice

Toggle the mic (top-left of the composer) and Bramwell listens for the wake
word **"Hey Bramwell"** — or a bare "Bramwell"; "Bram" alone is rejected.
Acknowledgement is silent: no chime, just the mic ring turning brass. After an
exchange a short follow-up window stays open, so "and yesterday?" works without
saying his name again. Replies are read aloud (unhurried, low), and **barge-in**
stops him mid-word the instant you speak. Recognition uses the browser Web
Speech API; where it isn't available the mic disables itself and the typed
composer carries on. The watchlist is editable by voice too — "watch Tesla",
"stop watching Apple."

## Architecture

The agent brain (`src/agent/`) contains no React and no transport. It takes an
utterance plus a session and returns a reply, which keeps the butler logic
testable and portable — today it runs in the browser against simulated data;
tomorrow it can sit behind an API against a real feed.

| File | Responsibility |
| --- | --- |
| `agent/types.ts` | Domain types: instruments, subject/session, replies, alerts. |
| `agent/market.ts` | The read-model: movers, symbol/name resolution, ambiguity. |
| `agent/nlu.ts` | Rules-based intent parser — the seam where an LLM would go. |
| `agent/format.ts` | Spoken (rounded, in words) vs. on-screen (exact, tabular). |
| `agent/alerts.ts` | The unprompted alert bar: move **and** cause, one line only. |
| `agent/bramwell.ts` | The brain: routing, subject memory, and every reply shape. |
| `agent/seed.ts` | The instrument registry, shaped to exercise the hard behaviors. |

Data comes through a `Feed` (`src/feed/`): the `Market` holds a synchronous
snapshot, and a feed hydrates it via `applyQuotes()`. `SimulatedFeed` is the
default; `FinnhubFeed` is a real adapter — same brain, different data source.
`src/hooks/useMarketFeed.ts` owns the live loop (poll → overlay → re-evaluate
the alert). The watchlist is real user state, persisted to localStorage
(`src/watchlist/`) and editable by click or by voice.

Voice lives in `src/speech/`: a pure, tested wake-word detector
(`wakeword.ts`), plus thin wrappers over the browser's speech recognition and
synthesis; `src/hooks/useVoice.ts` composes them (wake → command, barge-in,
spoken replies). The UI (`src/components/`, `src/brand/`) and the design system
(`src/styles/`) render all of it under the brand rules.

### Cause attribution

A price feed knows a name *moved*; it does not know *why* — and the why is the
whole product. Attribution (`src/attribution/`) is a separate step, parallel to
the feed, with one governing rule from spec §7: **Bramwell never invents a
cause.** The pure core (`attribute.ts`) turns retrieved news into a cause **or
null**, and the cause text is always built from a real headline and a named
source — never composed from nothing. So the failure mode is silence, not a
plausible fake.

- `SimulatedAttributor` runs against a seeded newsroom (`news.ts`);
  `FinnhubNewsAttributor` runs the identical rule against live company news.
- Sourcing sets confidence: a major wire is **reported**; anything thinner is
  **unconfirmed** and does *not* clear the unprompted alert bar; nothing recent
  is **null** ("I don't have a reason for it yet — I'll tell you when there is
  one").
- `useMarketFeed` attaches causes to names that moved, caches attempts, and
  retries later so a story that breaks after the move can still upgrade a null.

Because causes come from attribution rather than the feed, both feeds report
only price and move; the newsroom is the single place a "why" originates.

### Tests

`npm test` runs a Vitest suite over the brain (it's pure, so no DOM is
involved): the summary-not-leaderboard shape and connective tissue, subject
memory across follow-ups, resolve-out-loud and the ambiguity proposal, the
day-shift, uncertainty stated rather than invented, the advice decline, the
scope/failure lines, the silent wake, the spoken-vs-screen formatting, the
alert bar, and the feed overlay rules. These are the contract an LLM-backed
`nlu.ts` would have to keep green.

## Brand fidelity

The three source documents map into the code as follows:

- **Palette & type** — `styles/tokens.css`, `styles/typography.css`. Parchment
  ground, ink text, a single brass accent. Red and green (`--data-up` /
  `--data-down`) appear **only** on numbers that represent change — never on
  buttons, links, or states. Newsreader for the wordmark and headlines, Archivo
  for everything else, tabular figures mandatory on every updating number.
- **Voice** — `agent/format.ts` and `agent/bramwell.ts`. Full sentences,
  sentence case, no emoji or exclamation, neutral on gains and losses. Every
  change value carries a written sign as well as a color.
- **Conversation** — `agent/bramwell.ts`. Answer → cause → stop; summaries over
  tables; subject held across follow-ups; uncertainty stated plainly; advice
  declined; ambiguity proposed; a silent wake.
- **The mark** — `brand/Bell.tsx`. A butler's call bell, ink or brass, never
  animated.
- **Interface rules** — generous whitespace, hairline rules over boxes, 2px
  radius, no dark mode, prices cross-fade rather than flash, one brass accent,
  reduced motion respected, keyboard focus on a 2px brass outline.

## Naming discipline

The agent is **Bramwell**; the humans are the **Bramwell team**. Only the
software speaks in this voice — a person never writes in the agent's voice, and
a user must always be able to tell which one they are talking to. Bramwell
reports; he never advises. Anything approaching investment advice is out of
voice and out of regulatory bounds, and is treated as a hard rule.
