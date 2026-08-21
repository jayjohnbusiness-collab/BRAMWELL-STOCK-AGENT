/*
 * Bramwell "understanding" proxy — Cloudflare Worker.
 *
 * Holds ONE Anthropic key server-side so end users never bring their own. The
 * browser POSTs { "utterance": "..." }; the worker builds the whole model
 * request itself (fixed model, system prompt, tiny max_tokens) and returns
 * { "command": "<canonical command>" } or { "command": null }.
 *
 * Because the worker — not the caller — controls the model and prompt, the
 * endpoint can only ever return a short stock command. It can't be abused as a
 * free general-purpose Claude, and each call costs ~$0.0003. It's still worth
 * locking down: set ALLOWED_ORIGINS to your site, and add a Cloudflare Rate
 * Limiting rule (see proxy/README.md).
 *
 * Secrets / vars (set with `wrangler secret put` / in the dashboard):
 *   ANTHROPIC_API_KEY  (secret, required)  your Anthropic API key
 *   ALLOWED_ORIGINS    (var, recommended)  comma-separated origins allowed to
 *                                          call this, e.g.
 *                                          "https://jayjohnbusiness-collab.github.io"
 *                                          Use "*" only for quick testing.
 */

const MODEL = "claude-haiku-4-5";
const MAX_LEN = 400; // reject absurdly long inputs

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

function corsHeaders(origin, env) {
  const allowed = (env.ALLOWED_ORIGINS || "*")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const allowAll = allowed.includes("*");
  const ok = allowAll || (origin && allowed.includes(origin));
  return {
    "access-control-allow-origin": ok ? origin || "*" : allowed[0] || "*",
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "content-type",
    "access-control-max-age": "86400",
    vary: "origin",
    _ok: ok,
  };
}

function json(body, status, cors) {
  const { _ok, ...headers } = cors;
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("origin") || "";
    const cors = corsHeaders(origin, env);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }
    if (request.method !== "POST") {
      return json({ error: "method_not_allowed" }, 405, cors);
    }
    if (origin && !cors._ok) {
      return json({ error: "origin_not_allowed" }, 403, cors);
    }
    if (!env.ANTHROPIC_API_KEY) {
      return json({ error: "server_not_configured" }, 500, cors);
    }

    let utterance = "";
    try {
      const data = await request.json();
      utterance = typeof data.utterance === "string" ? data.utterance.trim() : "";
    } catch {
      return json({ error: "bad_json" }, 400, cors);
    }
    if (!utterance) return json({ command: null }, 200, cors);
    if (utterance.length > MAX_LEN) utterance = utterance.slice(0, MAX_LEN);

    try {
      const upstream = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 64,
          system: SYSTEM,
          messages: [{ role: "user", content: utterance }],
        }),
      });
      if (!upstream.ok) {
        return json({ error: "upstream", status: upstream.status }, 502, cors);
      }
      const out = await upstream.json();
      const raw = (out.content && out.content[0] && out.content[0].text) || "";
      const line = raw.trim().split("\n")[0].trim().replace(/^["'`]|["'`]$/g, "");
      const command = !line || /^none$/i.test(line) || line.length > 80 ? null : line;
      return json({ command }, 200, cors);
    } catch (e) {
      return json({ error: "proxy_failure", detail: String(e).slice(0, 120) }, 502, cors);
    }
  },
};
