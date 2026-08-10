import type { ReactNode } from "react";
import type { CardSize } from "../cards/types";

/*
 * The chrome around every board card: a title, a size cycle (S/M/L), and a
 * remove control. The size class drives the grid span and height in CSS; the
 * body decides how much to show for that size.
 */
export function CardFrame({
  title,
  size,
  onCycleSize,
  onRemove,
  removable = true,
  children,
}: {
  title: string;
  size: CardSize;
  onCycleSize: () => void;
  onRemove: () => void;
  removable?: boolean;
  children: ReactNode;
}) {
  return (
    <section className={`card board-card size-${size}`}>
      <header className="card-head">
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
