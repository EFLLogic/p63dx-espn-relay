# P63DX ESPN relay

Companion to the P63DX Live Command Center (private repo `EFLLogic/P63DX-LIVE-COMMAND-CENTER`). Kept public so Netlify can deploy it on the free plan. No secrets live here: the token is set in Netlify and Cloudflare.

ESPN refuses data requests that come from Cloudflare (HTTP 403), which is where
the P63DX site runs. Without live data the site falls back to its saved
snapshot, so scores go stale and some sports pages sit on "loading".

This relay runs somewhere other than Cloudflare, fetches the same public ESPN
JSON on the site's behalf, and passes it back. It only relays `*.espn.com`
addresses and caches each response for 60 seconds.

## Deploy on Netlify (free)

1. Netlify → **Add new project → Import an existing project → GitHub** →
   `EFLLogic/p63dx-espn-relay`, branch `main`.
2. Leave base directory and build command empty; `netlify.toml` sets the rest.
3. **Environment variables** → `RELAY_TOKEN` = any long random string.
4. Deploy, then open `<site address>/health` — it should show `{"ok":true}`.

The function lives in `netlify/functions/espn.mjs` and runs on AWS, which
ESPN answers.

## Or deploy on Railway (about 5 minutes)

1. Railway → **New Project → Deploy from GitHub repo** →
   `EFLLogic/p63dx-espn-relay`.
2. Railway runs `npm start` from the repository root.
3. **Variables** → add `RELAY_TOKEN` = any long random string (keep it handy).
4. **Settings → Networking → Generate Domain**. Copy the address, e.g.
   `https://p63dx-espn-relay-production.up.railway.app`.
5. Open `<that address>/health` — it should show `{"ok":true}`.

## Point the site at it (Cloudflare)

Cloudflare dashboard → **Workers & Pages → p63dx-live-command-center →
Settings → Variables and Secrets**:

| Name | Type | Value |
|---|---|---|
| `ESPN_RELAY_URL` | Text | the Netlify or Railway address (no trailing slash) |
| `ESPN_RELAY_TOKEN` | Secret | the same value as `RELAY_TOKEN` |

Click **Deploy**. Then open
`https://p63dx-live-command-center.eric-laboissonniere.workers.dev/api/sports/provider-health`
— it should show `"relay":true` and `"status":200` for all three checks. The
TVs pick up live scores on their next refresh; nothing needs to be touched on
the Fire Sticks.

## Turning it off

Delete `ESPN_RELAY_URL` in Cloudflare and the site goes straight to ESPN again.

## Run locally

```
RELAY_TOKEN=test node server.mjs
curl -H "x-relay-token: test" "http://localhost:8080/espn?url=https%3A%2F%2Fsite.web.api.espn.com%2Fapis%2Fsite%2Fv2%2Fsports%2Ffootball%2Fnfl%2Fteams%2F8%2Fschedule"
```
