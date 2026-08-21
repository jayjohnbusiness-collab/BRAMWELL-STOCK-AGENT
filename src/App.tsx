import { useEffect, useRef, useState } from "react";
import { Bramwell } from "./agent/bramwell";
import { Market } from "./agent/market";
import { composeMorningBriefing } from "./agent/briefing";
import { marketStatus } from "./market/hours";
import { joinIncome, totalAnnual, nextPayment, yieldOnValue } from "./dividend/income";
import {
  isPortfolioValueQuery,
  parse,
  parseNews,
  parsePosition,
  parseTrigger,
  watchTarget,
} from "./agent/nlu";
import type { Instrument, ScreenPayload } from "./agent/types";
import { learnedAnswer, teach } from "./agent/learned";
import { understandingEnabled, understand } from "./agent/understand";
import { createFeed } from "./feed";
import { createAttributor } from "./attribution";
import { useMarketFeed } from "./hooks/useMarketFeed";
import { useVoice } from "./hooks/useVoice";
import { loadWatchlist, saveWatchlist, loadCustom, saveCustom } from "./watchlist/storage";
import { hasToken } from "./feed/token";
import { TriggerStore } from "./triggers/store";
import { firedLine, triggerFires, type Trigger, type TriggerKind } from "./triggers/types";
import { fireNotification, notifyState, requestNotify } from "./notify";
import { playChime } from "./chime";
import { PortfolioStore } from "./portfolio/store";
import { valuePosition, portfolioTotals } from "./portfolio/types";
import { money } from "./components/cards/parts";
import { Bell } from "./brand/Bell";
import { Conversation, type ChatMessage } from "./components/Conversation";
import { Composer } from "./components/Composer";
import { CardBoard } from "./components/CardBoard";
import type { CardContext } from "./cards/types";
import { TickerDetail } from "./components/TickerDetail";
import { AccountPanel } from "./components/AccountPanel";
import { Welcome } from "./components/Welcome";
import { hasWelcomed, markWelcomed } from "./welcome";
import { VoiceOverlay } from "./components/VoiceOverlay";
import { VoiceOrb } from "./components/VoiceOrb";
import { AnalyticView } from "./components/analytic/AnalyticView";
import { conciergeEnabled } from "./analytic/gate";
import "./styles/global.css";
import "./styles/app.css";

// A butler is always in the room: one quiet line of presence on arrival,
// no chime, no "Yes?".
const INTRO: ChatMessage = {
  id: "intro",
  from: "bramwell",
  text: "I'm keeping an eye on your names. I'll speak up the moment something's worth your while.",
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

  const { alert, ack, feedStatus, hydrated } = useMarketFeed(
    market,
    feedRef.current,
    attributorRef.current,
    triggerStore,
    (fired) => triggerFireRef.current(fired),
    // Whole-book context for portfolio-level triggers (day P/L, any holding).
    () => {
      const values = portfolioStore.all().map((p) => {
        const i = market.bySymbol(p.symbol);
        return valuePosition(p, {
          price: i?.basePrice ?? 0,
          changePct: i?.changePct ?? 0,
          name: i?.name ?? p.symbol,
        });
      });
      return {
        bookDayAbs: values.length ? portfolioTotals(values).dayAbs : undefined,
        holdings: market
          .held()
          .map((i) => ({ symbol: i.symbol, name: i.name, changePct: i.changePct })),
      };
    },
  );

  const idRef = useRef(1);
  // Guards the once-per-mount morning briefing (a localStorage date guards it
  // once per calendar day across reloads).
  const briefedRef = useRef(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() => [{ ...INTRO, ts: Date.now() }]);
  const [working, setWorking] = useState(false);
  const [screen, setScreen] = useState<ScreenPayload>({ kind: "none" });
  const [awaitingChoice, setAwaitingChoice] = useState(false);
  // A question Bramwell couldn't answer and is waiting to be taught the answer to.
  const [teachQ, setTeachQ] = useState<string | null>(null);
  // Mobile: the chat lives in a slide-up drawer (cards are the main view).
  const [chatOpen, setChatOpen] = useState(false);
  // The symbol whose detail drawer is open, if any.
  const [detailSymbol, setDetailSymbol] = useState<string | null>(null);
  // Whether the Account panel (holdings, watchlist, settings) is open.
  const [accountOpen, setAccountOpen] = useState(false);
  // The Concierge-tier Analytic cockpit (full-screen), gated behind the tier.
  const [analyticOpen, setAnalyticOpen] = useState(false);
  // The one-time welcome, shown on a visitor's first arrival.
  const [showWelcome, setShowWelcome] = useState(() => !hasWelcomed());
  const [, forceRender] = useState(0);

  // Voice dispatches spoken commands through the same pipeline as typing.
  // A ref breaks the definition cycle (the hook needs the handler, the handler
  // needs the hook's speak/cancel).
  const dispatchRef = useRef<(text: string) => void>(() => {});
  const wakeAckRef = useRef<() => void>(() => {});
  const voice = useVoice(
    (text) => dispatchRef.current(text),
    () => wakeAckRef.current(),
  );

  function nextId(): string {
    idRef.current += 1;
    return `m${idRef.current}`;
  }

  // A chat message, stamped with the moment it was sent.
  function chatMsg(from: "user" | "bramwell", text: string): ChatMessage {
    return { id: nextId(), from, text, ts: Date.now() };
  }

  // Persist the watchlist (and any user-added tickers) and re-render.
  function persist() {
    saveWatchlist(market.watchlistSymbols());
    saveCustom(market.customInstruments());
    forceRender((n) => n + 1);
  }

  function handleSend(text: string) {
    voice.cancel(); // a new request stops Bramwell mid-word
    setMessages((prev) => [...prev, chatMsg("user", text)]);

    // Learning — teach-back. If Bramwell just asked to be taught an answer, this
    // message IS the answer (unless the user waves it off). Remember it so he can
    // give it next time.
    if (teachQ) {
      const q = teachQ;
      setTeachQ(null);
      if (/\b(never mind|nevermind|forget it|cancel|skip|don'?t worry|no thanks?)\b/i.test(text)) {
        say("As you wish.");
        return;
      }
      teach(q, text.trim());
      say("Noted — I'll remember that. Ask me again whenever you like.");
      return;
    }

    // Learning — recall. A previously-taught answer to this question wins over a
    // shrug; it only exists for questions he couldn't answer before.
    const recalled = learnedAnswer(text);
    if (recalled) {
      say(recalled);
      return;
    }

    runDispatch(text, { llmTried: false, original: text });
  }
  dispatchRef.current = handleSend;

  // The routing core, shared by a fresh user message and by an AI-translated
  // retry. `original` is the user's real wording — used for the teach-back
  // question and for the AI translation — so an LLM re-route keeps the user's
  // intent even though `text` may be a canonical rephrasing.
  function runDispatch(text: string, opts: { llmTried: boolean; original: string }) {
    // A standing alert ("tell me if NVDA drops below 200").
    const trig = parseTrigger(text);
    if (trig) { void setTriggerFromChat(trig); return; }
    if (isPortfolioValueQuery(text)) { answerPortfolio(); return; }
    const pos = parsePosition(text);
    if (pos) { void setPositionFromChat(pos); return; }
    const newsAsk = parseNews(text);
    if (newsAsk) { void newsFromChat(newsAsk.namePhrase); return; }
    if (isDividendQuery(text)) { void answerDividends(); return; }
    const intent = parse(text);
    if (intent.kind === "brief") { void briefFromChat(); return; }
    if (intent.kind === "watch") {
      const target = watchTarget(text);
      if (target) { void addFromChat(target); return; }
    }

    setWorking(true);
    // Answer inside two seconds or show a quiet working state; no filler.
    window.setTimeout(() => {
      const reply = agent.respond(text);
      // Couldn't place it locally → if AI understanding is on, ask the model to
      // translate the ORIGINAL wording into a command and route that, once.
      if (reply.learnable && !opts.llmTried && understandingEnabled()) {
        understand(opts.original)
          .then((canonical) => {
            setWorking(false);
            if (canonical && canonical.toLowerCase() !== text.toLowerCase()) {
              runDispatch(canonical, { llmTried: true, original: opts.original });
            } else {
              finishReply(reply, opts.original);
            }
          })
          .catch(() => { setWorking(false); finishReply(reply, opts.original); });
        return;
      }
      setWorking(false);
      finishReply(reply, opts.original);
    }, 650);
  }

  // Render one agent reply: speak it, show its screen payload, and — when
  // nothing could answer — offer to learn the answer for next time.
  function finishReply(reply: ReturnType<Bramwell["respond"]>, original: string) {
    const spoken =
      reply.learnable && reply.spoken.trim().length > 0
        ? `${reply.spoken} If you tell me the answer, I'll remember it for next time.`
        : reply.spoken;
    if (reply.learnable) setTeachQ(original);
    if (spoken.trim().length > 0) {
      setMessages((prev) => [...prev, chatMsg("bramwell", spoken)]);
      voice.speak(spoken); // spoken aloud only when voice is on
    }
    if (reply.screen && reply.screen.kind !== "none") setScreen(reply.screen);
    setAwaitingChoice(Boolean(reply.awaitingChoice));
    persist(); // Bramwell may have edited the watchlist ("watch Tesla")
  }

  // The morning briefing: once prices have hydrated (first poll done), and at
  // most once per calendar day, Bramwell greets the user unprompted with the
  // day's posture, the book, earnings due today, and any alert already met.
  useEffect(() => {
    if (briefedRef.current || !hydrated) return;
    briefedRef.current = true;
    const today = isoToday();
    if (loadBriefedOn() === today) return; // already greeted today
    void buildBriefing(true).then(({ text }) => {
      saveBriefedOn(today);
      if (text) {
        setMessages((prev) => [...prev, chatMsg("bramwell", text)]);
        voice.speak(text); // a no-op unless voice mode is already on
      }
    });
    // buildBriefing reads stable refs; run once, when prices first hydrate.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  // Woken by name with no question yet — Bramwell acknowledges and waits.
  wakeAckRef.current = () => {
    voice.cancel();
    const line = "At your service. What can I do for you?";
    setMessages((prev) => [...prev, chatMsg("bramwell", line)]);
    voice.speak(line);
  };

  // A fired trigger: Bramwell speaks up in chat, and (if allowed) a browser
  // notification reaches the user even when the tab isn't focused.
  triggerFireRef.current = (fired: Trigger[]) => {
    if (fired.length > 0) playChime(); // one discreet chime for the batch
    for (const t of fired) {
      const i = market.bySymbol(t.symbol);
      const q = { price: i?.basePrice ?? t.value, changePct: i?.changePct ?? 0 };
      const line = firedLine(t, q);
      setMessages((prev) => [...prev, chatMsg("bramwell", line)]);
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
      const msg = r.ok ? "I couldn't quite place that name." : r.message;
      setMessages((prev) => [...prev, chatMsg("bramwell", msg)]);
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
        ? `Very good — I'll let you know if ${name} moves ${spec.value}% either way.`
        : `Very good — I'll tell you the moment ${name} goes ${kind} ${spec.value}.`;
    setMessages((prev) => [...prev, chatMsg("bramwell", line)]);
    voice.speak(line);
    setScreen({ kind: "quote", instrument: inst });
    forceRender((n) => n + 1);
  }

  function say(text: string) {
    setMessages((prev) => [...prev, chatMsg("bramwell", text)]);
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
      say(r.ok ? "I couldn't quite place that name." : r.message);
      return;
    }
    const price = market.bySymbol(inst.symbol)?.basePrice ?? 0;
    const cost = spec.cost > 0 ? spec.cost : price;
    portfolioStore.set(inst.symbol, spec.shares, cost);
    forceRender((n) => n + 1);

    const value = spec.shares * price;
    const basis = spec.cost > 0 ? ` at ${spec.cost.toFixed(2)}` : "";
    say(
      `Noted — ${trimShares(spec.shares)} of ${cap(inst.name)}${basis}. That's worth about ${money(value)} as it stands.`,
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
      say("You've nothing recorded yet — tell me what you hold, say, \"100 NVDA at 150\".");
      return;
    }
    const t = portfolioTotals(values);
    const day = `${t.dayAbs >= 0 ? "up" : "down"} ${money(Math.abs(t.dayAbs))} on the day`;
    let line = `Your book's worth ${money(t.marketValue)} at the moment`;
    if (t.hasBasis) {
      line += `. It's ${t.plAbs >= 0 ? "up" : "down"} ${money(Math.abs(t.plAbs))} overall, about ${Math.abs(
        t.plPct,
      ).toFixed(1)} percent, and ${day}.`;
    } else {
      line += ` — ${day}.`;
    }
    say(line);
  }

  // "How much do I make in dividends?" — total the income across held payers.
  async function answerDividends() {
    setWorking(true);
    const positions = portfolioStore.all();
    const symbols = Array.from(
      new Set([...market.held().map((i) => i.symbol), ...positions.map((p) => p.symbol)]),
    );
    const infos = await (feedRef.current.dividends?.(symbols) ?? Promise.resolve([]));
    setWorking(false);
    if (infos.length === 0) {
      say("None of your names pay a dividend just now.");
      return;
    }
    const rows = joinIncome(infos, positions);
    const annual = totalAnnual(rows);
    const next = nextPayment(rows, Date.now());
    const marketValue = positions.reduce(
      (s, p) => s + p.shares * (market.bySymbol(p.symbol)?.basePrice ?? 0),
      0,
    );
    const yld = yieldOnValue(annual, marketValue);
    if (annual > 0) {
      const top = [...rows].sort((a, b) => b.annualIncome - a.annualIncome)[0];
      let line = `Roughly ${money(annual)} a year — a yield of ${yld.toFixed(1)}% on your book.`;
      if (next) {
        line = `Your next payout's about ${money(next.payment)} from ${cap(
          market.bySymbol(next.symbol)?.name ?? next.symbol,
        )} around ${spokenDate(next.payDate)}. ${line}`;
      }
      if (top && top.shares > 0) {
        line += ` ${cap(market.bySymbol(top.symbol)?.name ?? top.symbol)}'s your biggest payer.`;
      }
      say(line);
    } else {
      const names = rows.map((r) => cap(market.bySymbol(r.symbol)?.name ?? r.symbol));
      say(
        `A few of your names pay — ${listPhrase(names)} — but you've nothing recorded, so there's no income to total yet.`,
      );
    }
  }

  // Assemble the morning briefing inputs from the live snapshot: the watchlist
  // posture, the book's totals, today's earnings among the user's names, and any
  // standing alert whose condition is already met. The wording lives in the
  // (pure, tested) composer; this only gathers the facts.
  async function buildBriefing(
    firstOfDay: boolean,
  ): Promise<{ text: string | null; heldRows: Instrument[] }> {
    const held = market.held();

    // The book's totals, when anything is recorded.
    const values = portfolioStore.all().map((p) => {
      const i = market.bySymbol(p.symbol);
      return valuePosition(p, {
        price: i?.basePrice ?? 0,
        changePct: i?.changePct ?? 0,
        name: i?.name ?? p.symbol,
      });
    });
    const t = values.length ? portfolioTotals(values) : null;
    const book = t
      ? { dayAbs: t.dayAbs, hasBasis: t.hasBasis, plAbs: t.plAbs, plPct: t.plPct, marketValue: t.marketValue }
      : null;

    // Earnings today among the names followed.
    let earningsToday: string[] = [];
    const events = await (feedRef.current.events?.(held.map((i) => i.symbol)) ?? Promise.resolve([]));
    const today = isoToday();
    const dueSymbols = new Set(events.filter((e) => e.date === today).map((e) => e.symbol.toUpperCase()));
    earningsToday = held.filter((i) => dueSymbols.has(i.symbol)).map((i) => i.name);

    // Standing alerts whose condition is already met right now.
    const alertsMet = triggerStore
      .all()
      .filter((tr) => {
        const i = market.bySymbol(tr.symbol);
        return i ? triggerFires(tr, { price: i.basePrice, changePct: i.changePct }) : false;
      })
      .map((tr) => tr.name);
    const uniqueAlerts = [...new Set(alertsMet)];

    const text = composeMorningBriefing({
      hour: new Date().getHours(),
      firstOfDay,
      held: held.map((i) => ({
        symbol: i.symbol,
        name: i.name,
        changePct: i.changePct,
        cause: i.cause,
      })),
      book,
      earningsToday,
      alertsMet: uniqueAlerts,
      marketPhase: marketStatus(new Date()).phase,
    });
    return { text, heldRows: held };
  }

  // On-demand "brief me": the fuller briefing, with the holdings on screen.
  async function briefFromChat() {
    setWorking(true);
    const { text, heldRows } = await buildBriefing(false);
    setWorking(false);
    const line =
      text ?? "Nothing on your watch just yet — add a few names and I'll keep the book for you.";
    setMessages((prev) => [...prev, chatMsg("bramwell", line)]);
    voice.speak(line);
    if (heldRows.length) setScreen({ kind: "table", title: "Your holdings", rows: heldRows });
  }

  // "What's the recent news on X" — resolve the company (without adding it to
  // the watchlist) and read back the freshest headlines.
  async function newsFromChat(namePhrase: string) {
    const feed = feedRef.current;
    if (!feed.news) {
      say("I'll need live data connected before I can pull the news, I'm afraid.");
      return;
    }
    setWorking(true);

    // Resolve to a symbol without watching it.
    let symbol: string | undefined;
    let name = namePhrase.trim();
    const res = market.resolve(namePhrase);
    if (res.status === "ok") {
      symbol = res.instrument.symbol;
      name = res.instrument.name;
    } else {
      const candidate = symbolCandidate(namePhrase);
      let hit = candidate && feed.lookup ? await feed.lookup(candidate) : null;
      if (!hit && feed.search) {
        const s = await feed.search(namePhrase);
        if (s && feed.lookup) hit = await feed.lookup(s.symbol);
      }
      if (hit) {
        symbol = hit.symbol;
        name = hit.name;
      }
    }
    if (!symbol) {
      setWorking(false);
      say(`I couldn't find a company called "${namePhrase.trim()}", I'm afraid.`);
      return;
    }

    const items = await feed.news(symbol);
    setWorking(false);
    if (items.length === 0) {
      say(`Nothing recent on ${cap(name)} that I can see.`);
      return;
    }
    const top = items.slice(0, 3);
    const lines = top
      .map((n) => `“${n.headline}” — ${n.source}, ${relTime(n.datetime)}`)
      .join("  •  ");
    say(`Here's the latest on ${cap(name)} — ${lines}`);
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
      return { ok: false, message: `Which would that be — ${a.name}, or ${b.name}?` };
    }
    if (res.status === "ok") {
      if (market.isWatched(res.instrument.symbol)) {
        return {
          ok: false,
          message: `${cap(res.instrument.name)}'s already on your list.`,
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
      return { ok: false, message: "I don't have anything by that name, I'm afraid." };
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
        ? `I couldn't find anything under "${text.trim()}", I'm afraid.`
        : `Connect live data and I'll add "${text.trim()}" for you.`,
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
      ? `Of course. I'll keep an eye on ${cap(r.instrument.name)} for you.`
      : r.message;

    if (spoken.trim().length > 0) {
      setMessages((prev) => [...prev, chatMsg("bramwell", spoken)]);
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

  // The market phase for the header pill (refreshes as the app re-renders).
  const mkt = marketStatus(new Date());

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

  // The shared context both the board and the Account panel read from.
  const cardCtx: CardContext = {
    market,
    screen,
    alert,
    onAck: ack,
    watchAdd: handleAdd,
    watchRemove: handleRemove,
    watchSuggest: handleSuggest,
    earnings: (symbols) => feedRef.current.events?.(symbols) ?? Promise.resolve([]),
    openDetail: (symbol) => setDetailSymbol(symbol),
    openAccount: () => setAccountOpen(true),
    candles: (symbol, range) =>
      feedRef.current.candles?.(symbol, range) ?? Promise.resolve(null),
    dividends: (symbols) => feedRef.current.dividends?.(symbols) ?? Promise.resolve([]),
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
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <Bell size={30} tone="brass" />
        <span className="wordmark">Bramwell</span>
        <span className="tagline small state-note">Your market, kept in order.</span>
        {/* Market status sits top-right, across from the logo (its own row on
            mobile; grouped with the actions on desktop). */}
        <span
          className={`mkt-pill ${mkt.phase}`}
          title={`${mkt.label} · ${mkt.detail}`}
        >
          <span className="mkt-dot" aria-hidden="true" />
          {mkt.label}
        </span>
        {liveDetail ? (
          <span
            className="small live-detail"
            style={{ color: liveError ? "var(--data-down)" : "var(--ink-soft)" }}
          >
            {liveDetail}
          </span>
        ) : null}
        <div className="header-right">
          {conciergeEnabled() ? (
            <button
              type="button"
              className="chip account-btn analytic-btn"
              onClick={() => setAnalyticOpen(true)}
              title="Bramwell Analytic — Concierge tier"
            >
              <span aria-hidden="true">◭</span> <span className="btn-label">Analytic</span>
            </button>
          ) : null}
          <button
            type="button"
            className="chip account-btn"
            onClick={() => setAccountOpen(true)}
            title="Holdings, watchlist, and settings"
          >
            <AccountIcon /> <span className="btn-label">Account</span>
          </button>
          {/* Mobile-only: open the chat drawer (cards are the main view). */}
          <button
            type="button"
            className="chip account-btn chat-toggle"
            onClick={() => setChatOpen(true)}
            title="Ask Bramwell"
            aria-label="Ask Bramwell"
          >
            <ChatIcon /> <span className="btn-label">Chat</span>
          </button>
        </div>
      </header>
      <hr className="rule" />

      <div className="app-grid">
        <section className={`conv-pane${chatOpen ? " open" : ""}`} aria-label="Conversation">
          <div className="conv-drawer-head">
            <span className="small state-note">Ask Bramwell</span>
            <button type="button" className="chip" onClick={() => setChatOpen(false)}>Done</button>
          </div>
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
          <CardBoard ctx={cardCtx} />
        </div>
      </div>

      {/* Mobile-only: the Bramwell orb floats bottom-right and starts voice. */}
      {voice.available && !voice.enabled && !chatOpen && !accountOpen && !analyticOpen && !detailSymbol && !showWelcome ? (
        <button
          type="button"
          className="orb-fab"
          onClick={() => voice.toggle()}
          aria-label="Talk to Bramwell"
          title="Talk to Bramwell"
        >
          <VoiceOrb speaking={voice.speaking} working={working} listening={voice.listening} />
        </button>
      ) : null}

      {analyticOpen ? (
        <AnalyticView ctx={cardCtx} onClose={() => setAnalyticOpen(false)} />
      ) : null}

      {detailSymbol ? (
        <TickerDetail
          symbol={detailSymbol}
          market={market}
          loadProfile={(s) =>
            feedRef.current.profile?.(s) ?? Promise.resolve(null)
          }
          loadNews={(s) => feedRef.current.news?.(s) ?? Promise.resolve([])}
          loadEvents={(symbols) =>
            feedRef.current.events?.(symbols) ?? Promise.resolve([])
          }
          onSetTargetAlert={(sym, name, target) => {
            const price = market.bySymbol(sym)?.basePrice ?? target;
            triggerStore.add({
              symbol: sym,
              name,
              kind: target >= price ? "above" : "below",
              value: target,
            });
            requestNotify().then(() => forceRender((n) => n + 1));
            forceRender((n) => n + 1);
          }}
          onClose={() => setDetailSymbol(null)}
        />
      ) : null}

      {showWelcome ? (
        <Welcome
          onClose={() => {
            markWelcomed();
            setShowWelcome(false);
          }}
          onConnect={() => {
            markWelcomed();
            setShowWelcome(false);
            setAccountOpen(true);
          }}
        />
      ) : null}

      {accountOpen ? (
        <AccountPanel ctx={cardCtx} onClose={() => setAccountOpen(false)} />
      ) : null}

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

/** A speech-bubble glyph for the mobile "Chat" button. */
function ChatIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 5.5h16a1 1 0 0 1 1 1V16a1 1 0 0 1-1 1H9l-4 3.5V17H4a1 1 0 0 1-1-1V6.5a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

/** A small person glyph for the header Account button. */
function AccountIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="8" r="3.4" fill="currentColor" />
      <path
        d="M5 19.5a7 7 0 0 1 14 0"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

/** Today's date as YYYY-MM-DD (local), for the once-a-day briefing guard. */
function isoToday(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

const BRIEFED_KEY = "bramwell.briefedOn";

/** The date Bramwell last gave the morning briefing, if any. */
function loadBriefedOn(): string | null {
  try {
    return window.localStorage.getItem(BRIEFED_KEY);
  } catch {
    return null;
  }
}

function saveBriefedOn(date: string): void {
  try {
    window.localStorage.setItem(BRIEFED_KEY, date);
  } catch {
    /* private mode or storage full — the briefing simply repeats next load */
  }
}

/** Whether the message is asking about dividends / dividend income. */
function isDividendQuery(text: string): boolean {
  return /\b(dividends?|payouts?|dividend income|div(?:vy| yield)?)\b/i.test(text);
}

/** "September 28" from a YYYY-MM-DD string, for a spoken line. */
function spokenDate(iso: string): string {
  const [y, m, d] = iso.split("-").map((n) => parseInt(n, 10));
  if (!y || !m || !d) return iso;
  const months = [
    "January", "February", "March", "April", "May", "June", "July",
    "August", "September", "October", "November", "December",
  ];
  return `${months[m - 1]} ${d}`;
}

/** "A", "A and B", "A, B and C". */
function listPhrase(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
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

/** A short relative time for a headline: "12m ago", "3h ago", "yesterday". */
function relTime(ms: number): string {
  const s = Math.max(0, (Date.now() - ms) / 1000);
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  const d = Math.round(s / 86400);
  return d <= 1 ? "yesterday" : `${d}d ago`;
}
