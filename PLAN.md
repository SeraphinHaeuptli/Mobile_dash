# PLAN.md — implementing the connectors for real

**This file is written for AI (agent) use, not humans.** It is the standing task list a
scheduled/autonomous session works through one phase at a time. Conventions for using it:
- Check the boxes below (`[ ]` -> `[x]`) as steps are actually completed and verified —
  not planned, not attempted, *verified* per that step's own `→ verify` line.
- Work phases in order; a phase blocks the ones after it unless its notes say otherwise.
- When you finish a checkable unit of work, log what you did (and any deviation from the
  plan, and why) in PROJECT.md's Session log before ending the session. PROJECT.md is the
  narrative history; this file is only the current checklist state.
- If a step turns out to need a human (a real API key, a browser-based OAuth consent
  screen, a decision only they can make), leave its box unchecked, say so plainly in the
  PROJECT.md session log, and move on to whatever else in the plan doesn't need them —
  don't block the whole session on one step.

Goal: move every connector from "live code written, never exercised" to "verified against
the real API, with correct auth, caching, and honest error states".
Read PROJECT.md first for the contract and file map.

Ordering is deliberate: Phase 0 is a prerequisite for honestly testing anything else,
then connectors go easiest-credential-first so each phase ends with something working.

---

## Phase 0 — make failure visible (blocking, ~1h) — DONE 2026-08-26

Today every live call silently falls back to mock on error. While implementing real
connectors this hides exactly the failures you need to see (401, 403, rate limit, bad
field mapping). Fix before touching any API.

- [x] 1. `src/lib/types.ts`: widen mode to `'mock' | 'live' | 'stale'` and add
   `warning?: string` to `WidgetResponse`.
   → verify: `npx tsc --noEmit` fails only where the new state must be handled.
- [x] 2. Connector handlers: on a live failure return the mock **plus** the reason.
   Introduce one shared helper `withFallback(live, mock, label)` in `src/lib/fallback.ts`
   and use it everywhere — the seven copies of this try/catch are the only duplicated
   logic in the repo.
   → verify: grep shows no bare `catch { return mock }` left in `src/connectors`.
- [x] 3. `WidgetShell.tsx`: `stale` renders the data plus an amber header pill whose
   tooltip is the reason. `mock` keeps the neutral "sample" pill.
   → verify: temporarily set `STRIPE_SECRET_KEY=sk_test_bogus`; stripe widgets show an
   amber pill saying 401 (or whatever the failure actually is), not a silent "sample".
- [x] 4. Add `DEBUG_CONNECTORS=1` env: when set, log every outbound request (method, url,
   status, ms) to the server console, never the key.
   → verify: one line per widget fetch, secrets absent from output.

Implementation notes for future sessions: the actual shared helper ended up being
`withFallback(hasCreds, live, mock, label)` — it takes the "do we even have credentials"
boolean explicitly rather than reading `isLive()` itself, so callers pass `hasEnv(ENV)` (or
`true` for keyless connectors) at the call site. The `system` connector doesn't use
`withFallback` at all — its `OverviewData`/`DisksData`/`GpuData`/`ProcessesData` already
carry a per-field `sample: boolean` because failures there are per-reading, not per-call —
it uses a second helper, `fromSample(data, label)`, also in `src/lib/fallback.ts`. Full
detail and verification transcript: PROJECT.md session log, entry "2026-08-26 — Phase 0
implemented".

---

## Phase 1 — keyless connectors first (~1h) — DONE 2026-08-26

Weather, RSS and System already run live; harden them.

- [x] 1. **Caching.** Add `src/lib/cache.ts`: in-memory TTL map keyed by
   `widgetId + JSON.stringify(settings)`. Wrap live calls. TTLs: weather 600s, rss 300s,
   github 120s, stripe 60s, gcal/gmail 60s; system not cached.
   → verify: hammer `/api/widget/weather.current` 10× and count 1 upstream request in
   DEBUG_CONNECTORS output.
   → **verified at the logic level, not over HTTP** — see the note below: no connector has
   a reachable upstream from this sandbox, and failures are deliberately not cached, so
   the "10 calls, 1 upstream request" test cannot be run end-to-end here. It was run
   against the real `cache.ts` + `fallback.ts` modules with a stubbed `live()` instead
   (11 assertions, all passing). Re-run the HTTP version on a machine with real egress.
- [x] 2. **RSS SSRF guard.** The feed URL is user input. Reject non-http(s) schemes, and
   reject hosts resolving to private ranges (127/8, 10/8, 172.16/12, 192.168/16,
   169.254/16, ::1).
   → verify: `url=file:///etc/passwd` and `url=http://169.254.169.254/` both return an
   error state, not data.
   → verified end-to-end over HTTP: both, plus `http://localhost:3000/`,
   `http://127.0.0.1/feed` and `http://10.0.0.1/feed`, return `ok:false` with a specific
   reason and no feed data.
- [x] 3. **System GPU.** ~~Only path needing the target machine (Ryzen 5 / RTX 3070). Run
   `system.gpu` there, confirm `nvidia-smi` parsing against real output, multi-GPU safe.~~
   **The premise was wrong.** The target machine is a Lenovo Yoga with **AMD** graphics —
   there is no RTX 3070 and no NVIDIA hardware anywhere in this project. `nvidia-smi` does
   not exist on that machine, so the old code threw and fell back to a sample that named a
   specific NVIDIA card: the dashboard displayed hardware the owner does not have.

   Rewritten rather than merely verified. `system.gpu` is now vendor-aware: NVIDIA via
   `nvidia-smi` if present, otherwise AMD/Intel via DRM sysfs
   (`/sys/class/drm/cardN/device/`), which is where the kernel actually publishes
   utilisation, VRAM, temperature, power and fan duty. It also now distinguishes
   **"no GPU"** (sysfs readable, nothing found → empty list, `sample:false`, widget says
   "No GPU detected") from **"cannot tell"** (no sysfs at all — Windows/macOS → sample).
   The sample no longer names a real product.
   → verified: `parseDrmCard` + `readDrmGpus` unit-tested (18 cases incl. a fixture-built
   fake sysfs tree covering an AMD APU, a discrete card with a fan, dual-GPU, display-only
   and unreadable-sysfs), and end-to-end against a simulated AMD tree: `mode:"live"`,
   `"AMD Radeon (amdgpu)"`, real VRAM/temp, `null` (rendered "—") for the power and fan an
   APU does not expose.
   → **still worth doing on the real machine when convenient:** run the dashboard on the
   Yoga and confirm the numbers match `radeontop`/`amdgpu_top`. The read path is proven
   against a synthetic tree, not against real amdgpu output.

Implementation notes for future sessions: caching is not a separate wrapper — it is an
optional 5th argument on `withFallback(hasCreds, live, mock, label, cache?)`, where `cache`
is `{ key, ttlSeconds }` and `key` comes from `cacheKey(widgetId, settings)`. It wraps only
the `live()` call. Two deliberate choices: a cache hit returns `mode:'live'` (it is real
data, merely not re-fetched), and **failures are never cached**, so a transient 500 does
not pin a widget to sample data for the whole TTL — the next call retries. The `system`
connector is uncached per the plan and uses `fromSample()`, which takes no cache argument.
The RSS guard lives in `assertPublicFeedUrl()` in `src/connectors/rss/server.ts` and is
called in the handler *before* `withFallback`, deliberately outside it: a blocked url is a
bad setting, not an upstream hiccup, so it must surface as a real `ok:false` error rather
than quietly serving sample headlines. Known limitation, documented in the code: the DNS
check does not pin the resolved address for the subsequent fetch, so it does not defend
against DNS rebinding — out of scope for what this step asked for.

---

## Phase 2 — Stripe (~1–2h)

Single static secret key, so it is the cheapest real-auth test.

- [ ] 1. Create a **restricted** key in the Stripe dashboard, read-only on Balance +
   Charges. Put it in `.env.local`. Never a live-mode full secret key.
   (Needs a human with Stripe dashboard access — cannot be done by an agent.)
- [ ] 2. Verify field mapping against a real response for `/v1/balance` and `/v1/charges`:
   `amount` is minor units; `currency` is lowercase; `available[]`/`pending[]` are arrays
   **per currency** — confirm the currency setting selects, not sums.
   → verify: numbers in the widget equal the Stripe dashboard for the same period.
- [ ] 3. `stripe.revenue`: current code sums up to 100 charges. Implement cursor
   pagination (`starting_after`) with a hard cap (say 1000) and log when the cap truncates.
   → verify: an account with >100 charges in the window reports the same gross volume as
   Stripe's own report.
- [ ] 4. Decide refunds/disputes: gross volume should probably subtract refunds. Pick one,
   document it in the widget description.

## Phase 3 — GitHub (~1–2h)

- [ ] 1. Fine-grained PAT, read-only, no repo write scopes. `.env.local`.
   (Needs a human with GitHub account access.)
- [ ] 2. Verify `/users/<u>/events` mapping for each type handled (PushEvent commit count,
   PullRequestEvent merged vs opened, IssuesEvent, WatchEvent, ForkEvent, ReleaseEvent).
   Events API only returns ~90 days / 300 events and is cached ~60s server-side by GitHub.
- [ ] 3. `github.contributions` uses the GraphQL API — confirm the PAT type actually has
   GraphQL access (fine-grained tokens historically did not for all queries; fall back to
   REST-derived counts or state the limitation).
- [ ] 4. Add conditional requests: store `ETag` per endpoint, send `If-None-Match`, treat
   304 as a cache hit. Surface `x-ratelimit-remaining` in the DEBUG log.
   → verify: repeated loads consume no rate-limit budget.

## Phase 4 — Google OAuth: Calendar + Gmail (~3–4h, the real work)

Current code takes a static `GOOGLE_CALENDAR_TOKEN` / `GMAIL_TOKEN` bearer. Google access
tokens expire in ~1h, so this is unusable in practice. Replace with a proper flow.

- [ ] 1. Google Cloud project → OAuth client (Desktop or Web). Scopes:
   `calendar.readonly`, `gmail.readonly`. New env:
   `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`.
   (Needs a human with Google Cloud console access.)
- [ ] 2. Add routes `src/app/api/auth/google/route.ts` (redirect to consent,
   `access_type=offline`, `prompt=consent`) and `.../callback/route.ts` (exchange code →
   refresh token). Store the refresh token in `data/credentials.json`, mode 0600, gitignored.
- [ ] 3. `src/lib/google.ts`: `getAccessToken()` — reads the refresh token, exchanges it,
   caches the access token in memory until `expires_in - 60s`. Both connectors call only
   this.
- [ ] 4. Replace `envKeys` for gcal/gmail with a credential check against the stored file
   so `isLive()` and the connectors panel stay accurate; add a "Connect Google" button in
   DashboardSettings that links to `/api/auth/google`.
- [ ] 5. Gmail: current code does N+1 requests (list + per-message metadata). Use
   `format=metadata&metadataHeaders=From&metadataHeaders=Subject` and batch, or accept the
   cost with the Phase 1 cache. Unread count comes from `labels/UNREAD.messagesUnread`.
   → verify: unread number matches the Gmail UI.
- [ ] 6. Calendar: confirm `singleEvents=true&orderBy=startTime`, all-day events use
   `start.date` not `start.dateTime`, and timezones render in local time.
   → verify: agenda matches Google Calendar for the next 3 days, including an all-day
   event.
- [ ] 7. → verify the whole phase: leave the dashboard open for >1h; widgets keep working
   after the first access token expires.

## Phase 5 — credentials in the UI (optional, ~2h)

Only if editing `.env.local` proves annoying. Move all secrets into
`data/credentials.json` (0600, gitignored) written by a Connectors tab in settings;
`.env.local` stays as an override that wins. Never send stored secrets back to the
browser — return `configured: true` and a masked suffix only.

- [ ] 1. Connectors tab in DashboardSettings: form per connector, writes
   `data/credentials.json`.
- [ ] 2. `hasEnv`/credential-check call sites read the stored file as a fallback under
   `.env.local`.
- [ ] 3. GET never returns raw secret values, only `configured` + masked suffix.

## Phase 6 — tests (~2h) — DONE 2026-08-26

No test runner yet. Add `vitest` (dev dep only).

- [x] 1. Unit: RSS parser (RSS 2.0, RDF, Atom, CDATA, entities, malformed input);
  `df`/`ps`/`nvidia-smi` parsers against captured fixture output; Stripe day-bucketing.
  → `src/connectors/{rss,system,stripe}/server.test.ts` (+ `src/lib/fallback.test.ts`
  for cache/fallback, promoted from Phase 1's throwaway harness).
- [x] 2. Contract: for every widget id, assert mock and live parse paths produce the same
  keys — a fixture per connector under `src/connectors/<id>/__fixtures__/`.
  → `src/lib/contract.test.ts`, driving all 16 widget ids through both paths.
- [x] 3. Smoke: keep the existing Playwright flow (add → configure → drag → persist →
  reload → remove) as `e2e/flow.spec.ts`.

→ verify: `npm test` green with no network access, since every fixture is local.
  → **verified**: 180 tests pass inside `unshare -rn` (a network namespace with no
  interfaces and no DNS), not merely on a machine that happened not to need the network.
  `npm run test:e2e` (6 Playwright tests) passes separately; it needs a built app and a
  browser, so it is deliberately not part of `npm test`.

**Caveat that keeps Phase 1 step 3 open:** `__fixtures__/nvidia-smi.txt` is hand-written
from the documented `--format=csv,noheader,nounits` shape, NOT captured from a real GPU
(there is none in this container). The parser is tested against the documented format;
it is still unverified against real hardware. `df-kP.txt` and `ps-comm.txt` *are* real
captures. See `src/connectors/system/__fixtures__/README.md`.

---

## Definition of done

- Every connector fetched real data at least once, with a screenshot or logged response.
- No silent mock substitution: a broken connector says why, in the UI.
- Tokens refresh without manual intervention; nothing secret is git-tracked or sent to
  the browser.
- `npx tsc --noEmit`, `npm run build` and `npm test` all clean.

## Explicitly out of scope

Multi-user, hosted deployment, write actions against any service (send mail, create
events, charge cards). This dashboard reads. Keep it read-only.

## Standing caution for whoever (human or agent) picks this up next

- This sandbox's outbound network goes through a proxy that does **not** allowlist
  `api.stripe.com`, `api.open-meteo.com`, `hnrss.org`, etc. — every "live" attempt from an
  agent session in this environment will fail with a proxy 403, which is expected and is
  not evidence of a bug in the connector code. Phase 0's honest-failure behavior
  (`mode:"stale"` + `warning`) is what makes it possible to tell that apart from a real
  API-side failure at all. Phases 2–4's actual correctness verification against real APIs
  needs to happen either on the human's own machine, or in a session with real egress.
- Never commit a real secret. `.env.local` is gitignored; keep it that way. If a
  `data/credentials.json` shows up (Phase 4/5), it must be too.
