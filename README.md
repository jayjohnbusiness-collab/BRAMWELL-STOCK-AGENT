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
npm run typecheck  # types only
```

No API keys, no network calls: fonts are bundled locally and the market feed is
simulated, so it runs fully offline.

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

## Architecture

The agent brain (`src/agent/`) contains no React and no transport. It takes an
utterance plus a session and returns a reply, which keeps the butler logic
testable and portable — today it runs in the browser against simulated data;
tomorrow it can sit behind an API against a real feed.

| File | Responsibility |
| --- | --- |
| `agent/types.ts` | Domain types: instruments, subject/session, replies, alerts. |
| `agent/seed.ts` | Simulated instruments, shaped to exercise the hard behaviors. |
| `agent/market.ts` | The feed: movers, symbol/name resolution, ambiguity, ticking. |
| `agent/nlu.ts` | Rules-based intent parser — the seam where an LLM would go. |
| `agent/format.ts` | Spoken (rounded, in words) vs. on-screen (exact, tabular). |
| `agent/alerts.ts` | The unprompted alert bar: move **and** cause, one line only. |
| `agent/bramwell.ts` | The brain: routing, subject memory, and every reply shape. |

The UI (`src/components/`, `src/brand/`) and the design system
(`src/styles/`) render that logic under the brand rules.

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
