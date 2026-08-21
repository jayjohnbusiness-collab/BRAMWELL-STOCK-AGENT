/*
 * AI understanding — the optional Concierge fallback.
 *
 * The local parser (strict rules + a fuzzy net) handles most phrasings, but it
 * can't cover every way a person speaks. When it comes up empty and the user
 * has connected a key, this asks a small, fast model to TRANSLATE the utterance
 * into one canonical command that Bramwell's existing pipeline already answers —
 * "any names worth a look?" → "top gainers today". The model classifies; it
 * never sees or invents market data, so it can't hallucinate a price.
 *
 * The key lives only in this browser (localStorage), entered in Account, exactly
 * like the Finnhub and ElevenLabs keys. It's a soft client-side setup — a
 * production Concierge tier proxies this server-side.
 */

const KEY = "bramwell.llm.key";
const ENDPOINT = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-haiku-4-5-20251001"; // small + fast; ample for intent

export function llmKey(): string {
  try {
    return localStorage.getItem(KEY)?.trim() ?? "";
  } catch {
    return "";
  }
}
export function hasLLM(): boolean {
  return llmKey().length > 0;
}
export function setLLMKey(k: string): void {
  try {
    const v = k.trim();
    if (v) localStorage.setItem(KEY, v);
    else localStorage.removeItem(KEY);
  } catch {
    /* private mode */
  }
}

let lastError = "";
export function llmLastError(): string {
  return lastError;
}

const SYSTEM = `You translate a user's spoken request to a stock butler named Bramwell into ONE canonical command he already understands. Output ONLY the command, nothing else — no quotes, no explanation.

Choose the closest command from these templates (fill in a real company name where shown):
- top gainers today
- top gainers today in my watchlist
- top losers today
- top losers today in my watchlist
- how is my portfolio
- how is <COMPANY> doing
- why is <COMPANY> up
- recent news on <COMPANY>
- brief me
- watch <COMPANY>
- unwatch <COMPANY>
- how much dividend income will I get

Rules:
- "my"/"mine"/"I hold" means the watchlist variant.
- Pick a real, well-known company/ticker if the user clearly implies one (e.g. "the AI chip leader" → Nvidia).
- If the request is not about markets, stocks, the user's holdings, or Bramwell's job, output exactly: NONE`;

/**
 * Returns a canonical command string the local parser can route, or null when
 * the model declines / errors (the caller then falls back to teach-back).
 */
export async function understand(utterance: string): Promise<string | null> {
  const key = llmKey();
  if (!key || !utterance.trim()) {
    lastError = key ? "" : "No key set.";
    return null;
  }
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), 8000);
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 64,
        system: SYSTEM,
        messages: [{ role: "user", content: utterance.trim() }],
      }),
      signal: abort.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      lastError =
        res.status === 401
          ? "Key rejected (401). Check the API key."
          : `Understanding error ${res.status}. ${body.slice(0, 120)}`;
      return null;
    }
    const data = (await res.json()) as { content?: { text?: string }[] };
    const out = (data.content?.[0]?.text ?? "").trim();
    lastError = "";
    if (!out || /^none$/i.test(out)) return null;
    // Guard against a stray explanation: keep it to the first line, and cap it.
    const line = out.split("\n")[0].trim().replace(/^["'`]|["'`]$/g, "");
    return line.length > 0 && line.length <= 80 ? line : null;
  } catch (e) {
    if ((e as { name?: string })?.name === "AbortError") lastError = "Timed out.";
    else lastError = String((e as { message?: string })?.message || e);
    return null;
  } finally {
    clearTimeout(timer);
  }
}
