# Lumen Dashboard

A local-first, fully customizable dashboard. Drag widgets around, resize them, add and
remove them, point each one at your own accounts. Everything runs on your machine —
API calls happen server-side, nothing is sent anywhere but the services you configure.

Runs with **mock data out of the box**: every connector falls back to deterministic
sample data when its credentials are missing, so `npm run dev` gives you a full,
working dashboard before you touch a single API key.

## Run it

Fastest path (installs deps only if missing, then starts the dev server):

```bash
./run.sh
```

Or manually:

```bash
npm install
cp .env.example .env.local   # optional — only for live data
npm run dev                  # http://localhost:3000
```

Production: `npm run build && npm run start`.

## What's included

| Connector | Widgets | Needs |
|---|---|---|
| Stripe | balance, revenue (sparkline + trend), recent payments | `STRIPE_SECRET_KEY` |
| Google Calendar | agenda grouped by day, next-event countdown | `GOOGLE_CALENDAR_TOKEN` |
| Gmail | unread count + newest matching threads | `GMAIL_TOKEN` |
| GitHub | activity feed, repositories, 12-week contribution heatmap | `GITHUB_TOKEN` |
| Weather | current conditions + 12h strip, 5-day forecast | nothing (Open-Meteo) |
| RSS | headlines from any RSS/Atom feed | nothing |
| System | CPU/memory/uptime, disks, NVIDIA GPU, top processes | nothing (reads this machine) |

A widget with missing credentials shows a `sample` badge in its header. GPU stats need
`nvidia-smi` on the host; without it the widget shows sample values for an RTX 3070.

## Customizing

* **Arrange** — toggles drag/resize. Grab a widget by its header; drag the bottom-right
  corner to resize. Layout saves automatically to `data/layout.json`.
* **+ Widget** — the library, filterable by connector.
* **⚙ on a widget** — its own settings (calendar id, GitHub username, feed URL, row
  limits, units…) plus a custom title.
* **⚙ in the top bar** — theme (dark / light / nord / paper), accent colour, column
  count, connector status, and export/import/reset of the whole layout as JSON.

The same widget can be placed more than once with different settings — two RSS feeds,
two calendars, two GitHub users.

## Adding a connector

A connector is one folder with two files. Nothing else in the app needs to know how it works.

```
src/connectors/<id>/
  server.ts     # ConnectorServer: meta, isLive(), handlers keyed by widget id
  widgets.tsx   # WidgetModule[]: a def (size, settings, refresh) + a React component
```

1. Copy `src/connectors/rss/` as a starting point — it is the smallest complete example.
2. `server.ts` exports handlers keyed `'<id>.<widget>'`. Return the **same shape** from
   the live path and the mock path; wrap the live call so a failure falls back to mock
   instead of erroring the route. Use `hasEnv()` from `@/lib/env` for `isLive()`.
3. `widgets.tsx` builds UI from the shared primitives in `@/components/ui`
   (`Stat`, `Rows`, `Row`, `Pill`, `Bar`, `Sparkline`, `Empty`, plus formatters), so a
   new widget matches the rest without any CSS.
4. Register it in three places: `src/lib/registry.server.ts`, `src/lib/registry.client.ts`,
   and `src/lib/connectors.ts` (client-safe metadata — the server halves import Node
   builtins and can never enter the browser bundle).

Types live in `src/lib/types.ts`; that file is the contract.

## Layout & data

* `data/layout.json` — your dashboard, git-ignored. Delete it (or hit **Reset to
  default**) to go back to the shipped layout.
* `/api/widget/<id>` — POST with a settings object, returns `{ ok, data, mode, fetchedAt }`.
* `/api/layout` — GET / PUT / DELETE the config.
* `/api/connectors` — which connectors have credentials.

## Stack

Next.js 14 (App Router) · React 18 · TypeScript strict · react-grid-layout.
No database, no auth, no telemetry — one process and a JSON file.
