import { useEffect, useRef, useState } from "react";
import type { Market } from "../agent/market";
import { leadAlert } from "../agent/alerts";
import type { Alert } from "../agent/types";
import type { Feed, FeedDiagnostics } from "../feed/types";
import type { Attributor } from "../attribution/types";
import { headlineSentiment } from "../attribution/sentiment";

export interface FeedStatus extends FeedDiagnostics {
  /** Epoch ms of the last completed poll. */
  at: number;
}

// Only look for a cause once a move is worth explaining, and don't re-ask the
// wire more than once per name in this window (a later story can still upgrade
// a null — "I'll tell you when there is one").
const ATTRIBUTE_THRESHOLD = 3; // percent
const ATTRIBUTE_RETRY_MS = 5 * 60 * 1000;
// A deadband so a name hovering around zero doesn't thrash its cause on noise.
const DIRECTION_EPS = 0.5; // percent

/*
 * Owns the live loop: poll the feed, overlay quotes onto the Market, attach a
 * cause to anything that moved, and re-evaluate the one unprompted alert. The
 * alert is armed a beat after arrival (silence first), and an acknowledged
 * alert never resurfaces.
 *
 * Updating internal state here re-renders the consumer, so the mutated Market
 * is read fresh on every cycle without threading a snapshot through props.
 */
export function useMarketFeed(market: Market, feed: Feed, attributor: Attributor) {
  const [alert, setAlert] = useState<Alert | null>(null);
  const [feedStatus, setFeedStatus] = useState<FeedStatus | null>(null);
  const [, setVersion] = useState(0);
  const dismissed = useRef<Set<string>>(new Set());
  const armed = useRef(false);
  const lastAttempt = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    let cancelled = false;
    let poll: number | undefined;

    function evaluateAlert() {
      if (!armed.current) return;
      const a = leadAlert(market);
      setAlert(a && !dismissed.current.has(a.id) ? a : null);
    }

    // Drop a cause that no longer fits the current move. Intraday, a name can
    // flip from up to down after a bullish story was attached; keeping that
    // story stapled to a fall is exactly the misattribution we refuse at
    // fetch time, so we refuse it here too once the direction turns.
    function pruneStaleCauses() {
      let changed = false;
      for (const i of market.equities()) {
        const c = i.cause;
        if (!c || Math.abs(i.changePct) < DIRECTION_EPS) continue;
        const s = headlineSentiment(c.text);
        if (s !== 0 && s !== Math.sign(i.changePct)) {
          market.setCause(i.symbol, null);
          changed = true;
        }
      }
      if (changed) setVersion((v) => v + 1);
    }

    // Find a probable cause for names that moved and don't have a firm one yet.
    function attributionPass() {
      const now = Date.now();
      const targets = market
        .equities()
        .filter(
          (i) =>
            Math.abs(i.changePct) >= ATTRIBUTE_THRESHOLD &&
            (i.cause == null || i.cause.confidence === "unconfirmed"),
        );
      for (const i of targets) {
        const last = lastAttempt.current.get(i.symbol) ?? 0;
        if (now - last < ATTRIBUTE_RETRY_MS) continue;
        lastAttempt.current.set(i.symbol, now);
        attributor
          .attribute({ symbol: i.symbol, name: i.name, changePct: i.changePct })
          .then((cause) => {
            if (cancelled) return;
            if (!cause) {
              // Nothing supports a cause now. A soft (unconfirmed) one that's
              // still lingering should go rather than persist unsupported.
              const cur = market.bySymbol(i.symbol)?.cause;
              if (cur && cur.confidence === "unconfirmed") {
                market.setCause(i.symbol, null);
                setVersion((v) => v + 1);
              }
              return;
            }
            market.setCause(i.symbol, cause);
            setVersion((v) => v + 1);
            evaluateAlert();
          })
          .catch(() => {
            /* silence beats a fabricated cause */
          });
      }
    }

    async function cycle() {
      try {
        const quotes = await feed.quotes(market.symbols());
        if (cancelled) return;
        market.applyQuotes(quotes);
        const diag = feed.lastDiagnostics?.();
        if (diag) setFeedStatus({ ...diag, at: Date.now() });
        setVersion((v) => v + 1);
        pruneStaleCauses();
        attributionPass();
        evaluateAlert();
      } catch {
        // Keep calm; the next cycle will try again.
      }
      if (!cancelled) poll = window.setTimeout(cycle, feed.pollMs);
    }

    const arm = window.setTimeout(() => {
      armed.current = true;
      evaluateAlert();
    }, 3000);

    cycle();
    return () => {
      cancelled = true;
      window.clearTimeout(arm);
      if (poll) window.clearTimeout(poll);
    };
  }, [market, feed, attributor]);

  function ack(id: string) {
    dismissed.current.add(id);
    setAlert(null);
  }

  return { alert, ack, feedStatus };
}
