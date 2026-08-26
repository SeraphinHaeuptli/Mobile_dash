# PROJECT.md — Lumen Dashboard (context handoff)

Machine-readable state dump for an AI agent picking up this repo. Terse by design.
**This file and PLAN.md are written for AI (agent) consumption, not humans** — they are
the persistent memory between scheduled/autonomous iterations. Update both at the end of
every work session: append to the Session log here, and flip PLAN.md checkboxes as phases
complete. Do not remove earlier session-log entries; they are the audit trail.

## Repo layout (important, non-obvious)

The actual Next.js project root is **`lumen/lumen-dashboard/`**, not the repo root. `cd`
there before running anything. The repo root also carries `lumen-dashboard.tar.gz`, an
identical (now stale) duplicate snapshot from before the working tree existed — it is not
authoritative and does not need to be kept in sync; `lumen/lumen-dashboard/` is the only
copy that matters. `.gitignore`, `.env.example` and `data/.gitkeep` were originally missing
from the git-tracked `lumen/lumen-dashboard/` (present only in the tar.gz) and were restored
in the 2026-08-26 session below.

## What it is
Local-first personal dashboard. Next.js 14 App Router · React 18 · TypeScript strict ·
react-grid-layout. No DB, no auth, no telemetry. One process + one JSON file.
Runs on mock data out of the box; connectors go live when env keys are present.

## Run
```
cd lumen/lumen-dashboard
npm install && npm run dev     # localhost:3000
npm run build && npm run start
npx tsc --noEmit               # passes clean
```

## File tree (source only, relative to lumen/lumen-dashboard/)
```
src/lib/types.ts            CONTRACT. ConnectorServer, WidgetModule, WidgetDef,
                            WidgetProps, WidgetSettingField, DashboardConfig/Item,
                            WidgetMode ('mock'|'live'|'stale'), HandlerResult.
src/lib/registry.server.ts  imports every <id>/server.ts; resolveWidget/runWidget
src/lib/registry.client.ts  imports every <id>/widgets.tsx; WIDGETS[], defaultSettings()
src/lib/connectors.ts       CLIENT-SAFE ConnectorMeta[] (duplicated from server metas,
                            because server halves import node: builtins)
src/lib/store.ts            read/writeConfig -> data/layout.json + DEFAULT_CONFIG
src/lib/env.ts              hasEnv(keys)
src/lib/fallback.ts         NEW (Phase 0): withFallback(), fromSample(), debugLog(),
                            debugFetch() — the one shared live/mock/stale helper.
src/lib/mock.ts             seeded() pick() intBetween() walk() minutesFromNow()
src/lib/useWidgetData.ts    client hook: POST /api/widget/<id>, auto-refresh, reload()

src/app/layout.tsx          server; reads config, sets data-theme + --accent on <html>
src/app/page.tsx            server; renders <Dashboard initial={config}/>
src/app/globals.css         4 themes as CSS vars + all shared classes (.pill.warn = amber)
src/app/icon.svg            favicon
src/app/api/widget/[id]/    POST {settings} -> {ok,data,mode,warning?,fetchedAt}
src/app/api/layout/         GET | PUT | DELETE (DELETE = reset to default)
src/app/api/connectors/     GET connector status (live/missing env/widget ids)

src/components/Dashboard.tsx         state owner: config, edit mode, modals, debounced PUT
src/components/Grid.tsx              react-grid-layout wrapper (dynamic, ssr:false)
src/components/WidgetShell.tsx       frame, header actions, fetch, skeleton, ErrorBoundary,
                                     mode pill: neutral "sample" (mock) / amber "stale"
                                     (live attempted, failed — title = reason)
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
- Live path and mock path MUST return the identical TypeScript shape (the `data` field —
  `mode`/`warning` sit outside it in `HandlerResult`/`WidgetResponse`).
- Every live call goes through `withFallback()` from `src/lib/fallback.ts` (or, for
  `system`, `fromSample()` — see below). Do not write a bare try/catch that swallows the
  failure reason; that was the Phase-0 bug.
- `isLive()` = `hasEnv(ENV)` for credentialed connectors, `true` for keyless ones
  (weather/rss/system). `withFallback(hasCreds, live, mock, label)` takes that boolean
  explicitly per call — it does not read `isLive()` itself, so read it at the call site.
- Mode semantics (`WidgetMode` in types.ts): `'mock'` = no credentials, sample by design.
  `'live'` = the real call answered. `'stale'` = credentials/attempt present but the call
  failed — sample data shown, `warning` explains why, UI shows an amber pill instead of the
  neutral "sample" pill. `'stale'` must never render identically to `'mock'`.
- `system` connector is special: each reading (`OverviewData`, `DisksData`, `GpuData`,
  `ProcessesData`) already carries its own `sample: boolean` because failures are
  per-field, not per-call (readOverview() itself never throws). Its handlers call
  `fromSample(data, label)` after `safe()`, not `withFallback()`.
- Outbound HTTP from a connector's live path should go through `debugFetch(label, url,
  init)` (src/lib/fallback.ts) instead of raw `fetch` — it is a transparent passthrough
  that additionally logs one line (method, url, status, ms; **never** headers/body/secrets)
  when `DEBUG_CONNECTORS=1`.
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
Two bugs found and fixed this way (pre-Phase-0): inbox list overflowing its footer (flex:1 +
minHeight:0 without overflow:auto), and header buttons swallowed by the RGL drag handle.

Phase 0 (see below) additionally verified live in this environment: `github` connector had
a real 401 (the sandbox's ambient `GITHUB_TOKEN` is unrelated to this app but is non-empty,
so `hasEnv` correctly treats it as configured) and `weather`/`rss`/`stripe`(with a bogus
test key) all hit real 403s (outbound network here goes through a proxy that doesn't
allowlist those hosts). Every one of those came back `mode:"stale"` with a specific
`warning`, and the dashboard rendered an amber "stale" pill with the reason in its tooltip —
confirms the fix end-to-end, not just in isolation. Screenshot taken during the session
(not committed — verification artifact only).

## Not done
Real credentials never exercised against any live API from a network that can actually
reach them. No caching, no rate-limit handling, no OAuth refresh, no automated tests, no
SSRF guard on the RSS feed URL. See PLAN.md.

## Known issue to flag to the human (not fixed automatically — out of PLAN.md's scope)
`npm install` on 2026-08-26 reported **1 critical + 1 high** `npm audit` finding, both
against `next@14.2.15` (and its `postcss` dependency) — a long list of DoS/SSRF/cache-
poisoning CVEs, patched in Next 16.x. The only fix path (`npm audit fix --force`) is a
**major version bump (14 → 16.3.3)**, which likely requires React 19 and touches App
Router internals — a breaking, hard-to-reverse change well beyond a "harden the connectors"
task. Left alone deliberately this session; a human should decide whether/when to take the
Next.js major upgrade as its own piece of work.

## Session log (append-only, newest last)

### 2026-08-26 — Phase 0 implemented ("make failure visible")
Scheduled/autonomous session. Restored missing `.gitignore`, `.env.example`,
`data/.gitkeep` into `lumen/lumen-dashboard/` (they existed only in the root
`lumen-dashboard.tar.gz`, lost from the tracked working copy — see "Repo layout" above).

Implemented PLAN.md Phase 0 in full:
- `src/lib/types.ts`: added `WidgetMode = 'mock' | 'live' | 'stale'` and `HandlerResult<T>`;
  `ConnectorServer.handlers` now return `Promise<HandlerResult>` instead of bare `Json`;
  `WidgetProps.mode` and `WidgetResponse.mode` widened to `WidgetMode`; `WidgetResponse`
  gained `warning?: string`.
- New `src/lib/fallback.ts`: `withFallback(hasCreds, live, mock, label)` — the one shared
  helper that replaced 7 near-identical local `resolve`/`safe` try/catch functions (one per
  connector, exactly the duplication PLAN.md called out). Also `fromSample()` for the
  `system` connector's different (per-field) fallback shape, `debugLog()` and `debugFetch()`
  for the `DEBUG_CONNECTORS=1` request log.
- All 7 connectors (`stripe`, `gcal`, `gmail`, `github`, `weather`, `rss`, `system`)
  migrated: local fallback helpers removed, live HTTP calls routed through `debugFetch`,
  handlers now report real `mode`/`warning`. This also fixed a real pre-existing bug: the
  keyless "always live" connectors (weather/rss/system) previously reported `mode:'live'`
  even when their live call failed and they silently served mock data — `runWidget()` used
  to derive `mode` from `connector.isLive()` alone, never from whether the call actually
  succeeded. Now `mode` comes from the handler's own outcome.
- `src/lib/registry.server.ts`: `runWidget()` simplified to just return the handler's
  `HandlerResult` (mode/warning already resolved by the handler).
- `src/app/api/widget/[id]/route.ts`: `warning` passed through to the JSON response.
- `src/components/WidgetShell.tsx`: added the amber `.pill.warn` "stale" pill (title =
  `warning`) alongside the existing neutral "sample" pill for `mock`.
- 4 widget files (gcal, github, gmail, stripe) had a local `SampleHint({mode}: {mode:
  'mock'|'live'})` component and a couple of `mode === 'mock' ? … : …` branches (github,
  rss, weather) that only handled the old 2-value union — widened to `WidgetMode` /
  `mode !== 'live'` so `'stale'` is covered too, instead of silently falling into the
  "live" branch.

Verification performed (all in `lumen/lumen-dashboard/`):
1. `npx tsc --noEmit` — clean.
2. `npm run build` — clean, all routes compile.
3. `npm run start` with no env keys set: curled all 16 widget endpoints — mock-only
   connectors (gcal, gmail, stripe w/o key) → `mode:"mock"`; github → `mode:"stale"` (the
   sandbox has an ambient, unrelated `GITHUB_TOKEN` so it attempted a live call and got a
   real 401 — see "Verified" above); weather/rss → `mode:"stale"` (real 403s, proxy
   doesn't allowlist those hosts); system.gpu → `mode:"stale"` (no `nvidia-smi` in this
   container, expected); system.overview/disks/processes → `mode:"live"` (genuinely read
   this container's /proc, os.*).
4. Re-ran with `STRIPE_SECRET_KEY=sk_test_bogus DEBUG_CONNECTORS=1`: confirmed the exact
   PLAN.md Phase 0 acceptance test — `stripe.balance` now returns `mode:"stale"` with
   `warning:"stripe.balance: Stripe 403 on /balance"` instead of a silent mock, and the
   server log showed exactly one line per request
   (`[connectors] stripe: GET https://api.stripe.com/v1/balance -> 403 (53ms)`) with the
   key never printed.
5. Rendered the dashboard with Playwright (chromium at `/opt/pw-browsers`), full-page
   screenshot: amber "stale" pills visible on Weather now / Stripe balance / GitHub
   activity / GPU / Feed, neutral "sample" pills on the mock-only widgets (Next event /
   Agenda / Inbox), zero console/page errors.

Not touched this session: Phase 1 onward (caching, RSS SSRF guard, real GPU verification,
Stripe/GitHub live-field-mapping verification, Google OAuth, credentials UI, test suite).
`npm audit` finding on `next@14.2.15` noted above but deliberately not acted on.

Everything is committed to `claude/practical-ritchie-7p74hi` but **not merged/deployed** —
no real credentials exist in this sandbox, so Phases 2–4's actual API-correctness work
(field mapping, pagination, OAuth) still needs a human with real keys and, ideally, network
egress to the real hosts (this sandbox's proxy blocks stripe.com/open-meteo.com/etc., which
is exactly why Phase 0's honest-failure behavior mattered for testing it at all).
