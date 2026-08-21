/*
 * Bramwell "understanding" proxy — Vercel serverless function.
 *
 * Same contract as the Cloudflare Worker: POST { "utterance": "..." } →
 * { "command": "<canonical command>" | null }. Deploy this repo's /proxy/vercel
 * folder to Vercel and set env vars ANTHROPIC_API_KEY (required) and
 * ALLOWED_ORIGINS (comma-separated origins, or "*" for testing).
 *
 * File path matters: Vercel serves this at /api/understand.
 */

const MODEL = "claude-haiku-4-5";
const MAX_LEN = 400;

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

function allow(origin) {
  const allowed = (process.env.ALLOWED_ORIGINS || "*").split(",").map((s) => s.trim()).filter(Boolean);
  if (allowed.includes("*")) return origin || "*";
  return origin && allowed.includes(origin) ? origin : null;
}

export default async function handler(req, res) {
  const origin = req.headers.origin || "";
  const allowOrigin = allow(origin);
  res.setHeader("access-control-allow-methods", "POST, OPTIONS");
  res.setHeader("access-control-allow-headers", "content-type");
  res.setHeader("vary", "origin");
  if (allowOrigin) res.setHeader("access-control-allow-origin", allowOrigin);

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });
  if (origin && !allowOrigin) return res.status(403).json({ error: "origin_not_allowed" });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: "server_not_configured" });

  let utterance = typeof req.body?.utterance === "string" ? req.body.utterance.trim() : "";
  if (!utterance) return res.status(200).json({ command: null });
  if (utterance.length > MAX_LEN) utterance = utterance.slice(0, MAX_LEN);

  try {
    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({ model: MODEL, max_tokens: 64, system: SYSTEM, messages: [{ role: "user", content: utterance }] }),
    });
    if (!upstream.ok) return res.status(502).json({ error: "upstream", status: upstream.status });
    const out = await upstream.json();
    const raw = (out.content && out.content[0] && out.content[0].text) || "";
    const line = raw.trim().split("\n")[0].trim().replace(/^["'`]|["'`]$/g, "");
    const command = !line || /^none$/i.test(line) || line.length > 80 ? null : line;
    return res.status(200).json({ command });
  } catch (e) {
    return res.status(502).json({ error: "proxy_failure", detail: String(e).slice(0, 120) });
  }
}
