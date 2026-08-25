# PROJECT.md — Lumen Dashboard (context handoff)

**This file is machine-maintained: written by and for an AI agent working this repo
unattended, across sessions.** Terse by design. Read this fully, then read PLAN.md's
checkboxes before doing anything — PLAN.md says what's next, this file says what
exists and what was learned doing it. After finishing a checked-off PLAN.md item,
append (don't rewrite) a dated bullet to "Session log" below with what you changed,
how you verified it (a command actually run, not "should work"), and anything
surprising for the next session. Keep old entries; this is a log, not a status page.

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
src/lib/useWidgetData.ts    client hook: POST /api/widget/<id>, auto-refresh, reload()
src/lib/fallback.ts         withFallback(configured, live, mock, label) -> {data,mode,warning?}
                            THE live/mock split, used by all 7 connectors. mode is
                            'mock' (no creds, silent) | 'live' | 'stale' (creds present,
                            live call threw, mock shown with warning = reason).
src/lib/debug.ts            debugFetch(url, init) — fetch() drop-in; logs one line
                            (method/url/status/ms, never headers/secrets) per request
                            when DEBUG_CONNECTORS=1. Used by every connector's network
                            transport fn. system connector has no network calls, skipped.

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
- Every live call goes through `withFallback(configured, live, mock, label)` from
  `src/lib/fallback.ts` (PLAN.md Phase 0, done). `configured=false` -> silent mock
  (`mode:'mock'`). `configured=true` and `live()` throws -> mock is still returned
  (widget stays usable) but as `mode:'stale'` with `warning` set to `label + reason`,
  and `WidgetShell.tsx` renders an amber "fallback" pill with the reason as its
  tooltip instead of silently claiming "sample". Do NOT hand-roll a new try/catch in a
  connector handler — call `withFallback`.
- Every connector's network transport function calls `debugFetch()` (src/lib/debug.ts)
  instead of the global `fetch` — same signature, opt-in request logging.
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
(2026-08-25: re-verified tsc/build clean after Phase 0; Playwright flow not re-run this
session, no browser UI check was performed, see Session log.)

## Not done
No caching (Phase 1), no RSS SSRF guard (Phase 1), no real credentials exercised against
Stripe/GitHub/Google (Phases 2-4), no OAuth refresh, no tests (Phase 6). Phase 0 (honest
error states, replacing "no error state distinct from mock") is done — see PLAN.md and
Session log below.

## Session log
(newest first; each entry is one AI work session)

- **2026-08-25 — Phase 0 done.** Added `WidgetMode`/`HandlerResult` to types.ts,
  `src/lib/fallback.ts` (`withFallback`) and `src/lib/debug.ts` (`debugFetch`); migrated
  all 7 connectors off their duplicated local `resolve`/`safe` try/catch helpers onto
  `withFallback`; `WidgetShell.tsx` now renders an amber "fallback" pill (title=reason)
  for `mode:'stale'`, distinct from the neutral "sample" pill for `mode:'mock'`.
  Verified: fresh `npm install` (node_modules wasn't present), `npx tsc --noEmit` clean,
  `npm run build` clean, then `npm run dev` and curled all 16 widget endpoints — all
  `ok:true`. stripe/gcal/gmail (uncredentialed here) → `mode:'mock'`. weather/rss →
  `mode:'stale'` (this sandbox's egress returns HTTP 403 to Open-Meteo/hnrss — no real
  internet from here, expected). github → `mode:'stale'`, `GitHub 401` (this sandbox has
  an ambient `GITHUB_TOKEN` for unrelated tooling that isn't valid against the GitHub
  REST API — real signal, not a bug). system.overview/disks/processes → `mode:'live'`
  (real host reads). system.gpu → `mode:'stale'`, `spawn nvidia-smi ENOENT` (no GPU in
  this container, matches PLAN.md Phase 1's note that GPU needs the target machine).
  Also verified `DEBUG_CONNECTORS=1 npm run dev` logs one `[connectors] METHOD url ->
  status Nms` line per outbound request with no headers/secrets in the log.
  Added `lumen-dashboard/.gitignore` (node_modules/.next/tsbuildinfo/data) — none
  existed before this session, `npm install`/`npm run build` were leaving large
  untracked-but-stageable directories.
  **Not done this session:** no browser/Playwright check (no browser available in this
  execution context — this was an unattended scheduled run, not an interactive one).
  **Flag for a future session, not acted on:** `npm install` warns
  `next@14.2.15: This version has a security vulnerability` (a real advisory, not this
  repo's own code) — worth a deliberate, tested Next.js upgrade at some point; not part
  of PLAN.md Phase 0-6 and risky to do unprompted mid-connector-work, so left alone.
  **Process note:** did this phase via 7 parallel subagents (one per connector) plus
  hand-written shared/core files. Mid-run, one subagent ran a pathspec-less `git stash`
  to diff against a clean baseline, which caught other agents' and this session's own
  uncommitted edits (including the shared types.ts/registry.server.ts/route.ts/
  WidgetShell.tsx changes) in the stash; it then `git checkout stash@{0} -- <its own 2
  files>` and dropped the stash, which would have silently discarded everyone else's
  work. Recovered fully via `git fsck` finding the dropped stash as a dangling commit
  and `git checkout <sha> -- <lost paths>` from it — nothing was actually lost, but note
  for future sessions: never let a subagent run bare `git stash`/`git stash drop` in a
  shared working tree; if a subagent needs a clean-baseline diff, tell it to use
  `git diff` / a separate worktree instead.
