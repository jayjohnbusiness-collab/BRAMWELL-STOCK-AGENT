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

### Concierge early-access waitlist

The landing page's "Request early access" form (Phase 0 price validation for
the $100 Concierge tier — see `docs/CONCIERGE_ROADMAP.md`) sends signups (email
+ an optional "what would make it worth $100/mo" answer) to a form you own.
Two transports are supported, in `src/waitlist.ts`:

**Google Forms** (configured in the `GOOGLE_FORM` constant). Fill in the two
field IDs from the form's *Get pre-filled link*:

1. Open the form → **⋮** (top-right) → **Get pre-filled link**.
2. Type a dummy email and pick an interest → **Get link** → **Copy link**.
3. The copied URL contains `entry.<id>=<dummy>` pairs — the number before your
   dummy email is `emailField`, the one before the interest is `interestField`.

Submissions go to the form's `/formResponse` endpoint via a hidden iframe
(Google sends no CORS headers, so the response is opaque — the entry still
records, we just report success once it's sent).

**JSON endpoint** (Formspree / Netlify / serverless — anything that accepts a
JSON POST). Takes precedence over the Google Form when set, which is handy for
testing:

```bash
echo 'VITE_WAITLIST_ENDPOINT=https://formspree.io/f/your_id' >> .env.local
```

…or without a rebuild via `?waitlist=<url>` or a `bramwell.waitlist.endpoint`
localStorage key. With neither configured, submissions are kept on-device only
and the UI still confirms — so the flow is testable — but no lead reaches you.

## What's here

The left pane is the conversation; the right pane is **the screen** — the same
answer delivered twice, differently. Spoken, Bramwell rounds and caps at three
items; on screen the figures are exact and tabular. Try the suggestion chips:

- **"What's moving on the Nasdaq today?"** — a *summary*, not a leaderboard:
  the shape of the day, three examples, and the connective tissue.
- **"What about the losers?"** then **"Just the ones I hold."** — follow-ups
  resolve against the held subject without restatement.
- **"How's NVDA?"** then **"And yesterday?"** — resolve-out-loud (he says
  "NVIDIA"), then a day-shift on the same name. By voice you can also spell a
  ticker ("N-V-D-A", "en-vee-dee-ay") or mis-say a name ("broad com") and still
  be understood — see ticker recognition below.
- **"How's Moderna?"** — a real move with no established cause. He says so; he
  never invents one.
- **"Should I buy Tesla?"** — declined in character, then the facts handed back.
- **"How's Delta?"** then **"The airline."** — a genuine ambiguity is proposed
  as an either/or, never silently guessed.

Shortly after load, one **unprompted alert** appears — the only kind that
clears the bar: a real move *with* a probable cause attached. Most of the time
that panel is quiet, and that is Bramwell working correctly.

### Voice

Toggle the mic (top-left of the composer) to enter **voice mode**. Once you're
in it you've addressed Bramwell, so every utterance is a command — no wake word
needed (a leading "Hey Bramwell" is simply stripped). Replies are read aloud
(unhurried, low) and shown as text, and **barge-in** stops him mid-word the
instant you speak. Recognition uses the browser Web Speech API (Chrome/Edge);
where it isn't available, or the mic is blocked, the surface says so and the
typed composer carries on. The watchlist is editable by voice too — "watch
Tesla", "stop watching Apple."

Voice mode is a full-screen **dark surface** — a deliberate, scoped departure
from the parchment app. It stays Bramwell: the same ink, brass, and parchment,
inverted onto a dark ground, with a brass orb (the call bell) that breathes and
swells as you speak, and the live transcript and answer set large. The orb is
driven by a synthetic wave rather than a second microphone capture, so nothing
competes with speech recognition for the mic. No neon; reduced motion holds the
orb still. The main app never goes dark.

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

### Ticker recognition

Speech recognition mangles tickers — letter strings are acoustically thin and
mishears split or distort names — so `src/agent/resolver.ts` is a pure recovery
ladder, tried in decreasing certainty (spec §5):

1. An explicit symbol token (`AAPL`, `$NVDA`), or any token that *is* a symbol
   in any case (`avgo`).
2. A **spelled-out ticker** — typed or phonetic letters that assemble into a
   real symbol (`n v d a`, `en vee dee ay` → NVDA). It only accepts an assembled
   string that exists in the registry, so it can't fire on ordinary speech.
3. A **name**, including word-split (`broad com` → Broadcom) and lightly
   distorted (`tessla` → Tesla) forms, via squashed n-grams + edit-distance.
4. Genuine collisions are **proposed, never guessed** ("Delta Air Lines, or
   Delta Apparel?"); saying the fuller name resolves it. Below the confidence
   floor Bramwell says he has nothing by that name rather than guess wrong — and
   for a lowercase voice transcript that was *close* to a name, he echoes it
   ("I heard 'Tesler'"), reserving "that's outside what I follow" for queries
   that weren't names at all.

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
- Relevance by direction (`sentiment.ts`): a headline whose sentiment
  *contradicts* the move — bullish news on a name that fell — is refused
  outright, because attaching it would mislead. Among the rest, a credible
  source wins first, then directional alignment, then recency; neutral
  (factually worded) headlines are kept, not penalized.
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
