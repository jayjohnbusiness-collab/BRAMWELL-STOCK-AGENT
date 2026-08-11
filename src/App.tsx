import { useRef, useState } from "react";
import { Bramwell } from "./agent/bramwell";
import { Market } from "./agent/market";
import { isPortfolioValueQuery, parse, parsePosition, parseTrigger, watchTarget } from "./agent/nlu";
import type { Instrument, ScreenPayload } from "./agent/types";
import { createFeed } from "./feed";
import { createAttributor } from "./attribution";
import { useMarketFeed } from "./hooks/useMarketFeed";
import { useVoice } from "./hooks/useVoice";
import { loadWatchlist, saveWatchlist, loadCustom, saveCustom } from "./watchlist/storage";
import { hasToken } from "./feed/token";
import { TriggerStore } from "./triggers/store";
import { firedLine, type Trigger, type TriggerKind } from "./triggers/types";
import { fireNotification, notifyState, requestNotify } from "./notify";
import { PortfolioStore } from "./portfolio/store";
import { valuePosition, portfolioTotals } from "./portfolio/types";
import { money } from "./components/cards/parts";
import { Bell } from "./brand/Bell";
import { Conversation, type ChatMessage } from "./components/Conversation";
import { Composer } from "./components/Composer";
import { CardBoard } from "./components/CardBoard";
import { VoiceOverlay } from "./components/VoiceOverlay";
import { LiveDataControl } from "./components/LiveDataControl";
import { ThemeToggle } from "./components/ThemeToggle";
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
  if (marketRef.current === null) {
    const market = new Market();
    // Re-add any tickers the user added beyond the built-in set, so the saved
    // watchlist can reference them.
    for (const c of loadCustom()) {
      market.add({
        symbol: c.symbol,
        name: c.name,
        kind: "equity",
        basePrice: 0,
        changePct: 0,
        prevChangePct: 0,
        cause: null,
      });
    }
    const saved = loadWatchlist();
    if (saved) market.setWatchlist(saved); // the persisted list wins over defaults
    marketRef.current = market;
  }
  const market = marketRef.current;

  const agentRef = useRef<Bramwell | null>(null);
  if (agentRef.current === null) agentRef.current = new Bramwell(market);
  const agent = agentRef.current;

  const feedRef = useRef(createFeed());
  const attributorRef = useRef(createAttributor());

  // The trigger book, built once. The live loop evaluates it; a ref indirection
  // lets the fire handler use voice/messages defined further down.
  const triggerStoreRef = useRef<TriggerStore | null>(null);
  if (triggerStoreRef.current === null) triggerStoreRef.current = new TriggerStore();
  const triggerStore = triggerStoreRef.current;
  const triggerFireRef = useRef<(fired: Trigger[]) => void>(() => {});

  // The book of positions, built once.
  const portfolioStoreRef = useRef<PortfolioStore | null>(null);
  if (portfolioStoreRef.current === null) portfolioStoreRef.current = new PortfolioStore();
  const portfolioStore = portfolioStoreRef.current;

  const { alert, ack, feedStatus } = useMarketFeed(
    market,
    feedRef.current,
    attributorRef.current,
    triggerStore,
    (fired) => triggerFireRef.current(fired),
  );

  const idRef = useRef(1);
  const [messages, setMessages] = useState<ChatMessage[]>([INTRO]);
  const [working, setWorking] = useState(false);
  const [screen, setScreen] = useState<ScreenPayload>({ kind: "none" });
  const [awaitingChoice, setAwaitingChoice] = useState(false);
  const [, forceRender] = useState(0);

  // Voice dispatches spoken commands through the same pipeline as typing.
  // A ref breaks the definition cycle (the hook needs the handler, the handler
  // needs the hook's speak/cancel).
  const dispatchRef = useRef<(text: string) => void>(() => {});
  const voice = useVoice((text) => dispatchRef.current(text));

  function nextId(): string {
    idRef.current += 1;
    return `m${idRef.current}`;
  }

  // Persist the watchlist (and any user-added tickers) and re-render.
  function persist() {
    saveWatchlist(market.watchlistSymbols());
    saveCustom(market.customInstruments());
    forceRender((n) => n + 1);
  }

  function handleSend(text: string) {
    voice.cancel(); // a new request stops Bramwell mid-word
    setMessages((prev) => [...prev, { id: nextId(), from: "user", text }]);

    // A standing alert ("tell me if NVDA drops below 200") is set here so it
    // can resolve/track the name live and register a trigger.
    const trig = parseTrigger(text);
    if (trig) {
      void setTriggerFromChat(trig);
      return;
    }

    // A portfolio value/P&L question.
    if (isPortfolioValueQuery(text)) {
      answerPortfolio();
      return;
    }

    // Recording a position ("I own 100 NVDA at 150").
    const pos = parsePosition(text);
    if (pos) {
      void setPositionFromChat(pos);
      return;
    }

    // An "add / watch" command is handled here rather than in the (network-free)
    // brain, so it can look a real ticker up live — exactly like the watchlist
    // field. Everything else goes to Bramwell as before.
    const intent = parse(text);
    if (intent.kind === "watch") {
      const target = watchTarget(text);
      if (target) {
        void addFromChat(target);
        return;
      }
    }

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
        voice.speak(reply.spoken); // spoken aloud only when voice is on
      }
      if (reply.screen && reply.screen.kind !== "none") {
        setScreen(reply.screen);
      }
      setAwaitingChoice(Boolean(reply.awaitingChoice));
      persist(); // Bramwell may have edited the watchlist ("watch Tesla")
    }, 650);
  }
  dispatchRef.current = handleSend;

  // A fired trigger: Bramwell speaks up in chat, and (if allowed) a browser
  // notification reaches the user even when the tab isn't focused.
  triggerFireRef.current = (fired: Trigger[]) => {
    for (const t of fired) {
      const i = market.bySymbol(t.symbol);
      const q = { price: i?.basePrice ?? t.value, changePct: i?.changePct ?? 0 };
      const line = firedLine(t, q);
      setMessages((prev) => [...prev, { id: nextId(), from: "bramwell", text: line }]);
      voice.speak(line);
      fireNotification("Bramwell", line);
    }
    forceRender((n) => n + 1);
  };

  // Set a standing alert from chat: resolve (and start tracking) the name, then
  // register the trigger. "hits/reaches N" picks a direction from the price.
  async function setTriggerFromChat(spec: {
    namePhrase: string;
    kind: "above" | "below" | "move" | "cross";
    value: number;
  }) {
    setWorking(true);
    const r = await addName(spec.namePhrase);
    setWorking(false);
    const inst = r.instrument;
    if (!inst) {
      const msg = r.ok ? "I couldn't place that name." : r.message;
      setMessages((prev) => [...prev, { id: nextId(), from: "bramwell", text: msg }]);
      voice.speak(msg);
      return;
    }
    let kind: TriggerKind = spec.kind === "cross" ? "above" : spec.kind;
    if (spec.kind === "cross") kind = spec.value >= inst.basePrice ? "above" : "below";
    triggerStore.add({ symbol: inst.symbol, name: inst.name, kind, value: spec.value });
    requestNotify().then(() => forceRender((n) => n + 1));

    const name = cap(inst.name);
    const line =
      kind === "move"
        ? `Very good. I'll speak up if ${name} moves ${spec.value}% either way.`
        : `Very good. I'll tell you the moment ${name} is ${kind} ${spec.value}.`;
    setMessages((prev) => [...prev, { id: nextId(), from: "bramwell", text: line }]);
    voice.speak(line);
    setScreen({ kind: "quote", instrument: inst });
    forceRender((n) => n + 1);
  }

  function say(text: string) {
    setMessages((prev) => [...prev, { id: nextId(), from: "bramwell", text }]);
    voice.speak(text);
  }

  // Record a position from chat, resolving/tracking the name first. A missing
  // cost defaults to the current price, so P/L starts at zero.
  async function setPositionFromChat(spec: {
    namePhrase: string;
    shares: number;
    cost: number;
  }) {
    setWorking(true);
    const r = await addName(spec.namePhrase);
    setWorking(false);
    const inst = r.instrument;
    if (!inst) {
      say(r.ok ? "I couldn't place that name." : r.message);
      return;
    }
    const price = market.bySymbol(inst.symbol)?.basePrice ?? 0;
    const cost = spec.cost > 0 ? spec.cost : price;
    portfolioStore.set(inst.symbol, spec.shares, cost);
    forceRender((n) => n + 1);

    const value = spec.shares * price;
    const basis = spec.cost > 0 ? ` at ${spec.cost.toFixed(2)}` : "";
    say(
      `Noted — ${trimShares(spec.shares)} ${cap(inst.name)}${basis}, worth ${money(value)} now.`,
    );
    setScreen({ kind: "quote", instrument: inst });
  }

  // Answer "what's my portfolio worth / how am I doing".
  function answerPortfolio() {
    const values = portfolioStore.all().map((p) => {
      const i = market.bySymbol(p.symbol);
      return valuePosition(p, {
        price: i?.basePrice ?? 0,
        changePct: i?.changePct ?? 0,
        name: i?.name ?? p.symbol,
      });
    });
    if (values.length === 0) {
      say("You've no positions recorded. Tell me what you hold — say, \"100 NVDA at 150\".");
      return;
    }
    const t = portfolioTotals(values);
    const overall = t.hasBasis
      ? ` It's ${t.plAbs >= 0 ? "up" : "down"} ${money(Math.abs(t.plAbs))} overall, ${
          t.plPct >= 0 ? "up" : "down"
        } ${Math.abs(t.plPct).toFixed(1)} percent.`
      : "";
    const today = ` Today it's ${t.dayAbs >= 0 ? "up" : "down"} ${money(Math.abs(t.dayAbs))}.`;
    say(`Your book is worth ${money(t.marketValue)}.${overall}${today}`);
  }

  // The shared add engine. Known names resolve through the registry; an unknown
  // ticker or company name is looked up live from the feed (name + quote) and
  // added. Returns a structured result so both the watchlist field and the chat
  // can phrase it their own way.
  type AddResult =
    | { ok: true; instrument: Instrument }
    | { ok: false; message: string; instrument?: Instrument };

  async function addName(text: string): Promise<AddResult> {
    const res = market.resolve(text);
    if (res.status === "ambiguous") {
      const [a, b] = res.options;
      return { ok: false, message: `Which one — ${a.name}, or ${b.name}?` };
    }
    if (res.status === "ok") {
      if (market.isWatched(res.instrument.symbol)) {
        return {
          ok: false,
          message: `${cap(res.instrument.name)} is already on the list.`,
          instrument: res.instrument,
        };
      }
      market.watch(res.instrument.symbol);
      persist();
      return { ok: true, instrument: res.instrument };
    }

    // Not a known name — look it up live: first as a ticker, then by company
    // name (e.g. "Amazon" → AMZN, "Shell" → SHEL).
    const feed = feedRef.current;
    if (!feed.lookup) {
      return { ok: false, message: "I don't have anything by that name." };
    }

    const candidate = symbolCandidate(text);
    let found = candidate ? await feed.lookup(candidate) : null;
    if (!found && feed.search) {
      const hit = await feed.search(text);
      if (hit) found = await feed.lookup(hit.symbol);
    }

    if (found) {
      const instrument: Instrument = {
        symbol: found.symbol,
        name: found.name,
        kind: "equity",
        basePrice: found.price,
        changePct: found.changePct,
        prevChangePct: 0,
        cause: null,
      };
      market.add(instrument);
      market.watch(found.symbol);
      persist();
      return { ok: true, instrument: market.bySymbol(found.symbol) ?? instrument };
    }
    return {
      ok: false,
      message: hasToken()
        ? `I couldn't find anything for "${text.trim()}".`
        : `Connect live data to add "${text.trim()}".`,
    };
  }

  // The watchlist "Add" field: a message to show (empty on success).
  async function handleAdd(text: string): Promise<string> {
    const r = await addName(text);
    return r.ok ? "" : r.message;
  }

  // A spoken "add / watch X" from the chat: same engine, butler phrasing, and
  // it drops the added name onto the screen like any other quote.
  async function addFromChat(target: string) {
    setWorking(true);
    const r = await addName(target);
    setWorking(false);

    const spoken = r.ok
      ? `Done. I'll keep an eye on ${cap(r.instrument.name)}.`
      : r.message;

    if (spoken.trim().length > 0) {
      setMessages((prev) => [...prev, { id: nextId(), from: "bramwell", text: spoken }]);
      voice.speak(spoken);
    }
    if (r.instrument) setScreen({ kind: "quote", instrument: r.instrument });
    setAwaitingChoice(false);
  }

  // Typeahead: closest matching tickers for a partial query, best-effort.
  async function handleSuggest(query: string): Promise<{ symbol: string; name: string }[]> {
    const feed = feedRef.current;
    if (!feed.suggest) return [];
    return feed.suggest(query);
  }

  function handleRemove(symbol: string) {
    market.unwatch(symbol);
    // A user-added ticker is dropped entirely so it isn't re-fetched.
    if (market.isCustom(symbol)) market.removeInstrument(symbol);
    persist();
  }

  const lastReply = [...messages].reverse().find((m) => m.from === "bramwell")?.text;

  // The live-feed status detail, shown beside the "Live data" badge. The badge
  // already carries the words "Live data", so this line drops that prefix.
  const liveError =
    hasToken() && feedStatus != null && feedStatus.ok === 0 && feedStatus.failed > 0;
  const liveDetail = !hasToken()
    ? null
    : feedStatus == null
      ? "connecting…"
      : feedStatus.ok > 0
        ? `${feedStatus.ok} symbols updating${
            feedStatus.sample
              ? ` — ${feedStatus.sample.symbol} at ${feedStatus.sample.price.toFixed(2)}`
              : ""
          }`
        : `no prices — ${feedStatus.error ?? "request failed"}`;

  return (
    <div className="app-shell">
      <header className="app-header">
        <Bell size={30} tone="brass" />
        <span className="wordmark">Bramwell</span>
        <span className="tagline small state-note">Your market, kept in order.</span>
        <div className="header-right">
          {liveDetail ? (
            <span
              className="small live-detail"
              style={{ color: liveError ? "var(--data-down)" : "var(--ink-soft)" }}
            >
              {liveDetail}
            </span>
          ) : null}
          <LiveDataControl />
          <ThemeToggle />
        </div>
      </header>
      <hr className="rule" />

      <div className="app-grid">
        <section className="conv-pane" aria-label="Conversation">
          <Conversation messages={messages} working={working} />
          <Composer
            onSend={handleSend}
            awaitingChoice={awaitingChoice}
            showSuggestions={!messages.some((m) => m.from === "user")}
            voice={{
              available: voice.available,
              enabled: voice.enabled,
              listening: voice.listening,
              speaking: voice.speaking,
              onToggle: voice.toggle,
            }}
          />
        </section>

        <div className="screen-pane">
          <CardBoard
            ctx={{
              market,
              screen,
              alert,
              onAck: ack,
              watchAdd: handleAdd,
              watchRemove: handleRemove,
              watchSuggest: handleSuggest,
              earnings: (symbols) => feedRef.current.events?.(symbols) ?? Promise.resolve([]),
              triggers: {
                all: () => triggerStore.all(),
                add: (input) => {
                  triggerStore.add(input);
                  forceRender((n) => n + 1);
                },
                remove: (id) => {
                  triggerStore.remove(id);
                  forceRender((n) => n + 1);
                },
                rearm: (id) => {
                  triggerStore.rearm(id);
                  forceRender((n) => n + 1);
                },
                notifyState: notifyState(),
                requestNotify: () => requestNotify().then(() => forceRender((n) => n + 1)),
              },
              portfolio: {
                all: () => portfolioStore.all(),
                set: (symbol, shares, cost) => {
                  portfolioStore.set(symbol, shares, cost);
                  forceRender((n) => n + 1);
                },
                remove: (symbol) => {
                  portfolioStore.remove(symbol);
                  forceRender((n) => n + 1);
                },
              },
              version: feedStatus?.at ?? 0,
            }}
          />
        </div>
      </div>

      {voice.enabled ? (
        <VoiceOverlay
          interim={voice.interim}
          error={voice.error}
          working={working}
          speaking={voice.speaking}
          lastReply={lastReply}
          onExit={voice.toggle}
        />
      ) : null}
    </div>
  );
}

/** A plausible ticker from typed text (e.g. "googl" → "GOOGL", "brk.b" → "BRK.B"). */
function symbolCandidate(text: string): string | null {
  const m = text.trim().toUpperCase().match(/^[A-Z][A-Z.]{0,5}$/);
  return m ? m[0] : null;
}

/** Capitalize the first letter, leaving the rest of the name as-is. */
function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "100" or "12.5" shares — drop a trailing ".0". */
function trimShares(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(4)));
}
