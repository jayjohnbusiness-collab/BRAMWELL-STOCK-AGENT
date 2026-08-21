/*
 * Bramwell "understanding" proxy — Cloudflare Worker.
 *
 * Holds ONE Anthropic key server-side so end users never bring their own. It
 * serves two tasks, both with the worker (not the caller) fixing the model and
 * prompt so it can't be abused as a free general-purpose Claude:
 *   · Understand  — POST { "utterance": "..." } → { "command": "<cmd>"|null }.
 *       Translates any phrasing into ONE canonical stock command.
 *   · Translate   — POST { "task": "translate", "text": "...", "target": "es" }
 *       → { "text": "<translated reply>"|null }. Carries an English reply back
 *       into the client's language (es/fr/de/pt/it; en is a passthrough).
 *
 * Each call costs a fraction of a cent. It's still worth
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

// Languages Bramwell replies in (the translate task). Keys match the app.
const LANG_NAMES = { es: "Spanish", fr: "French", de: "German", pt: "Portuguese", it: "Italian" };

function translateSystem(langName) {
  return `Translate the text into ${langName}. It is a short spoken reply from a stock butler named Bramwell to his client. Keep his warm, concise, composed tone. Leave numbers, percentages, ticker symbols, and company names exactly as written. Output ONLY the translation — no quotes, no notes.`;
}

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

    let data;
    try {
      data = await request.json();
    } catch {
      return json({ error: "bad_json" }, 400, cors);
    }

    // Translate task: carry an English reply into the client's language.
    if (data && data.task === "translate") {
      let text = typeof data.text === "string" ? data.text.trim() : "";
      const target = typeof data.target === "string" ? data.target : "";
      if (!text) return json({ text: null }, 200, cors);
      if (target === "en" || !LANG_NAMES[target]) return json({ text }, 200, cors);
      if (text.length > MAX_LEN) text = text.slice(0, MAX_LEN);
      try {
        const upstream = await callModel(env, translateSystem(LANG_NAMES[target]), text, 400);
        if (!upstream.ok) return json({ error: "upstream", status: upstream.status }, 502, cors);
        const out = await upstream.json();
        const raw = (out.content && out.content[0] && out.content[0].text) || "";
        const translated = raw.trim().replace(/^["'`]|["'`]$/g, "");
        return json({ text: translated || null }, 200, cors);
      } catch (e) {
        return json({ error: "proxy_failure", detail: String(e).slice(0, 120) }, 502, cors);
      }
    }

    // Understand task (default): phrasing → one canonical command.
    let utterance = typeof data.utterance === "string" ? data.utterance.trim() : "";
    if (!utterance) return json({ command: null }, 200, cors);
    if (utterance.length > MAX_LEN) utterance = utterance.slice(0, MAX_LEN);

    try {
      const upstream = await callModel(env, SYSTEM, utterance, 64);
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

function callModel(env, system, content, maxTokens) {
  return fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content }],
    }),
  });
}
