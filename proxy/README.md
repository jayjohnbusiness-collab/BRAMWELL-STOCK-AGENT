# Bramwell understanding proxy

A tiny serverless endpoint that holds **one** Anthropic API key server-side so
Bramwell's AI-understanding **and** multilingual replies work for **every**
user — no one brings their own key. It serves two tasks, both with the proxy
(not the caller) fixing the model and prompt so it can't be abused.

**Contract**

```
# 1) Understand — turn any phrasing into one canonical command
POST <proxy-url>
{ "utterance": "any names worth keeping an eye on?" }

200 OK
{ "command": "top gainers today" }   // or { "command": null }


# 2) Translate — carry an English reply into the client's language
POST <proxy-url>
{ "task": "translate", "text": "Meridian leads, up 3.2%.", "target": "es" }

200 OK
{ "text": "Meridian encabeza, sube 3,2%." }   // or { "text": null }
```

`target` is one of `es` `fr` `de` `pt` `it` (`en` is a passthrough). Because the
proxy fixes the model, system prompt, and a tiny `max_tokens`, understand can
only ever return a short stock command and translate only a short reply — it
can't be used as a free general-purpose Claude, and each call costs a fraction
of a cent.

---

## Option A — Cloudflare Workers (recommended: free tier, global, no cold start)

1. Install Wrangler and log in:
   ```bash
   npm install -g wrangler
   wrangler login
   ```
2. This folder already ships a `wrangler.toml` (name, entry file, and
   `ALLOWED_ORIGINS` set to the GitHub Pages origin). Edit `ALLOWED_ORIGINS`
   only if your site lives somewhere else.
3. Add your Anthropic key as a secret (never commit it):
   ```bash
   wrangler secret put ANTHROPIC_API_KEY
   # paste your sk-ant-... key when prompted
   ```
4. Deploy:
   ```bash
   wrangler deploy
   ```
   Wrangler prints a URL like `https://bramwell-understand.<you>.workers.dev`.
5. (Recommended) In the Cloudflare dashboard → your Worker → **Settings → Rate
   limiting**, add a rule (e.g. 20 requests/min per IP) so a stray script can't
   run up cost.

## Option B — Vercel

1. `cd proxy/vercel && vercel` (or import the folder in the Vercel dashboard).
2. In the project's **Settings → Environment Variables**, add:
   - `ANTHROPIC_API_KEY` = your `sk-ant-...` key
   - `ALLOWED_ORIGINS` = `https://jayjohnbusiness-collab.github.io`
3. Deploy. Your endpoint is `https://<project>.vercel.app/api/understand`.

---

## Point the app at the proxy

The Pages build already reads a repo variable, so no code change is needed:

1. On GitHub → **Settings → Secrets and variables → Actions → Variables →
   New repository variable**.
2. Name `VITE_UNDERSTAND_PROXY`, value your proxy URL (the Worker URL, or the
   Vercel `…/api/understand` URL).
3. Re-run the deploy: **Actions → Deploy to GitHub Pages → Run workflow**
   (or just push any commit to `main`).

(Prefer to hard-code it instead? Set the URL in `src/config.ts`.)

Once redeployed, **Account → AI understanding** reads "managed by Bramwell"
with no key field, and **Account → Language** drops its "turn on AI
understanding" note — understanding and multilingual replies are on for
everyone, still firing only when the free local understanding can't place a
request.

---

## Notes

- **Security:** set `ALLOWED_ORIGINS` to your real site (not `*`) and add rate
  limiting. Origin checks stop casual cross-site use; rate limiting caps cost.
  For per-user entitlement (Concierge only), gate the proxy behind your auth
  once it exists — the app change is just sending a session token.
- **Cost:** Haiku, ~265 input + ~10 output tokens per call ≈ $0.0003, and only
  on a local miss. Set a spend cap on the Anthropic key for peace of mind.
- The BYO-key mode still works when no proxy is configured (useful for local
  testing) — see `src/agent/understand.ts`.
