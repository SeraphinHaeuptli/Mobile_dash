# PROJECT.md — Lumen Dashboard (context handoff)

**Machine-readable state dump for an AI agent picking up this repo.** Terse by design —
written to be read by the next AI iteration, not by a human skimming for prose. Update
this file (and PLAN.md's checkboxes) at the end of every work session: append what was
coded/researched under "Verified" or a new dated note, and move anything no longer true
out of "Not done". Read PLAN.md next for the phased task list and its checkboxes.

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
src/lib/mock.ts             seeded() pick() intBetween() walk() minutesFromNow()
src/lib/fallback.ts         withFallback(isLive, live, mock, label) -> shared per-connector
                            try/catch; on live failure, mock gets a hidden _fallback:reason
                            field that registry.server.ts turns into mode:'stale'+warning.
src/lib/debugFetch.ts       fetch() wrapper; logs method/url/status/ms when
                            DEBUG_CONNECTORS=1, never logs headers/body (no key leakage).
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
- Every live call is wrapped in try/catch and **silently falls back to mock** on failure.
  (Known weakness — see PLAN.md Phase 0.)
- `isLive()` = `hasEnv(ENV)`. Keyless connectors return `true` and rely on the fallback.
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

**2026-08-26 — PLAN.md Phase 0 done** (see PLAN.md for the itemised checklist). Summary:
- `WidgetMode` widened to `'mock' | 'live' | 'stale'`; `WidgetResponse.warning?: string`.
- New `src/lib/fallback.ts` (`withFallback`) and `src/lib/debugFetch.ts` replace the 7
  duplicated local `resolve`/`safe` try/catch helpers that used to live one per
  connector's server.ts — a live failure now surfaces as `mode:'stale'` + the real error
  string instead of a silent, indistinguishable mock.
- `WidgetShell.tsx` renders an amber `.pill.warn` "stale" badge (tooltip = the failure
  reason) next to the existing neutral "sample" pill; the 4 widgets.tsx files with local
  `SampleHint` components and the 3 with inline `mode === 'mock'` ternaries were all
  updated to treat `mode !== 'live'` as "show sample styling" so `stale` renders sanely
  everywhere, not just in the header pill.
- `npx tsc --noEmit` and `npm run build` both clean.
- Verified live in a browser (Playwright, Chromium at `/opt/pw-browsers/chromium`, no
  console errors) with `STRIPE_SECRET_KEY=sk_test_bogus...` and `DEBUG_CONNECTORS=1`:
  stripe/weather/github/rss widgets (all of which attempted a real HTTP call and got a
  non-2xx back) showed the amber "stale" pill with the real failure string as tooltip;
  gcal/gmail (no env keys configured at all, so `isLive()` is false and the live path is
  never attempted) correctly kept the neutral "sample" pill; system.overview (no network,
  reads `/proc` + `os.*` directly) showed no pill at all, i.e. genuinely live.
  `dev.log` confirmed `DEBUG_CONNECTORS=1` logs one `[connectors] METHOD url -> status
  (Nms)` line per outbound fetch with no header/body/token content.

## Not done
Real credentials never exercised against any live API — and per the sandbox note in
PLAN.md's Phase 0 section, they cannot be from inside this container (outbound egress to
third-party hosts returns HTTP 403 through this environment's proxy, confirmed against
Open-Meteo/Stripe/GitHub/hnrss.org). Phase 0's failure-visibility mechanism itself is
fully done and verified, but Phases 1–6 (caching, RSS SSRF guard, GPU-vs-nvidia-smi,
Stripe pagination/field-mapping, GitHub PAT scopes, Google OAuth flow, credentials UI,
vitest suite) are all still open — see PLAN.md checkboxes. No OAuth refresh, no tests yet.
