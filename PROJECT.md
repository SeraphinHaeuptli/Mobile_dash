# PROJECT.md — Lumen Dashboard (context handoff)

**This file is machine-maintained: an AI agent (Claude, scheduled) reads it, does the
next unchecked item in PLAN.md, and appends what it built/found to "Recent work" below
before ending its turn.** Machine-readable state dump for an AI agent picking up this
repo. Terse by design. Prepend new entries (newest first) — don't rewrite history.

## What it is
Local-first personal dashboard. Next.js 14 App Router · React 18 · TypeScript strict ·
react-grid-layout. No DB, no auth, no telemetry. One process + one JSON file.
Runs on mock data out of the box; connectors go live when env keys are present.

## Run
```
npm install && npm run dev     # localhost:3000
npm run build && npm run start
npx tsc --noEmit               # passes clean
```

## File tree (source only)
```
src/lib/types.ts            CONTRACT. ConnectorServer, WidgetModule, WidgetDef,
                            WidgetProps, WidgetSettingField, DashboardConfig/Item.
src/lib/registry.server.ts  imports every <id>/server.ts; resolveWidget/runWidget
src/lib/registry.client.ts  imports every <id>/widgets.tsx; WIDGETS[], defaultSettings()
src/lib/connectors.ts       CLIENT-SAFE ConnectorMeta[] (duplicated from server metas,
                            because server halves import node: builtins)
src/lib/store.ts            read/writeConfig -> data/layout.json + DEFAULT_CONFIG
src/lib/env.ts              hasEnv(keys)
src/lib/fallback.ts         withFallback(label, enabled, live, mock) + logFetch(); see below
src/lib/mock.ts             seeded() pick() intBetween() walk() minutesFromNow()
src/lib/useWidgetData.ts    client hook: POST /api/widget/<id>, auto-refresh, reload()

src/app/layout.tsx          server; reads config, sets data-theme + --accent on <html>
src/app/page.tsx            server; renders <Dashboard initial={config}/>
src/app/globals.css         4 themes as CSS vars + all shared classes
src/app/icon.svg            favicon
src/app/api/widget/[id]/    POST {settings} -> {ok,data,mode,fetchedAt}
src/app/api/layout/         GET | PUT | DELETE (DELETE = reset to default)
src/app/api/connectors/     GET connector status (live/missing env/widget ids)

src/components/Dashboard.tsx         state owner: config, edit mode, modals, debounced PUT
src/components/Grid.tsx              react-grid-layout wrapper (dynamic, ssr:false)
src/components/WidgetShell.tsx       frame, header actions, fetch, skeleton, ErrorBoundary
src/components/WidgetLibrary.tsx     add-widget modal, filter by connector
src/components/WidgetSettings.tsx    per-widget settings modal (renders WidgetSettingField[])
src/components/DashboardSettings.tsx theme/accent/columns/connector status/export-import-reset
src/components/ui.tsx                Stat StatGrid Rows Row Pill Bar Sparkline Empty
                                     + money() compact() bytes() relTime() clockTime()

src/connectors/<id>/server.ts   default export ConnectorServer
src/connectors/<id>/widgets.tsx default export WidgetModule[]  ('use client')
src/connectors/<id>/mock.ts     optional
```

## Connectors (7) and widgets (16)
| id | env keys | widget ids | live status |
|---|---|---|---|
| stripe | STRIPE_SECRET_KEY | stripe.balance, stripe.revenue, stripe.payments | code written, untested vs real API |
| gcal | GOOGLE_CALENDAR_TOKEN | gcal.agenda, gcal.next | code written, untested; static bearer token only |
| gmail | GMAIL_TOKEN | gmail.inbox | code written, untested; static bearer token only |
| github | GITHUB_TOKEN | github.activity, github.repos, github.contributions | code written, untested |
| weather | — | weather.current, weather.forecast | genuinely live (Open-Meteo, no key) |
| rss | — | rss.feed | genuinely live; hand-written RSS/RDF/Atom parser, no deps |
| system | — | system.overview, system.disks, system.gpu, system.processes | live via node:os + df/ps/nvidia-smi |

## Conventions (must hold for new code)
- Widget id = `<connectorId>.<name>`. Handler keys in server.ts use the full widget id.
- Live path and mock path MUST return the identical TypeScript shape.
- Every live call goes through `withFallback(label, enabled, live, mock)` in
  `src/lib/fallback.ts` (Phase 0, done). A failure there is **not silent**: it serves
  mock data tagged `_fallback: reason`; `registry.server.ts` lifts that into
  `WidgetResponse.mode = 'stale'` + `warning`, and `WidgetShell.tsx` shows an amber
  "stale" pill (tooltip = reason) instead of the neutral "sample" pill. `mode: 'mock'`
  now means "no credentials configured", not "something broke".
- `isLive()` = `hasEnv(ENV)`. Keyless connectors return `true` and pass `enabled: true`
  to `withFallback` unconditionally (see weather/rss/system `server.ts`).
- Set `DEBUG_CONNECTORS=1` to log every outbound connector request (method, url, status,
  ms) to the server console via `logFetch()`. Never logs headers/tokens.
- Mocks are deterministic: `seeded(widgetId + settings + today)`.
- Widget UI is built only from `@/components/ui` primitives + globals.css classes.
  No hardcoded colors except a connector's `meta.accent`; use `var(--text-dim)` etc.
- No new npm dependencies without a reason; no `any` in exported signatures.
- Registering a connector touches exactly 3 files: registry.server.ts, registry.client.ts,
  connectors.ts.

## Grid model
12 columns default (6–16 configurable), rowHeight 40px, margin 10px.
`draggableHandle=".drag-handle"` (widget header), `draggableCancel=".widget-actions"`
— the cancel is required or header buttons are swallowed in edit mode.
Layout persists debounced (500ms) via PUT /api/layout to `data/layout.json` (gitignored).

## Verified
tsc clean · next build clean · all 16 widget endpoints return ok:true ·
Playwright pass: add → configure → drag → persist → reload → remove, zero console errors.
Two bugs found and fixed this way: inbox list overflowing its footer (flex:1 + minHeight:0
without overflow:auto), and header buttons swallowed by the RGL drag handle.

## Not done
Real credentials never exercised against any live API. No caching, no rate-limit handling,
no OAuth refresh, no tests. See PLAN.md (Phase 0 — honest error states — is done; Phase 1
onward is not).

## Recent work
(newest first — append here, don't rewrite older entries)

### 2026-08-25 — Phase 0: make failure visible
Implemented PLAN.md Phase 0 in full:
- `src/lib/types.ts`: `WidgetResponse.mode` widened to `'mock' | 'live' | 'stale'`,
  added `warning?: string`. `WidgetProps.mode` left as `'mock' | 'live'` on purpose —
  staleness is a shell-level concern (amber pill), not something widget components
  need to branch on; `WidgetShell.tsx` maps `'stale'` -> `'live'` when it hands `mode`
  to the widget's own `<Component>`.
- New `src/lib/fallback.ts`: `withFallback(label, enabled, live, mock)` replaces the
  seven near-identical local `resolve()`/`safe()` helpers that used to live one per
  connector (stripe, gcal, gmail, github, weather, rss, system). On a live failure it
  returns `{ ...mock(), _fallback: reasonString }` instead of silently swallowing the
  error. Also exports `logFetch(method, url, status, ms)`, gated on
  `DEBUG_CONNECTORS=1`, called from each connector's low-level transport function
  (stripeGet, gh, gmailGet, fetchEvents, openMeteo, liveFeed) — never logs headers, so
  the bearer token/API key never reaches the log line.
- `src/lib/registry.server.ts`: `runWidget()` now inspects the handler's return value
  for a `_fallback` string, strips it out of `data`, and reports
  `{ mode: 'stale', warning }` instead of `{ mode: 'live' }` when present. All 7
  connector `server.ts` files updated to call `withFallback` instead of their local
  helper (same call sites, same mock functions — just the wrapper changed).
- `src/app/api/widget/[id]/route.ts` passes `warning` through to the client.
- `src/components/WidgetShell.tsx`: added an amber `.pill.warn` "stale" chip (title =
  the warning string) next to the existing neutral "sample" chip.
- Added `lumen/lumen-dashboard/.gitignore` — there wasn't one in the repo at all, so
  `npm install` was making `node_modules/` show up as untracked. Ignores
  `node_modules/`, `.next/`, `tsconfig.tsbuildinfo`, and `data/`/`.env*.local` (per the
  existing "data/layout.json (gitignored)" claim in this file, which wasn't actually
  true until now).

**Verification performed** (see PLAN.md Phase 0 verify steps):
- `npx tsc --noEmit` clean, `npm run build` clean.
- `grep -n catch src/connectors/*/server.ts` — only legitimate internal parsing
  fallbacks remain (rss `hostOf()`, system `readMemory`/`readDistro`/BSD-`ps` retry,
  gmail's tolerated secondary `labels/UNREAD` lookup); no bare
  `catch { return mock }` connector-level fallback left.
- Ran `npm run dev` and POSTed to all 16 widget endpoints. In this sandbox, outbound
  HTTPS to `api.github.com`/`open-meteo.com`/the RSS host is proxy-blocked (403), and
  this container happens to have a real `GITHUB_TOKEN` in its env (Claude Code's own
  GitHub MCP token) — which is exactly the scenario Phase 0 is meant to surface: those
  widgets correctly came back `mode: 'stale'` with the real reason (`"GitHub 401"`,
  `"Open-Meteo 403"`, `"Feed 403"`, `"spawn nvidia-smi ENOENT"` for the GPU widget on a
  machine with no `nvidia-smi`), while stripe/gcal/gmail (no credentials set) correctly
  stayed `mode: 'mock'` with no warning, and `system.overview/disks/processes` came
  back genuinely `mode: 'live'` (this container does have `/proc`, `df`, `ps`).
- Confirmed with `DEBUG_CONNECTORS=1`: one `[connectors] GET <url> <status> <ms>ms`
  line per outbound request plus one `[connectors] <label> fallback: <reason>` line on
  failure; verified by eye that no header or token value appears in the log.
- Playwright screenshot against the running dashboard confirmed the rendered UI: mock
  widgets show a neutral "sample" pill, failed-live widgets show an amber "stale" pill
  whose `title` attribute holds the exact failure string (e.g. `"Open-Meteo 403"`).
  Zero console errors observed.

**Next step for the next iteration:** Phase 1 (`src/lib/cache.ts` TTL cache, RSS SSRF
guard, system.gpu verification against the real Ryzen 5 / RTX 3070 box). Note this
sandbox has no `nvidia-smi` and no outbound network to the real APIs, so Phase 1's
"hammer weather.current 10x, count 1 upstream request" and SSRF verify steps can be
implemented and unit-tested here, but the GPU-parsing verify step genuinely needs the
target machine.
