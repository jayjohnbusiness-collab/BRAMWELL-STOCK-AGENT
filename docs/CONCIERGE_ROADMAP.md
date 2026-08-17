# Bramwell Concierge — Build Roadmap

**Goal:** turn Bramwell from a free, browser-only market butler into a
**$100/month voice-first market analyst on call** — the "Bramwell Concierge"
tier. The AI voice is the hero; the price is paid for what the voice *knows
and does*.

**Positioning check.** $100/mo is a real tier, not a fantasy number. Benzinga
Pro charges $147–197/mo for a real-time news + spoken **audio squawk**; Trade
Ideas charges $127–254/mo for its **Holly AI** signals; Seeking Alpha Pro is
~$200/mo; Koyfin tops out at $299/mo. Nobody pays that for a nicer interface —
they pay for **licensed data, an edge, and time saved**. Concierge has to
deliver the same class of substance, wrapped in voice.

---

## The must-have four (this is the $100 justification)

Everything else is a moat-widener. These four, together, *are* "an analyst on
call" — ship them and the price is defensible:

1. **Licensed real-time data + news feed** — the cost floor everything sits on.
2. **Live spoken squawk that phones you** — breaking news and level breaks read
   aloud, and an outbound call/SMS the moment something moves *your* holdings.
   This is the hero, and Benzinga already proves it's a $150 feature.
3. **A genuine AI analyst** — reasons over filings (10-K/10-Q), earnings
   transcripts, and news (RAG) so "why is NVDA down?" gets a sourced answer,
   not a scripted line.
4. **Your real portfolio, linked** — via Plaid / SnapTrade, so the alerts, the
   risk read, and the proactive calls are about actual money.

---

## Two constraints that shape everything

- **This needs a backend.** None of the above can run in the browser on
  localStorage. $100/mo implies a server, auth, a database, and real per-user
  COGS: data-feed licensing + LLM inference + telephony minutes. The unit
  economics work at $100, but Concierge is a *service*, not a static site.
- **There's a regulatory line.** The moment Bramwell says "buy," "sell," or
  "you should hedge," we may cross into **investment advice** (RIA
  registration, compliance). Product rule: **inform and surface, do not
  recommend.** "Your tech exposure is 60% of the book, here's the correlation"
  is fine; "sell NVDA" is not. This shapes copy, features, and disclaimers from
  day one — loop in counsel before launch.

---

## Phases

Validation-first. Each phase has an exit gate; don't fund the next phase until
the current gate is met. Effort estimates assume a small team and are directional.

### Phase 0 — Validate the price (before building anything heavy)
**Goal:** prove people will pay $100 *before* paying for data licenses.
- Ship the "Coming soon / Request early access" Concierge tier on the landing
  page (**done** — this repo).
- Capture real interest: waitlist email form → measure click-through and signups.
- **Concierge MVP (Wizard-of-Oz):** hand-deliver spoken briefings + squawk-style
  alerts to the first 5–10 users (manually, over the phone / voice notes). Charge
  a founding rate. See what they actually value and keep using.
- **Exit gate:** a credible number of waitlist signups + ≥5 users who'd pay a
  founding rate and stay engaged for 4+ weeks. If this fails, re-scope the price.
- *Effort: 1–2 weeks + ongoing concierge time. COGS: ~nil.*

### Phase 1 — Backend foundation
**Goal:** the platform everything else needs.
- Server + real accounts (replace the soft client-side login gate with real auth).
- Database (users, watchlists, holdings, alert rules, preferences).
- Secrets management, hosting, logging, error monitoring.
- Migrate today's browser-only state to server-synced accounts.
- **Exit gate:** a user can sign up, log in from any device, and see synced state.
- *Effort: 3–5 weeks. COGS: hosting + DB (low, fixed).*

### Phase 2 — Licensed real-time data + news
**Goal:** the data floor. Table stakes for a paid market tool.
- Select vendor(s): real-time quotes (e.g. Polygon / market-data provider) and a
  licensed **news** feed (e.g. Benzinga / provider). Confirm redistribution terms
  for reading headlines aloud.
- Server-side data proxy + streaming (websockets) to clients.
- Retire the "bring your own Finnhub key" model for this tier.
- **Exit gate:** live quotes + streaming news in-app, within licensing terms.
- *Effort: 3–4 weeks. **COGS: the big one** — per-user real-time data licensing.*

### Phase 3 — The hero: spoken squawk + outbound calls/SMS
**Goal:** the flagship voice experience. This is what $100 buys.
- News/price-event → **text-to-speech** pipeline (natural voice for Bramwell).
- **Telephony** (e.g. Twilio): outbound calls + SMS when a material event hits a
  user's holdings or a level they set.
- User rules: what triggers a call vs a whisper vs a text; **quiet hours**;
  per-holding sensitivity. (Getting "when to interrupt" right is the whole game.)
- In-app live squawk that reads headlines aloud as they land.
- **Exit gate:** a user sets a rule, a real event fires, and Bramwell calls with a
  correct, timely, natural spoken update.
- *Effort: 4–6 weeks. COGS: TTS + telephony minutes (per-use).*

### Phase 4 — The AI analyst (RAG over filings & earnings)
**Goal:** substance behind the voice — answers, not scripts.
- Ingest 10-K/10-Q (EDGAR), earnings-call transcripts, and news into a vector store.
- LLM analyst endpoint: sourced "why" answers, guidance/earnings summaries,
  filing Q&A — all citing the source, all staying on the *inform* side of the line.
- Wire it into both chat and voice.
- **Exit gate:** "why is X moving / summarize X's guidance" returns accurate,
  sourced answers for any covered name.
- *Effort: 4–6 weeks. COGS: LLM inference + embeddings (per-use).*

### Phase 5 — Brokerage link + portfolio risk
**Goal:** make it *their* money, so the proactivity is worth $100.
- Connect real holdings via **Plaid / SnapTrade** (read-only positions first).
- Portfolio intelligence: exposure, concentration, correlation, P/L attribution,
  earnings-prep for held names — framed as risk *awareness*, not advice.
- Personalize every alert, briefing, and call around the linked book.
- **Exit gate:** a user links a brokerage and gets portfolio-aware calls/briefings.
- *Effort: 4–6 weeks. COGS: aggregator per-connection fee.*

### Phase 6 — Edge & depth (moat-wideners)
**Goal:** reasons to stay, and to tell friends.
- AI signals / screeners (unusual volume, options flow — a Holly-style layer).
- Multi-asset coverage (options, crypto, FX).
- **Memory/personalization** — Bramwell remembers your thesis and *why* you watch
  each name, so answers stay in context.
- **Exit gate:** measurable retention/engagement lift from these features.
- *Effort: ongoing. COGS: incremental data + inference.*

### Phase 7 — Billing, compliance & launch
**Goal:** charge for real, safely.
- **Stripe** subscriptions + tier gating (Free vs Concierge).
- **Compliance review**: the advice line (RIA question), data-redistribution
  terms, disclosures/disclaimers, terms of service, privacy for linked accounts.
- Founding-member pricing honored; public launch.
- **Exit gate:** first real paying subscriber, cleanly billed, compliantly.
- *Effort: 2–4 weeks + legal. COGS: payment fees.*

---

## Cost model (rough, per active Concierge user / month)

| Line | Nature | Notes |
|---|---|---|
| Real-time data + news licensing | per-user | The dominant COGS; negotiate as you scale |
| LLM inference + embeddings | per-use | Analyst answers, briefings |
| TTS + telephony (calls/SMS) | per-use | The squawk/call hero; cap with quiet hours + rules |
| Brokerage aggregator | per-connection | Plaid / SnapTrade |
| Hosting / DB / infra | fixed | Low, amortizes across users |

At $100/mo there's healthy margin over these **if** call volume and data seats
are managed. Watch two things: data-license seat cost, and runaway
call/TTS/inference usage — rules and quiet hours are cost controls, not just UX.

## Sequencing logic
Phase 0 de-risks the price. Phase 1 is the platform tax you can't skip. Then the
**must-have four land in dependency order** (2 → 3 → 4 → 5): data before squawk,
squawk before the analyst has anything to say, portfolio last because it makes
everything above personal. Phase 6 widens the moat; Phase 7 turns it on.

**Fastest path to a defensible $100:** Phase 0, then 1 → 2 → 3 gets the hero live
(a voice that calls you with real-time market intelligence). 4 and 5 are what make
it *sticky*. Don't skip 0.
