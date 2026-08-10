import { useRef, type ReactNode } from "react";
import type { CardSize } from "../cards/types";

/*
 * The chrome around every board card: a drag grip, a title, a size cycle
 * (S/M/L), and a remove control. Only the grip is draggable, so inputs and
 * buttons inside a card keep working; the whole card is a drop target.
 */
export function CardFrame({
  title,
  size,
  onCycleSize,
  onRemove,
  removable = true,
  dragging = false,
  over = false,
  onGrab,
  onOver,
  onDropCard,
  onDragEnd,
  children,
}: {
  title: string;
  size: CardSize;
  onCycleSize: () => void;
  onRemove: () => void;
  removable?: boolean;
  dragging?: boolean;
  over?: boolean;
  onGrab: () => void;
  onOver: () => void;
  onDropCard: () => void;
  onDragEnd: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);

  return (
    <section
      ref={ref}
      className={`card board-card size-${size}${dragging ? " dragging" : ""}${
        over ? " drop-over" : ""
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        onOver();
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDropCard();
      }}
    >
      <header className="card-head">
        <span
          className="card-grip"
          role="button"
          tabIndex={0}
          draggable
          aria-label={`Drag to reorder ${title}`}
          title="Drag to reorder"
          onDragStart={(e) => {
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("text/plain", title); // Firefox needs a payload
            if (ref.current) e.dataTransfer.setDragImage(ref.current, 16, 16);
            onGrab();
          }}
          onDragEnd={onDragEnd}
        >
          <GripIcon />
        </span>
        <h2 className="h2 card-title">{title}</h2>
        <div className="card-tools">
          <button
            type="button"
            className="card-size"
            onClick={onCycleSize}
            title={`Resize (currently ${LABEL[size]})`}
            aria-label={`Resize card, currently ${LABEL[size]}`}
          >
            {size.toUpperCase()}
          </button>
          {removable ? (
            <button
              type="button"
              className="card-x"
              onClick={onRemove}
              title={`Remove ${title}`}
              aria-label={`Remove ${title}`}
            >
              ×
            </button>
          ) : null}
        </div>
      </header>
      <div className="card-body">{children}</div>
    </section>
  );
}

const LABEL: Record<CardSize, string> = { sm: "Small", md: "Medium", lg: "Large" };

function GripIcon() {
  return (
    <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor" aria-hidden="true">
      {[3, 8, 13].map((cy) =>
        [2.5, 7.5].map((cx) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.25" />),
      )}
    </svg>
  );
}
