import type { CardContext, CardSize } from "../../cards/types";
import { rowLimit } from "../../cards/types";
import { valuePosition } from "../../portfolio/types";
import { Empty, money } from "./parts";

/*
 * Allocation: where the book's value actually sits. A single stacked bar plus a
 * ranked list of each holding's share of the total — the quick "am I too
 * concentrated?" read. Reuses the positions from the Portfolio card.
 */
export function AllocationCard({ ctx, size }: { ctx: CardContext; size: CardSize }) {
  const values = ctx.portfolio
    .all()
    .map((p) => {
      const i = ctx.market.bySymbol(p.symbol);
      return valuePosition(p, {
        price: i?.basePrice ?? 0,
        changePct: i?.changePct ?? 0,
        name: i?.name ?? p.symbol,
      });
    })
    .filter((v) => v.marketValue > 0)
    .sort((a, b) => b.marketValue - a.marketValue);

  const total = values.reduce((s, v) => s + v.marketValue, 0);
  if (total <= 0) {
    return <Empty>Record a position or two and I'll show how your book is weighted.</Empty>;
  }

  const withPct = values.map((v, idx) => ({
    ...v,
    pct: (v.marketValue / total) * 100,
    tone: SLICE[idx % SLICE.length],
  }));
  const limit = rowLimit(size, { sm: 3, md: 6, lg: 20 });
  const shown = withPct.slice(0, limit);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
      <div className="alloc-bar" aria-hidden="true">
        {withPct.map((v) => (
          <span
            key={v.symbol}
            className="alloc-seg"
            style={{ flexGrow: v.marketValue, background: v.tone }}
            title={`${v.symbol} ${v.pct.toFixed(0)}%`}
          />
        ))}
      </div>
      <div>
        {shown.map((v) => (
          <div key={v.symbol} className="alloc-row">
            <span className="alloc-swatch" style={{ background: v.tone }} aria-hidden="true" />
            <span className="label" style={{ color: "var(--ink)" }}>
              {v.symbol}
            </span>
            <span className="small alloc-val" style={{ color: "var(--ink-soft)" }}>
              {money(v.marketValue)}
            </span>
            <span className="alloc-pct tabular">{v.pct.toFixed(0)}%</span>
          </div>
        ))}
        {withPct.length > shown.length ? (
          <p className="small" style={{ color: "var(--ink-soft)", margin: "var(--space-2) 0 0" }}>
            +{withPct.length - shown.length} more — enlarge the card to see them.
          </p>
        ) : null}
      </div>
    </div>
  );
}

// Stepped shades of the accent, so slices read as one family without a rainbow.
const SLICE = ["#2563a8", "#3f7cc0", "#5f97d1", "#86b3e0", "#aecdec", "#cfe0f2"];
