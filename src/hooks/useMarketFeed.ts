import { useEffect, useRef, useState } from "react";
import type { Market } from "../agent/market";
import { leadAlert } from "../agent/alerts";
import type { Alert } from "../agent/types";
import type { Feed } from "../feed/types";
import type { Attributor } from "../attribution/types";

// Only look for a cause once a move is worth explaining, and don't re-ask the
// wire more than once per name in this window (a later story can still upgrade
// a null — "I'll tell you when there is one").
const ATTRIBUTE_THRESHOLD = 3; // percent
const ATTRIBUTE_RETRY_MS = 5 * 60 * 1000;

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
            if (cancelled || !cause) return;
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
        setVersion((v) => v + 1);
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

  return { alert, ack };
}
