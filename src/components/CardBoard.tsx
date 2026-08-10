import { useState } from "react";
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
  // Drag-to-reorder state: the card being dragged and the one hovered over.
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  function commit(next: CardConfig[]) {
    setCards(next);
    saveCards(next);
  }

  function cycleSize(id: string) {
    commit(cards.map((c) => (c.id === id ? { ...c, size: nextSize(c.size) } : c)));
  }
  function remove(id: string) {
    commit(cards.filter((c) => c.id !== id));
  }
  function addCard(type: CardType) {
    if (cards.some((c) => c.type === type)) return;
    commit([...cards, { id: type, type, size: CARD_META[type].defaultSize }]);
    setPicking(false);
  }

  // Move the dragged card to the dropped-on card's position.
  function reorder(targetId: string) {
    if (!dragId || dragId === targetId) return;
    const from = cards.findIndex((c) => c.id === dragId);
    const to = cards.findIndex((c) => c.id === targetId);
    if (from < 0 || to < 0) return;
    const next = [...cards];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    commit(next);
  }
  function endDrag() {
    setDragId(null);
    setOverId(null);
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
            over={Boolean(dragId) && overId === c.id && dragId !== c.id}
            onGrab={() => setDragId(c.id)}
            onOver={() => setOverId((cur) => (cur === c.id ? cur : c.id))}
            onDropCard={() => {
              reorder(c.id);
              endDrag();
            }}
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
