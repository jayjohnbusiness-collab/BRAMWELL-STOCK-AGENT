import { useLayoutEffect, useRef, useState } from "react";
import type { CardConfig, CardContext, CardSize, CardType } from "../cards/types";
import { nextSize } from "../cards/types";
import { CARD_META, ALL_CARD_TYPES } from "../cards/registry";
import { loadCards, saveCards } from "../cards/storage";
import { CardFrame } from "./CardFrame";
import { WatchlistManager } from "./WatchlistManager";
import { SpotlightCard, AlertsCard, MoversCard, BreadthCard, CausesCard } from "./cards/simpleCards";
import { ClockCard } from "./cards/ClockCard";
import { EventsCard } from "./cards/EventsCard";

/*
 * The board: a grid of cards the user composes. Add via the picker, remove via
 * each card's ×, resize via its S/M/L. Every change persists. The card body for
 * each type reads the shared context and its own size.
 */
export function CardBoard({ ctx }: { ctx: CardContext }) {
  const [cards, setCards] = useState<CardConfig[]>(() => loadCards());
  const [picking, setPicking] = useState(false);
  // Drag-to-reorder state: the card currently being dragged.
  const [dragId, setDragId] = useState<string | null>(null);

  // --- FLIP reorder animation ---------------------------------------------
  // Card elements by id, and the positions captured just before a layout
  // change, so the board can animate cards gliding to their new slots.
  const elRefs = useRef<Map<string, HTMLElement>>(new Map());
  const firstRects = useRef<Map<string, DOMRect> | null>(null);

  function captureFirst() {
    const m = new Map<string, DOMRect>();
    elRefs.current.forEach((el, id) => m.set(id, el.getBoundingClientRect()));
    firstRects.current = m;
  }

  useLayoutEffect(() => {
    const first = firstRects.current;
    firstRects.current = null;
    if (!first) return;

    const animating: HTMLElement[] = [];
    elRefs.current.forEach((el, id) => {
      const prev = first.get(id);
      if (!prev) return; // a newly-added card has no prior position
      const now = el.getBoundingClientRect();
      const dx = prev.left - now.left;
      const dy = prev.top - now.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
      // Invert: jump the card back to where it was, without transition.
      el.style.transition = "none";
      el.style.transform = `translate(${dx}px, ${dy}px)`;
      animating.push(el);
    });
    if (animating.length === 0) return;

    // Play: on the next frame, release to the real position with easing.
    requestAnimationFrame(() => {
      for (const el of animating) {
        el.style.transition = "transform 260ms cubic-bezier(0.2, 0, 0, 1)";
        el.style.transform = "";
        const clear = () => {
          el.style.transition = "";
          el.style.transform = "";
          el.removeEventListener("transitionend", clear);
        };
        el.addEventListener("transitionend", clear);
      }
    });
  }, [cards]);

  // Every layout-changing edit captures positions first, so cards animate.
  function mutate(next: CardConfig[]) {
    captureFirst();
    setCards(next);
    saveCards(next);
  }

  function cycleSize(id: string) {
    mutate(cards.map((c) => (c.id === id ? { ...c, size: nextSize(c.size) } : c)));
  }
  function remove(id: string) {
    mutate(cards.filter((c) => c.id !== id));
  }
  function addCard(type: CardType) {
    if (cards.some((c) => c.type === type)) return;
    mutate([...cards, { id: type, type, size: CARD_META[type].defaultSize }]);
    setPicking(false);
  }

  // Live reorder while dragging: as the cursor crosses another card, move the
  // dragged card into that slot so the board opens the gap where it will land.
  // This animates via FLIP and isn't persisted until the drop (endDrag).
  function previewMove(targetId: string) {
    if (!dragId || dragId === targetId) return;
    const from = cards.findIndex((c) => c.id === dragId);
    const to = cards.findIndex((c) => c.id === targetId);
    if (from < 0 || to < 0 || from === to) return;
    const next = [...cards];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    captureFirst();
    setCards(next); // persisted on drop, not on every hover
  }
  function endDrag() {
    saveCards(cards); // the live order is now final
    setDragId(null);
  }

  const present = new Set(cards.map((c) => c.type));
  const available = ALL_CARD_TYPES.filter((t) => !present.has(t));

  return (
    <div className="board-wrap">
      <div className="card-board">
        {cards.map((c) => (
          <CardFrame
            key={c.id}
            title={CARD_META[c.type].title}
            size={c.size}
            onCycleSize={() => cycleSize(c.id)}
            onRemove={() => remove(c.id)}
            dragging={dragId === c.id}
            innerRef={(el) => {
              if (el) elRefs.current.set(c.id, el);
              else elRefs.current.delete(c.id);
            }}
            onGrab={() => setDragId(c.id)}
            onOver={() => previewMove(c.id)}
            onDropCard={endDrag}
            onDragEnd={endDrag}
          >
            {renderBody(c.type, c.size, ctx)}
          </CardFrame>
        ))}
      </div>

      <div className="board-actions">
        {available.length === 0 ? (
          <span className="small state-note">Every card is on the board.</span>
        ) : picking ? (
          <div className="card-picker" role="menu">
            <div className="picker-head">
              <span className="label">Add a card</span>
              <button type="button" className="card-x" aria-label="Close" onClick={() => setPicking(false)}>
                ×
              </button>
            </div>
            {available.map((t) => (
              <button key={t} type="button" className="picker-item" onClick={() => addCard(t)}>
                <span className="picker-title">{CARD_META[t].title}</span>
                <span className="picker-blurb small">{CARD_META[t].blurb}</span>
              </button>
            ))}
          </div>
        ) : (
          <button type="button" className="chip add-card-btn" onClick={() => setPicking(true)}>
            + Add card
          </button>
        )}
      </div>
    </div>
  );
}

function renderBody(type: CardType, size: CardSize, ctx: CardContext) {
  switch (type) {
    case "watchlist":
      return (
        <WatchlistManager
          watched={ctx.market.held()}
          size={size}
          onAdd={ctx.watchAdd}
          onRemove={ctx.watchRemove}
          onSuggest={ctx.watchSuggest}
        />
      );
    case "spotlight":
      return <SpotlightCard screen={ctx.screen} size={size} />;
    case "alerts":
      return <AlertsCard alert={ctx.alert} onAck={ctx.onAck} />;
    case "movers":
      return <MoversCard market={ctx.market} size={size} />;
    case "breadth":
      return <BreadthCard market={ctx.market} size={size} />;
    case "causes":
      return <CausesCard market={ctx.market} size={size} />;
    case "clock":
      return <ClockCard size={size} />;
    case "events":
      return <EventsCard market={ctx.market} earnings={ctx.earnings} size={size} />;
    default:
      return null;
  }
}
