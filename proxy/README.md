# Bramwell understanding proxy

A tiny serverless endpoint that holds **one** Anthropic API key server-side so
Bramwell's AI-understanding fallback works for **every** user — no one brings
their own key. The browser only ever sends the user's phrase; the proxy builds
the whole model request and returns a single canonical command.

**Contract**

```
POST <proxy-url>
Content-Type: application/json
{ "utterance": "any names worth keeping an eye on?" }

200 OK
{ "command": "top gainers today" }   // or { "command": null }
```

Because the proxy — not the caller — fixes the model, system prompt, and a tiny
`max_tokens`, the endpoint can only ever return a short stock command. It can't
be used as a free general-purpose Claude, and each call costs ~$0.0003.

---

## Option A — Cloudflare Workers (recommended: free tier, global, no cold start)

1. Install Wrangler and log in:
   ```bash
   npm install -g wrangler
   wrangler login
   ```
2. From this `proxy/` folder, create `wrangler.toml`:
   ```toml
   name = "bramwell-understand"
   main = "understand-worker.js"
   compatibility_date = "2024-11-01"

   [vars]
   ALLOWED_ORIGINS = "https://jayjohnbusiness-collab.github.io"
   ```
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

Set the proxy URL for the app build. Either:

- **Edit `src/config.ts`** and hard-code the URL, **or**
- **Set `VITE_UNDERSTAND_PROXY`** at build time. For the GitHub Pages deploy,
  add it to `.github/workflows/deploy-pages.yml` on the build step:
  ```yaml
        - name: Build self-contained single-file bundle
          run: npm run build
          env:
            SINGLE_FILE: "1"
            VITE_UNDERSTAND_PROXY: "https://bramwell-understand.<you>.workers.dev"
  ```

Rebuild/redeploy. In the app, **Account → AI understanding** now reads
"managed by Bramwell" with no key field — the feature is on for everyone, and
still only fires when the free local understanding can't place a request.

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
