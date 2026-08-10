import { useEffect, useRef, useState } from "react";
import type { Market } from "../agent/market";
import { leadAlert } from "../agent/alerts";
import type { Alert } from "../agent/types";
import type { Feed } from "../feed/types";

/*
 * Owns the live loop: poll the feed on its cadence, overlay quotes onto the
 * Market, and re-evaluate the one unprompted alert. The alert is armed a beat
 * after arrival (silence first), and an acknowledged alert never resurfaces.
 *
 * Updating internal state here re-renders the consumer, so the mutated Market
 * is read fresh on every cycle without threading a snapshot through props.
 */
export function useMarketFeed(market: Market, feed: Feed) {
  const [alert, setAlert] = useState<Alert | null>(null);
  const [, setVersion] = useState(0);
  const dismissed = useRef<Set<string>>(new Set());
  const armed = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let poll: number | undefined;

    function evaluateAlert() {
      if (!armed.current) return;
      const a = leadAlert(market);
      setAlert(a && !dismissed.current.has(a.id) ? a : null);
    }

    async function cycle() {
      try {
        const quotes = await feed.quotes(market.symbols());
        if (cancelled) return;
        market.applyQuotes(quotes);
        setVersion((v) => v + 1);
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
  }, [market, feed]);

  function ack(id: string) {
    dismissed.current.add(id);
    setAlert(null);
  }

  return { alert, ack };
}
