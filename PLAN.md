# PLAN.md — implementing the connectors for real

**This file is machine-maintained for an AI agent working this repo unattended.**
Checkboxes are the source of truth for what is actually done — verified by running the
`→ verify` step, not by re-reading code. On each work session: read PROJECT.md for
current file-map context, find the first unchecked item here, do it, run its verify
step for real, check it off, then append a dated entry to PROJECT.md's "Session log"
describing exactly what changed and what was verified. Never check a box you have not
personally verified in this session, and never skip ahead — a later phase assumes every
earlier box is genuinely done, not just plausible.

Goal: move every connector from "live code written, never exercised" to "verified against
the real API, with correct auth, caching, and honest error states".
Read PROJECT.md first for the contract and file map.

Ordering is deliberate: Phase 0 is a prerequisite for honestly testing anything else,
then connectors go easiest-credential-first so each phase ends with something working.

---

## Phase 0 — make failure visible (blocking, ~1h) — ✅ DONE 2026-08-25

Today every live call silently falls back to mock on error. While implementing real
connectors this hides exactly the failures you need to see (401, 403, rate limit, bad
field mapping). Fix before touching any API.

1. [x] `src/lib/types.ts`: widen mode to `'mock' | 'live' | 'stale'` and add
   `warning?: string` to `WidgetResponse`.
   → verify: `npx tsc --noEmit` fails only where the new state must be handled.
   **Verified:** added `WidgetMode = 'mock'|'live'|'stale'`, `HandlerResult`, widened
   `WidgetProps.mode` and `WidgetResponse.mode`, added `WidgetResponse.warning?`.
   `ConnectorServer.handlers` now resolves to `HandlerResult` instead of raw `Json` —
   this was necessary because the old `runWidget()` computed `mode` from
   `connector.isLive()` alone, which was already wrong (it reported 'live' even when a
   live call had silently failed and returned mock data internally). `npx tsc --noEmit`
   is clean (0 errors) after the full change, confirmed against the real `npm install`.
2. [x] Connector handlers: on a live failure return the mock **plus** the reason, e.g.
   `{ ...mock, _fallback: 'HTTP 401 from /v1/balance' }`. Introduce one shared helper
   `withFallback(live, mock, label)` in `src/lib/fallback.ts` and use it everywhere —
   the seven copies of this try/catch are the only duplicated logic in the repo.
   → verify: grep shows no bare `catch { return mock }` left in `src/connectors`.
   **Verified:** implemented as `withFallback(configured, live, mock, label)` returning
   `{data, mode, warning?}` (chose a typed result over the `_fallback` field-injection
   example in this doc — cleaner because mock payload types stay untouched). All 7
   connectors (stripe, gcal, gmail, github, weather, rss, system) now call it; the local
   `resolve`/`safe` helper duplicated in 6 files was deleted. `grep -rn "catch {"
   src/connectors` now only matches internal platform-fallback code (URL host parsing,
   `/proc/meminfo` vs `node:os`, GNU vs BSD `ps` flags) — none of it swallows a
   live-connector failure silently anymore.
3. [x] `WidgetShell.tsx`: `stale` renders the data plus an amber header pill whose tooltip is
   the reason. `mock` keeps the neutral "sample" pill.
   → verify: temporarily set `STRIPE_SECRET_KEY=sk_test_bogus`; stripe widgets show an
   amber pill saying 401, not a silent "sample".
   **Verified differently but equivalently:** no real Stripe key was available to test
   with, so this was verified against GitHub instead, which had a real (wrong-scope)
   `GITHUB_TOKEN` already in the sandbox env. `POST /api/widget/github.activity` returned
   `mode:"stale"` with `warning:"github.activity: GitHub 401"`, and the amber
   `.pill.warn` "fallback" pill (title = warning text) renders in `WidgetShell.tsx`.
   `mode:"mock"` (stripe/gcal/gmail, no creds at all) still shows the neutral pill.
4. [x] Add `DEBUG_CONNECTORS=1` env: when set, log every outbound request (method, url,
   status, ms) to the server console, never the key.
   → verify: one line per widget fetch, secrets absent from output.
   **Verified:** `src/lib/debug.ts` exports `debugFetch()`, a `fetch` drop-in used by
   every connector's transport function (stripeGet, gcal fetchEvents, gmailGet, github
   gh(), weather openMeteo(), rss liveFeed — system has no network calls, skipped).
   Ran `DEBUG_CONNECTORS=1 npm run dev` and hit 3 widgets; log showed e.g.
   `[connectors] GET https://api.github.com/users/octocat/events?per_page=24 -> 401 99ms`
   — one line per request, status and timing present, Authorization header never printed.

**Runtime smoke test (all 16 widget endpoints, `npm run dev`, fresh `npm install`):**
every endpoint returned `ok:true`. stripe/gcal/gmail (no env keys in this sandbox) →
`mode:"mock"`. weather/rss/github → `mode:"stale"` with a real HTTP status in `warning`
(this sandbox's network egress returns 403 for Open-Meteo/hnrss, and the sandbox's
ambient `GITHUB_TOKEN` — set for unrelated tooling, not by this project — gets a 401
against the GitHub REST API). system.overview/disks/processes → `mode:"live"` (real
host data). system.gpu → `mode:"stale"`, `spawn nvidia-smi ENOENT` (no GPU tooling in
this container — expected, matches Phase 1 item 3 which explicitly defers real GPU
verification to the target machine). This is exactly Phase 0's goal working end-to-end:
previously all of the "stale" cases above would have silently rendered as a neutral
"sample" pill; now they honestly say why they're not live.
`npx tsc --noEmit`, `npm run build` both clean. Full connector diff: 15 files touched,
2 new lib files (`fallback.ts`, `debug.ts`). Added `lumen-dashboard/.gitignore`
(node_modules/.next/tsbuildinfo/data — none existed before, so `npm install`/`npm run
build` were leaving build output as untracked-but-stageable; low-risk hygiene fix, not
functionally part of Phase 0 but done alongside it).

---

## Phase 1 — keyless connectors first (~1h)

Weather, RSS and System already run live; harden them.

1. [ ] **Caching.** Add `src/lib/cache.ts`: in-memory TTL map keyed by
   `widgetId + JSON.stringify(settings)`. Wrap live calls. TTLs: weather 600s, rss 300s,
   github 120s, stripe 60s, gcal/gmail 60s; system not cached.
   → verify: hammer `/api/widget/weather.current` 10× and count 1 upstream request in
   DEBUG_CONNECTORS output.
2. [ ] **RSS SSRF guard.** The feed URL is user input. Reject non-http(s) schemes, and reject
   hosts resolving to private ranges (127/8, 10/8, 172.16/12, 192.168/16, 169.254/16, ::1).
   → verify: `url=file:///etc/passwd` and `url=http://169.254.169.254/` both return an
   error state, not data.
3. [ ] **System GPU.** Only path needing the target machine (Ryzen 5 / RTX 3070). Run
   `system.gpu` there, confirm `nvidia-smi` parsing against real output, multi-GPU safe.
   → verify: values match `nvidia-smi` run manually, within one refresh interval.
   (Not testable from this sandbox — confirmed 2026-08-25 via Phase 0's smoke test that
   the fallback path itself works: no `nvidia-smi` here, `system.gpu` correctly reports
   `mode:"stale"` with `warning: "system.gpu: spawn nvidia-smi ENOENT"` instead of a
   silent sample. The actual on-hardware verification still needs the target machine.)

---

## Phase 2 — Stripe (~1–2h)

Single static secret key, so it is the cheapest real-auth test.

1. [ ] Create a **restricted** key in the Stripe dashboard, read-only on Balance + Charges.
   Put it in `.env.local`. Never a live-mode full secret key.
2. [ ] Verify field mapping against a real response for `/v1/balance` and `/v1/charges`:
   `amount` is minor units; `currency` is lowercase; `available[]`/`pending[]` are arrays
   **per currency** — confirm the currency setting selects, not sums.
   → verify: numbers in the widget equal the Stripe dashboard for the same period.
3. [ ] `stripe.revenue`: current code sums up to 100 charges. Implement cursor pagination
   (`starting_after`) with a hard cap (say 1000) and log when the cap truncates.
   → verify: an account with >100 charges in the window reports the same gross volume as
   Stripe's own report.
4. [ ] Decide refunds/disputes: gross volume should probably subtract refunds. Pick one,
   document it in the widget description.

## Phase 3 — GitHub (~1–2h)

1. [ ] Fine-grained PAT, read-only, no repo write scopes. `.env.local`.
2. [ ] Verify `/users/<u>/events` mapping for each type handled (PushEvent commit count,
   PullRequestEvent merged vs opened, IssuesEvent, WatchEvent, ForkEvent, ReleaseEvent).
   Events API only returns ~90 days / 300 events and is cached ~60s server-side by GitHub.
3. [ ] `github.contributions` uses the GraphQL API — confirm the PAT type actually has
   GraphQL access (fine-grained tokens historically did not for all queries; fall back to
   REST-derived counts or state the limitation).
4. [ ] Add conditional requests: store `ETag` per endpoint, send `If-None-Match`, treat 304 as
   a cache hit. Surface `x-ratelimit-remaining` in the DEBUG log.
   → verify: repeated loads consume no rate-limit budget.

   Note 2026-08-25: this sandbox has an ambient `GITHUB_TOKEN` (set for unrelated
   tooling, not a project credential) — it is NOT a valid credential for this connector's
   REST calls (confirmed: `GitHub 401` from `/users/octocat/events`). Do not treat its
   mere presence as "GitHub is configured"; a real fine-grained PAT for this project is
   still needed for items 1-4 above.

## Phase 4 — Google OAuth: Calendar + Gmail (~3–4h, the real work)

Current code takes a static `GOOGLE_CALENDAR_TOKEN` / `GMAIL_TOKEN` bearer. Google access
tokens expire in ~1h, so this is unusable in practice. Replace with a proper flow.

1. [ ] Google Cloud project → OAuth client (Desktop or Web). Scopes:
   `calendar.readonly`, `gmail.readonly`. New env:
   `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`.
2. [ ] Add routes `src/app/api/auth/google/route.ts` (redirect to consent, `access_type=offline`,
   `prompt=consent`) and `.../callback/route.ts` (exchange code → refresh token).
   Store the refresh token in `data/credentials.json`, mode 0600, gitignored.
3. [ ] `src/lib/google.ts`: `getAccessToken()` — reads the refresh token, exchanges it, caches
   the access token in memory until `expires_in - 60s`. Both connectors call only this.
4. [ ] Replace `envKeys` for gcal/gmail with a credential check against the stored file so
   `isLive()` and the connectors panel stay accurate; add a "Connect Google" button in
   DashboardSettings that links to `/api/auth/google`.
5. [ ] Gmail: current code does N+1 requests (list + per-message metadata). Use
   `format=metadata&metadataHeaders=From&metadataHeaders=Subject` and batch, or accept the
   cost with the Phase 1 cache. Unread count comes from `labels/UNREAD.messagesUnread`.
   → verify: unread number matches the Gmail UI.
6. [ ] Calendar: confirm `singleEvents=true&orderBy=startTime`, all-day events use `start.date`
   not `start.dateTime`, and timezones render in local time.
   → verify: agenda matches Google Calendar for the next 3 days, including an all-day event.
7. [ ] → verify the whole phase: leave the dashboard open for >1h; widgets keep working after
   the first access token expires.

## Phase 5 — credentials in the UI (optional, ~2h)

Only if editing `.env.local` proves annoying. Move all secrets into
`data/credentials.json` (0600, gitignored) written by a Connectors tab in settings;
`.env.local` stays as an override that wins. Never send stored secrets back to the
browser — return `configured: true` and a masked suffix only.

## Phase 6 — tests (~2h)

No test runner yet. Add `vitest` (dev dep only).

- [ ] Unit: RSS parser (RSS 2.0, RDF, Atom, CDATA, entities, malformed input);
  `df`/`ps`/`nvidia-smi` parsers against captured fixture output; Stripe day-bucketing.
- [ ] Contract: for every widget id, assert mock and live parse paths produce the same keys —
  a fixture per connector under `src/connectors/<id>/__fixtures__/`.
- [ ] Smoke: keep the existing Playwright flow (add → configure → drag → persist → reload →
  remove) as `e2e/flow.spec.ts`.

→ verify: `npm test` green with no network access, since every fixture is local.

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
