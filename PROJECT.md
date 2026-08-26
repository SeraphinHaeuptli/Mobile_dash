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
Local-first personal dashboard. Next.js 16 App Router · React 18 · TypeScript strict ·
react-grid-layout. No DB, no auth, no telemetry. One process + one JSON file.
Runs on mock data out of the box; connectors go live when env keys are present.

## Run
```
cd lumen/lumen-dashboard
npm install && npm run dev     # localhost:3000
npm run build && npm run start
npx tsc --noEmit               # passes clean
npm test                       # vitest, 198 tests, no network needed
npm run test:e2e               # playwright smoke flow; builds + serves on :3100
```
`npm test` is unit + contract tests only. The e2e flow is separate on purpose: it needs a
production build and a browser, so it must not block a quick `npm test`.

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
src/lib/fallback.ts         Phase 0: withFallback(), fromSample(), debugLog(),
                            debugFetch() — the one shared live/mock/stale helper.
                            Phase 1 added withFallback's optional 5th `cache` arg.
src/lib/cache.ts            Phase 1: in-memory TTL map. cacheKey(widgetId, settings),
                            cacheGet(), cacheSet(). Module state, resets on restart.
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
src/connectors/<id>/server.test.ts    Phase 6 unit tests (rss, system, stripe)
src/connectors/<id>/__fixtures__/     Phase 6 upstream fixtures; system's has a
                                      README documenting captured vs hand-written

src/lib/contract.test.ts    Phase 6: drives all 16 widget ids through the mock path
                            and the live parse path (fetch stubbed from fixtures) and
                            asserts identical key shapes.
src/lib/fallback.test.ts    Phase 6: cache + withFallback + fromSample + debug logging.
vitest.config.mts           aliases `server-only` to its no-op build and sets the JSX
                            transform explicitly (vite 7+ uses oxc, not esbuild).
playwright.config.ts        e2e only; builds and serves the app on :3100 itself.
e2e/flow.spec.ts            Phase 6 smoke flow: add → configure → drag → persist →
                            reload → remove, plus regression guards for the two bugs
                            found by hand (widget-body overflow, RGL swallowing
                            header buttons).
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
| system | — | system.overview, system.disks, system.gpu, system.processes | live via node:os + df/ps; GPU via nvidia-smi **or** DRM sysfs (AMD/Intel) |

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
  `'live'` = the real call answered (or a fresh cache hit — still real data, just not
  re-fetched). `'stale'` = credentials/attempt present but the call failed — sample data
  shown, `warning` explains why, UI shows an amber pill instead of the neutral "sample"
  pill. `'stale'` must never render identically to `'mock'`.
- Caching (Phase 1) is the optional 5th arg of `withFallback(..., { key, ttlSeconds })`,
  with `key` from `cacheKey(widgetId, settings)` so two instances of one widget with
  different settings never collide. It wraps only the `live()` call. **Failures are never
  cached** — a transient 500 must not pin a widget to sample data for a whole TTL. Current
  TTLs: weather 600s, rss 300s, github 120s, stripe/gcal/gmail 60s, system uncached.
- A bad *setting* (as opposed to a flaky upstream) should throw out of the handler so the
  API returns `ok:false`, rather than going through `withFallback` and quietly serving
  sample data. `rss.feed`'s `assertPublicFeedUrl()` is the reference example.
- `system` connector is special: each reading (`OverviewData`, `DisksData`, `GpuData`,
  `ProcessesData`) already carries its own `sample: boolean` because failures are
  per-field, not per-call (readOverview() itself never throws). Its handlers call
  `fromSample(data, label)` after `safe()`, not `withFallback()`.
- Outbound HTTP from a connector's live path should go through `debugFetch(label, url,
  init)` (src/lib/fallback.ts) instead of raw `fetch` — it is a transparent passthrough
  that additionally logs one line (method, url, status, ms; **never** headers/body/secrets)
  when `DEBUG_CONNECTORS=1`.
- Mocks are deterministic: `seeded(widgetId + settings + today)`.
- **A new widget must be added to `SETTINGS` in `src/lib/contract.test.ts`**, and a new
  connector needs a fixture under `src/connectors/<id>/__fixtures__/` plus a branch in
  that file's `fixtureFor()`. The contract test fails loudly if you forget — that is
  deliberate, it is what stops mock and live drifting apart.
- Pure parsing helpers are exported purely so the tests can reach them (`parseDf`,
  `parsePs`, `parseNvidiaSmi`, `parseFeed`, `decodeEntities`, `parsePaidCharges`,
  `bucketByDay`, `assertPublicFeedUrl`). Keep them pure and injectable — `bucketByDay`
  takes `now` as a parameter for exactly this reason. Do not make them read the clock,
  the env, or the network directly.
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
reach them. No rate-limit handling (GitHub ETag/conditional requests still to do), no OAuth
refresh, no Stripe cursor pagination. `system.gpu` has never been run against real GPU
hardware of any vendor — the NVIDIA fixture is hand-written and the AMD/Intel sysfs path is
tested against a synthetic directory tree, not a real amdgpu. See PLAN.md.

Phases still open: 1 step 3 (GPU, needs hardware), 2 (Stripe), 3 (GitHub), 4 (Google
OAuth), 5 (credentials UI, optional). Every one of 2–4 begins with a credential only a
human can create. Phases 0, 1 (steps 1–2) and 6 are done.

## Sandbox network limitation (matters for every future agent session)
This container's egress goes through a proxy that allowlists almost nothing: `api.stripe.com`,
`api.open-meteo.com`, `hnrss.org` and `example.com` all fail, and `api.github.com` answers
only for endpoints scoped to this session's own repository (user-scoped paths like
`/users/<u>/events`, which is what the github connector calls, return 403 with an explicit
"sessions are bound to their configured repositories" message). **No connector has a
reachable live-success path here.** Consequences: a `mode:"stale"` result in this sandbox is
expected and is not evidence of a connector bug, and any acceptance test that needs a
*successful* upstream response (cache-hit counting, field-mapping checks) cannot be run
end-to-end and must either be verified at the logic level or deferred to a machine with
real egress. Say which one you did — do not let a logic-level check pass as an end-to-end one.

## Next.js version (was a flagged security issue — RESOLVED 2026-08-26)
The repo ran `next@14.2.15`, which carried **1 critical + 1 high** `npm audit` finding (a
long list of DoS/SSRF/cache-poisoning CVEs, plus a vulnerable `postcss`). Upgraded to
**Next 16.3.3** at the human's instruction; `npm audit` now reports **0 vulnerabilities**.

Two things worth knowing before touching this again:
- **React stayed on 18.3.1.** Next 16's peer range is `^18.2.0 || ^19.0.0`, so the CVE fix
  did not require a React major as well. That was deliberate — it kept the blast radius to
  one framework instead of two. React 19 remains available later as its own decision.
- **`react-grid-layout` stayed on 1.4.4.** A 2.x exists but is a rewrite with a different
  entry-point/type layout; it is not the vulnerable package and 1.4.4 is fine on React 18,
  so it was left alone.

Consequences of Next 16 that are now baked in:
- Route handlers receive `params` as a **Promise** (`src/app/api/widget/[id]/route.ts`
  awaits it). Same for any future dynamic route, and for `cookies()`/`headers()` if ever
  used.
- Next rewrote `tsconfig.json` on first build: `jsx` is now `react-jsx` (was `preserve`)
  and `.next/dev/types/**/*.ts` was added to `include`. It also rewrote `next-env.d.ts` to
  import generated types from `.next/`. Both files say "do not edit" and are Next-managed.
  Verified that `npx tsc --noEmit` and `npm test` are both still clean on a checkout with
  **no** `.next/` present, so a fresh clone is not broken by this.
- `next lint` no longer exists in 16 (it now parses `lint` as a directory name). The
  `lint` npm script was removed rather than replaced — it had never worked in this repo
  anyway, it only ever dropped into ESLint's interactive setup prompt, and there is still
  no ESLint config here. Adding one is a separate decision, not part of a security fix.
- The build now runs on Turbopack by default.

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

### 2026-08-26 (second session) — Phase 1 steps 1–2 (caching + RSS SSRF guard)
Continued directly from the Phase 0 session above, same branch. Phase 1 step 3 (real GPU
verification) is blocked on hardware and is the only thing left in the phase.

**Step 1 — caching.** New `src/lib/cache.ts`: a module-level `Map` of
`{value, expiresAt}`, with `cacheKey(widgetId, settings)` /  `cacheGet` / `cacheSet`.
Module state, so it survives across requests in the one process and resets on restart —
right for a single-process, no-DB dashboard.

Rather than a separate wrapper, caching became an optional 5th argument on the existing
`withFallback(hasCreds, live, mock, label, cache?)`, so every call site keeps one helper and
the cache can only ever wrap the `live()` call. Two decisions worth keeping:
- A cache hit returns `mode:'live'`, not a new mode. It *is* real data; it just wasn't
  re-fetched this call. Inventing a 'cached' mode would have put a pill in front of the
  user for something they don't need to act on.
- **Failures are never cached.** Caching an error would pin a widget to sample data for the
  full TTL after one transient 500; instead the next call retries live.

TTLs applied per PLAN.md: weather 600s, rss 300s, github 120s, stripe/gcal/gmail 60s,
system uncached (it reads local state; caching it would just make the CPU graph lie).

**Step 2 — RSS SSRF guard.** `assertPublicFeedUrl()` in `src/connectors/rss/server.ts`
rejects non-http(s) schemes, IP literals in private ranges, and hostnames that *resolve*
into private ranges (0/8, 127/8, 10/8, 172.16/12, 192.168/16, 169.254/16, ::1, ::,
IPv4-mapped IPv6). `net.isIP` + `dns.lookup({all:true})`; anything unparseable is treated
as unsafe rather than allowed.

Deliberately called in the handler *before* `withFallback`, not inside it. A blocked url is
a bad setting, not a flaky upstream — it must surface as a real `ok:false` error the user
can fix, and PLAN.md's acceptance criterion says "error state, not data". Routing it
through `withFallback` would have served sample headlines for a blocked url, which is
exactly the silent-substitution behaviour Phase 0 existed to remove. This is now written up
as a general convention in "Conventions" above.

Known limitation, also noted in a code comment: the DNS check does not pin the resolved
address for the subsequent `fetch`, so this does not defend against DNS rebinding. Beyond
what the step asked for; flagging it rather than implying the guard is airtight.

Verification performed:
1. `npx tsc --noEmit` and `npm run build` — both clean.
2. SSRF guard, end-to-end over HTTP against a running server. All five return `ok:false`
   with a specific reason and no feed data: `file:///etc/passwd` ("Unsupported feed
   protocol"), `http://169.254.169.254/` (cloud metadata, "Feed host is a private
   address"), `http://localhost:3000/` (caught via DNS: "resolves to a private address
   (127.0.0.1)"), `http://127.0.0.1/feed`, `http://10.0.0.1/feed`.
3. Caching — **verified at the logic level, not end-to-end.** PLAN.md's test ("hammer
   weather.current 10× and count 1 upstream request") cannot run in this sandbox: every
   upstream is unreachable (see "Sandbox network limitation" above), and since failures are
   deliberately not cached, 10 calls correctly produced 10 upstream attempts — the right
   behaviour, but not a test of the cache. Instead ran a throwaway harness (scratchpad, not
   committed) that transpiles and imports the *real* `cache.ts` and `fallback.ts` and
   stubs only `live()`. 11 assertions, all passing: 10 calls → exactly 1 upstream call, all
   10 reporting `mode:'live'` with identical payloads; a different settings key gets its
   own entry; TTL expiry re-fetches; a failure is not cached and the next call retries and
   succeeds; `hasCreds:false` returns mock without calling live or touching the cache.
   **The HTTP-level version of this test still needs running on a machine with real
   egress** — flagged on the checkbox in PLAN.md too.
4. Re-ran all 16 widget endpoints: identical to the Phase 0 results, no regression. The
   default `rss.feed` url passes the new guard and reaches the network (its 403 is the
   sandbox proxy, not the guard).
5. Playwright full-page screenshot: renders correctly, zero console/page errors.

Next session: Phase 1 is finished except the GPU check, which needs the human's machine.
Phases 2–4 all start with a credential only a human can create. **Phase 6 (vitest test
suite) needs no credentials and no network** — it is the obvious next agent-doable phase,
and the throwaway cache harness written this session is a decent starting point for the
`fallback.ts`/`cache.ts` unit tests.

### 2026-08-26 (third session) — Phase 6 (test suite)
Picked Phase 6 because it was the only remaining phase needing neither credentials nor
network. Same branch.

**Runner.** `vitest` as a dev dependency. Deliberately took `vitest@4` rather than the v2
that matched the era of the rest of the deps: v2 pulls a vulnerable `esbuild`/`vite` chain
and would have added 5 advisories to a repo whose only outstanding ones are the two Next
ones already flagged. With v4 `npm audit` still reports exactly those two and nothing new.

`vitest.config.mts` (`.mts`, not `.ts`, so vite loads it as ESM without warning) does two
non-obvious things: aliases `server-only` to the package's own `empty.js` (it throws by
design outside a React Server Component, and the tests import those modules deliberately),
and enables the JSX transform via `oxc.jsx` — the project tsconfig sets `jsx:"preserve"`
for Next, which vite cannot parse, and `contract.test.ts` imports `registry.client.ts`
which pulls in every `widgets.tsx`. Note vite 7 uses oxc, so the older `esbuild: { jsx }`
option is silently ignored — it must be `oxc: { jsx: { runtime: 'automatic' } }`.

**Step 1 — unit tests.** 29 for the RSS parser (RSS 2.0 / RDF / Atom / CDATA / named,
decimal and hex entities / astral-plane codepoints / out-of-range refs / junk input /
truncation), 33 for the system parsers, 21 for Stripe, 25 for cache+fallback.

Several helpers had to be exported to be reachable: `parseDf`, `parsePs`,
`parseNvidiaSmi`, `parsePaidCharges`, `assertPublicFeedUrl`. The Stripe day-bucketing was
inline in `liveRevenue`, so it was extracted to a pure `bucketByDay(charges, days, now)`
— `now` is a parameter specifically so the tests are not tied to the wall clock, which is
what makes the month-boundary and leap-day cases possible.

**A real bug fell out of writing these.** `assertPublicFeedUrl` (the Phase 1 SSRF guard)
did not block `http://[::1]/feed`: `URL.hostname` keeps the brackets on an IPv6 literal,
`net.isIP('[::1]')` returns 0, so it skipped the literal check and fell through to the DNS
branch. It happened to still fail here with ENOTFOUND, which is why the manual Phase 1
check passed — but on a host that resolves it, an IPv6 loopback would have been fetched.
Fixed by stripping the brackets before `net.isIP`. This is the case for automated tests
over one-off manual curls: the manual check and the test agreed on the outcome and
disagreed on the reason.

**Step 2 — contract tests.** `src/lib/contract.test.ts` runs every one of the 16 widget
ids twice: once with no credentials (mock path, with `fetch` replaced by something that
throws, so a stray request is loud) and once with credentials set and `fetch` served from
local fixtures. Both results are reduced to a recursive *key* shape — values and types
discarded, arrays collapsed to their first element — and compared. Keys, not types, is
what PLAN.md asks for and is also what is right: `description: string | null` legitimately
differs per side.

Two things that keep it from passing vacuously, both of which I checked: the live path must
report `mode:'live'` (a fixture that failed to parse would fall back to the mock and make
the comparison self-satisfying), and settings are chosen so both sides return non-empty
collections. I verified the test actually bites by injecting an extra key into gcal's live
path — `gcal.agenda` and `gcal.next` both failed, then passed again on revert.

The rss contract case uses `http://203.0.113.10/frontpage` — an IP literal from TEST-NET-3
rather than a hostname, because the SSRF guard resolves hostnames via DNS and this suite
must run with no network at all. An IP literal takes the guard's literal branch.

**Step 3 — e2e.** `e2e/flow.spec.ts` + `playwright.config.ts`, run by `npm run test:e2e`,
excluded from `npm test` (it needs a build and a browser). Six tests: the full
add → configure → drag → persist → reload → remove flow, plus a console-error guard, a
no-error-state check, a settings round-trip, and regression guards for both bugs found by
hand earlier (widget body overflowing its card; RGL swallowing header buttons — the test
clicks the gear inside `.widget-actions`, so a regression in `draggableCancel` fails it).

Pinned `@playwright/test` to 1.56.1 to match the browser build preinstalled in this image;
the latest wanted a build that is not present and cannot be downloaded here.

Two bugs in my own first draft of this spec, both worth recording because they are the
kind that make a suite look green while testing nothing:
- Waiting on `.skeleton` count 0 as "loaded" is wrong — the grid is `ssr:false`, so before
  it mounts there are zero widgets *and* zero skeletons, and the assertion passed instantly
  against an empty page, measuring 0 widgets. Now `waitForDashboard()` waits for the
  widgets to exist *first*, then for skeletons to clear.
- The drag step asserted nothing had to move. A newly added widget is placed at the bottom
  (`addWidget` uses `maxY`), so dragging it further down is a no-op. It now drags upward
  and asserts the persisted `y` actually decreased.

Also learned from the app while writing it: `addWidget` calls `setEditing(true)`, so the
toolbar is already in edit mode after adding — the test asserts that rather than clicking
"Arrange" again.

Verification performed:
1. `npx tsc --noEmit` — clean. `npm run build` — clean.
2. `npm test` — 180 tests, 5 files, green.
3. **The no-network claim actually verified, not assumed**: `unshare -rn npm test` (a
   network namespace with no interfaces and no DNS) — all 180 still pass.
4. `npm run test:e2e` — 6 Playwright tests green against a real production build.
5. Mutation-checked the contract test (injected key → 2 failures → reverted → green).

Next session: nothing left that an agent can do unattended. Phase 1 step 3 needs an NVIDIA
machine; Phases 2, 3 and 4 each begin with a credential a human must create (Stripe
restricted key / GitHub fine-grained PAT / Google OAuth client). Phase 5 is optional and
only worth doing if editing `.env.local` proves annoying. The honest next move is to hand
back to the human for credentials — or, if something agent-doable is wanted, the Next.js
14 → 16 upgrade flagged above is real work, but it is breaking and should be a deliberate
decision rather than something a scheduled session starts on its own.

### 2026-08-26 (fourth session) — Next.js 14 → 16 security upgrade
The human answered the standing question from the Phase 0 session ("fix it"), so the
Next.js major upgrade was taken as its own piece of work. This is the change the Phase 6
test suite existed to make safe, and it is worth recording that it paid for itself
immediately: the upgrade was verifiable in minutes rather than by hand-clicking the UI.

**Scope kept deliberately narrow.** Only `next` moved (14.2.15 → 16.3.3). React stayed at
18.3.1 because Next 16's peer range is `^18.2.0 || ^19.0.0` — the CVEs are in Next, not
React, so pulling React 19 in at the same time would have doubled the blast radius for no
security benefit. `react-grid-layout` stayed at 1.4.4 for the same reason (a 2.x exists,
but it is a rewrite, and 1.4.4 is not the vulnerable package and works on React 18).
`npm audit`: 2 vulnerabilities (1 critical, 1 high) → **0**.

**Breaking changes hit, and how they were handled:**
1. `params` in route handlers is a Promise in Next 15+. `src/app/api/widget/[id]/route.ts`
   now awaits it. This was the only dynamic route in the repo, and the only source change
   the whole upgrade required — the typecheck found it, nothing was discovered at runtime.
2. Next rewrote `tsconfig.json` on first build (`jsx: "preserve"` → `"react-jsx"`, plus
   `.next/dev/types/**/*.ts` in `include`) and rewrote `next-env.d.ts` to import generated
   types out of `.next/`. Both are Next-managed "do not edit" files, so the rewrites were
   accepted rather than reverted. Because `.next/` is gitignored, I explicitly checked the
   fresh-clone case — moved `.next/` away and re-ran `npx tsc --noEmit` and `npm test`,
   both clean — so a new checkout is not broken before its first build.
3. `next lint` is gone in 16 (it now parses `lint` as a directory argument and errors).
   The `lint` script was **removed, not replaced**. It had never worked in this repo — it
   only ever dropped into ESLint's interactive setup prompt, which is why it was killed
   rather than run back in the Phase 0 session — and there is still no ESLint config.
   Adding one is a real decision, not something to smuggle into a security fix.
4. Builds now use Turbopack by default. No config change needed.

`vitest.config.mts`'s JSX comment was updated: it used to say "tsconfig sets preserve",
which Next has now changed. The explicit `oxc.jsx` setting is kept precisely so the test
transform does not depend on whatever Next decides that field should be next.

Verification (this is the part the test suite made cheap):
1. `npx tsc --noEmit` clean; `npm run build` clean on Turbopack.
2. `npm test` — 180 tests green, and green again inside `unshare -rn` (no interfaces, no
   DNS), so the no-network property survived the upgrade.
3. `npm run test:e2e` — all 6 Playwright tests green against a real Next 16 production
   build, including the drag → persist → reload path, which is the one most likely to
   break on a framework major and the one least likely to be caught by unit tests.
4. Ran the server and re-curled **all 16 widget endpoints**: byte-for-byte the same
   modes and warnings as before the upgrade. Re-checked all four SSRF vectors (still
   `ok:false` with specific reasons) and confirmed failures are still not cached (5 calls
   to a failing upstream produced 5 attempts, as designed).
5. Confirmed `npm run dev` serves too — a different code path from `next start`, and the
   one a human will actually use day to day.
6. Full-page screenshot: visually identical to the Next 14 build, zero console errors.

Nothing about the connector work (Phases 0/1) regressed. Still open and still needing a
human: Phase 1 step 3 (NVIDIA hardware), Phases 2–4 (credentials). React 19 is now
available as a separate, optional upgrade — it is no longer coupled to a security fix.

### 2026-08-26 (fifth session) — system.gpu rewritten for AMD; a wrong premise corrected
The human said: "i don't have nvidia hardware on this device, i'm on a lenovo yoga with
amd." That single sentence invalidated a plan item and exposed a real bug.

**The wrong premise.** PLAN.md Phase 1 step 3 described the target machine as
"Ryzen 5 / RTX 3070" and asked only that `nvidia-smi` parsing be verified against real
output. There is no RTX 3070 and no NVIDIA hardware anywhere in this project. Every
previous session had faithfully treated that line as fact and recorded step 3 as "blocked
on hardware" — when the correct response was that the step was aimed at the wrong target.
Worth remembering: a plan written by someone else can be wrong about the world, and
"blocked" is sometimes a sign the premise needs checking rather than that the work needs
waiting.

**The bug it was hiding.** `readGpu()` only ever ran `nvidia-smi`. On a machine without
it, that threw, `safe()` fell back to `mockGpu()`, and the widget rendered
**"NVIDIA GeForce RTX 3070"** with invented VRAM, temperature and wattage. The amber
"stale" pill was shown, so the *mode* was honest, but the *content* asserted a specific
false fact about the user's hardware. Phase 0 made failure visible; this was a case where
visible-but-wrong content slipped through anyway, because the mock was written for a
machine nobody has.

**What was built.** `system.gpu` is now vendor-aware:
1. `nvidia-smi` if it exists and reports cards (unchanged path, still tested).
2. Otherwise DRM sysfs — `/sys/class/drm/cardN/device/` — where the kernel publishes
   `gpu_busy_percent`, `mem_info_vram_used`/`_total`, and under `hwmon/hwmonN/`
   `temp1_input` (millidegrees), `power1_average` or `power1_input` (microwatts), and
   `pwm1`/`pwm1_max` (fan duty 0-255). This is the path that works on the Yoga.
3. Three-way outcome instead of two, which is the important part:
   - cards found → real data, `sample:false`, `mode:"live"`;
   - **sysfs readable but no usable GPU → empty list, `sample:false`** → the widget's
     existing "No GPU detected" empty state finally fires, instead of inventing a card;
   - **sysfs absent entirely (Windows/macOS) → throw → sample**, because there we
     genuinely cannot tell, and "no GPU" would be a different lie.

Also: the mock is renamed to a neutral "Sample GPU" (it no longer claims a real product),
the widget's empty state is no longer NVIDIA-specific, and the widget description says
which vendors it reads.

New code is split so it is testable without hardware: `parseDrmCard(files)` is pure
(sysfs contents → `GpuItem | null`), and `readDrmGpus(root)` takes its root as a parameter
so tests can point it at a fake tree.

**A second bug, found by my own test while writing it:** `sysfsNumber` used
`Number(raw.trim())`, and `Number('')` is `0`, not `NaN`. An empty or whitespace-only
sysfs file — which does occur — would have been reported as a real reading of **0 W** or
**0 °C** rather than "unknown". Now returns null for empty input.

Verification:
1. 18 new unit tests (198 total, up from 180). `parseDrmCard` covers a discrete AMD card
   (all units converted: millidegrees→C, microwatts→W, pwm/pwm_max→%), an AMD APU with no
   fan and no power sensor (must be `null`, never 0), Intel iGPU with no VRAM figure,
   VRAM-but-no-utilisation, display-only nodes rejected, clamping, div-by-zero on
   `pwm1_max=0`, unparseable contents, unknown vendor.
2. `readDrmGpus` tested against a **fake sysfs tree built in a temp dir** — this covers
   what the pure parser cannot: finding `cardN` while skipping `card0-eDP-1` connector
   nodes, locating `hwmonN`, `power1_input` fallback, multi-GPU, and the crucial
   `[]` vs `null` distinction.
3. End-to-end against a simulated AMD APU tree (temporarily repointed `DRM_ROOT`, then
   reverted): `mode:"live"`, `sample:false`, `"AMD Radeon (amdgpu)"`, VRAM 768/2048 MiB,
   54 °C, `null` power and fan. Screenshotted the widget: no stale pill, no sample footer,
   Power renders as "—" rather than a fake 0 W.
4. Also confirmed the empty case end-to-end: a `simpledrm`-only tree yields `gpus: []`,
   `sample:false` → "No GPU detected".
5. `npx tsc --noEmit`, `npm run build`, `npm test` (198, and green inside `unshare -rn`),
   `npm run test:e2e` (6) all clean.

**Still honestly unverified:** no real GPU of any vendor has ever been read. The AMD path
is proven against a synthetic tree that I built from the kernel's documented sysfs layout.
Running it on the actual Yoga and comparing against `radeontop`/`amdgpu_top` is a five
minute job and is the one thing that would close this properly. PLAN.md step 3 is checked
because the work it should have asked for is done, with that caveat recorded inline.

Open and needing a human: Phases 2–4 (credentials). Nothing else is agent-blocked.
