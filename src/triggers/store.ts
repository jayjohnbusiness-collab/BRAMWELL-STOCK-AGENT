import type { Trigger, TriggerContext, TriggerKind, TriggerQuote } from "./types";
import { isPortfolioKind, portfolioTriggerFires, triggerFires } from "./types";
import { loadTriggers, saveTriggers } from "./storage";

/*
 * The trigger book. Like the Market, it's a plain (non-React) store the live
 * loop reads and mutates; the UI reads all() and re-renders on a version bump.
 * Held here so evaluation isn't tangled in React state and stale closures.
 */
export class TriggerStore {
  private list: Trigger[];
  private seq = 0;

  constructor(initial: Trigger[] = loadTriggers()) {
    this.list = initial;
  }

  all(): Trigger[] {
    return this.list;
  }

  add(input: {
    symbol: string;
    name: string;
    kind: TriggerKind;
    value: number;
    basis?: number;
  }): Trigger {
    const t: Trigger = {
      id: `t${Date.now().toString(36)}${(this.seq++).toString(36)}`,
      symbol: input.symbol.toUpperCase(),
      name: input.name,
      kind: input.kind,
      value: input.value,
      basis: input.basis,
      createdAt: Date.now(),
      firedAt: null,
    };
    this.list = [...this.list, t];
    this.persist();
    return t;
  }

  remove(id: string): void {
    this.list = this.list.filter((t) => t.id !== id);
    this.persist();
  }

  rearm(id: string): void {
    const t = this.list.find((x) => x.id === id);
    if (t) {
      t.firedAt = null;
      this.persist();
    }
  }

  /**
   * Check every armed trigger. Per-name triggers use the quote lookup;
   * portfolio-level ones use the supplied whole-book context. Newly-fired ones
   * are stamped (with the tripping detail) and returned so the caller can
   * announce them.
   */
  evaluate(
    lookup: (symbol: string) => TriggerQuote | undefined,
    now: number,
    ctx?: TriggerContext,
  ): Trigger[] {
    const fired: Trigger[] = [];
    for (const t of this.list) {
      if (t.firedAt != null) continue;
      if (isPortfolioKind(t.kind)) {
        const hit = ctx ? portfolioTriggerFires(t, ctx) : null;
        if (hit) {
          t.firedAt = now;
          t.firedNote = hit.note;
          t.firedValue = hit.value;
          fired.push(t);
        }
        continue;
      }
      const q = lookup(t.symbol);
      if (!q) continue;
      if (triggerFires(t, q)) {
        t.firedAt = now;
        fired.push(t);
      }
    }
    if (fired.length) this.persist();
    return fired;
  }

  private persist(): void {
    saveTriggers(this.list);
  }
}
