# PROJECT.md — Lumen Dashboard (context handoff)

> **For AI agents only.** Machine-readable state dump for whichever agent picks up this
> repo next — terse by design, not meant for a human to read as prose. Read this file,
> then PLAN.md's checkboxes, before touching code. The actual Next.js project lives at
> `lumen/lumen-dashboard/` in this repo (not the repo root) — `cd` there before running
> any command below. After finishing a PLAN.md item: append to the progress log at the
> bottom of this file (what you changed, what you verified, what you deliberately left),
> check the box in PLAN.md, then stop — don't start the next phase in the same pass
> unless asked to.

## What it is
Local-first personal dashboard. Next.js 14 App Router · React 18 · TypeScript strict ·
react-grid-layout. No DB, no auth, no telemetry. One process + one JSON file.
Runs on mock data out of the box; connectors go live when env keys are present.

## Run
Project root is `lumen/lumen-dashboard/`, not the repo root — `cd` there first.
```
cd lumen/lumen-dashboard
npm install && npm run dev     # localhost:3000
npm run build && npm run start
npx tsc --noEmit               # passes clean
DEBUG_CONNECTORS=1 npm run dev # logs every outbound connector request (method/url/status/ms)
```

## File tree (source only)
```
src/lib/types.ts            CONTRACT. ConnectorServer, WidgetResult, WidgetModule, WidgetDef,
                            WidgetProps, WidgetSettingField, DashboardConfig/Item.
                            Handlers return Promise<WidgetResult> = {data, mode, warning?};
                            mode is 'live' | 'mock' | 'stale' (see src/lib/fallback.ts).
src/lib/fallback.ts         withFallback(live, mock, {envKeys, label}) -> WidgetResult.
                            THE shared helper every connector handler calls — do not write
                            a new local try/catch mock-fallback, use this.
src/lib/debugFetch.ts       fetch() drop-in; logs method/url/status/ms when
                            DEBUG_CONNECTORS=1. Every connector transport fn uses this
                            instead of raw fetch(). Never put secrets in the URL, only in
                            headers, since the URL is what gets logged.
src/lib/registry.server.ts  imports every <id>/server.ts; resolveWidget/runWidget
src/lib/registry.client.ts  imports every <id>/widgets.tsx; WIDGETS[], defaultSettings()
src/lib/connectors.ts       CLIENT-SAFE ConnectorMeta[] (duplicated from server metas,
                            because server halves import node: builtins)
src/lib/store.ts            read/writeConfig -> data/layout.json + DEFAULT_CONFIG
src/lib/env.ts              hasEnv(keys)
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
| stripe | STRIPE_SECRET_KEY | stripe.balance, stripe.revenue, stripe.payments | fallback path verified real (401/403); success path untested — no key |
| gcal | GOOGLE_CALENDAR_TOKEN | gcal.agenda, gcal.next | code written, untested; static bearer token only |
| gmail | GMAIL_TOKEN | gmail.inbox | code written, untested; static bearer token only |
| github | GITHUB_TOKEN | github.activity, github.repos, github.contributions | fallback path verified real (401 against this sandbox's token); success path untested |
| weather | — | weather.current, weather.forecast | fallback path verified real (403, egress-restricted); Open-Meteo success untested here |
| rss | — | rss.feed | fallback path verified real (403, egress-restricted); hand-written RSS/RDF/Atom parser, no deps |
| system | — | system.overview, system.disks, system.gpu, system.processes | live via node:os + df/ps/nvidia-smi; system.gpu confirmed 'stale' on a no-GPU box |

## Conventions (must hold for new code)
- Widget id = `<connectorId>.<name>`. Handler keys in server.ts use the full widget id.
- Live path and mock path MUST return the identical TypeScript shape.
- Every connector handler goes through `withFallback()` in `src/lib/fallback.ts` — never
  write a local try/catch mock-fallback. A live failure now returns mode `'stale'` with a
  `warning` string (the reason), not a silent unlabeled `'mock'`. Only missing credentials
  (env keys unset) get the neutral `'mock'` label. Fixed in PLAN.md Phase 0 (done).
- `isLive()` = `hasEnv(ENV)`. Keyless connectors return `true` and always attempt live.
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
2026-08-26: `mode: 'stale'` + `warning` verified against 4 real APIs' real failure
responses (Stripe 403, GitHub 401, Open-Meteo 403, an RSS host's 403) — see PLAN.md
Phase 0 and the progress log below. DEBUG_CONNECTORS=1 log output checked for leaked
secrets — none found.

## Not done
No real API *success* path exercised yet (no `.env.local`, no credentials committed or
available in a cloud agent session) — only real *failure* paths so far. No caching, no
rate-limit handling, no OAuth refresh, no tests, no RSS SSRF guard. See PLAN.md.

## Progress log
Newest first. One entry per work session; keep entries short — this is a log, not prose.
Repo root also gained a `lumen/lumen-dashboard/.gitignore` (node_modules/.next/build
artifacts were untracked-but-not-ignored before; nothing was ever committed by mistake,
but `git status` was noisy).

- **2026-08-26 — PLAN.md Phase 0 (make failure visible)**, done, all 4 items checked.
  Changed: `src/lib/types.ts` (new `WidgetResult`, `WidgetResponse.mode` widened to add
  `'stale'`, `.warning?`); new `src/lib/fallback.ts` (`withFallback`) and
  `src/lib/debugFetch.ts`; all 7 `src/connectors/*/server.ts` switched from a local
  try/catch to `withFallback` + `debugFetch`; `src/lib/registry.server.ts` `runWidget`
  now passes the handler's `{mode, warning}` straight through instead of deriving mode
  from `connector.isLive()`; `src/app/api/widget/[id]/route.ts` forwards `warning`;
  `src/components/WidgetShell.tsx` renders an amber `pill warn` "⚠ stale" pill (title =
  the warning) next to the existing neutral "sample" pill, reusing the pre-existing
  `.pill.warn` CSS class (no globals.css change needed).
  Verified: `npx tsc --noEmit` clean, `npm run build` clean, all 16 widget endpoints
  return `ok:true`. Ran the dev server with `DEBUG_CONNECTORS=1` and (separately)
  `STRIPE_SECRET_KEY=sk_test_bogus`; screenshotted the dashboard with Playwright
  (installed ad-hoc via `npm install --no-save playwright`, then uninstalled — it is
  *not* a project dependency yet, that's Phase 6's job). Confirmed visually and via the
  API responses that failing live calls (Stripe 403, GitHub 401 — this sandbox happens to
  inject a `GITHUB_TOKEN` for its own tooling that the real GitHub API rejects for this
  app, Open-Meteo 403, an RSS host 403, `nvidia-smi` ENOENT) all show `mode:'stale'` with
  a specific `warning`, while credential-less widgets (gcal, gmail — no env keys in this
  session) show the plain `mode:'mock'` pill as before. Checked the DEBUG_CONNECTORS log
  for the literal value of every env credential key — zero matches, confirming no
  secrets leak into logs.
  Next: Phase 1 (caching + RSS SSRF guard; the Phase 1.3 GPU item needs to run on the
  actual target machine, not a cloud session — skip it here).
