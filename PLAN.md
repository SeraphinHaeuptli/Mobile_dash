# PLAN.md — implementing the connectors for real

**This file is machine-readable state for an AI agent.** It is a working checklist, not
prose for a human reader — keep entries terse, keep checkboxes accurate, and update the
matching section of PROJECT.md ("Verified" / "Not done" / "Connectors" table) every time
a checkbox here flips. Read PROJECT.md first for the contract and file map.

Goal: move every connector from "live code written, never exercised" to "verified against
the real API, with correct auth, caching, and honest error states".

Ordering is deliberate: Phase 0 is a prerequisite for honestly testing anything else,
then connectors go easiest-credential-first so each phase ends with something working.

---

## Phase 0 — make failure visible (blocking, ~1h) — ✅ DONE (2026-08-26)

Today every live call silently falls back to mock on error. While implementing real
connectors this hides exactly the failures you need to see (401, 403, rate limit, bad
field mapping). Fix before touching any API.

1. [x] `src/lib/types.ts`: widen mode to `'mock' | 'live' | 'stale'` (exported as
   `WidgetMode`) and add `warning?: string` to `WidgetResponse`.
   → verify: `npx tsc --noEmit` fails only where the new state must be handled.
   **Result: clean before this change already had few call sites; all consumers
   (SampleHint components in gcal/gmail/stripe/github widgets.tsx, and mode-equality
   checks in github/weather/rss widgets.tsx) were updated in the same pass, so
   `npx tsc --noEmit` exits 0.**
2. [x] Connector handlers: on a live failure return the mock **plus** the reason, e.g.
   `{ ...mock, _fallback: 'HTTP 401 from /v1/balance' }`. Introduce one shared helper
   `withFallback(live, mock, label)` in `src/lib/fallback.ts` and use it everywhere —
   the seven copies of this try/catch are the only duplicated logic in the repo.
   → verify: grep shows no bare `catch { return mock }` left in `src/connectors`.
   **Result: all 7 connectors (stripe, gcal, gmail, github, weather, rss, system) now
   call `withFallback(isLive, live, mock, label)` from `src/lib/fallback.ts`. The local
   `resolve`/`safe` helpers that used to live in each server.ts are deleted.
   `registry.server.ts::runWidget` strips the hidden `_fallback` key back out and turns
   it into `{ mode: 'stale', warning }`.**
3. [x] `WidgetShell.tsx`: `stale` renders the data plus an amber header pill whose tooltip is
   the reason. `mock` keeps the neutral "sample" pill.
   → verify: temporarily set `STRIPE_SECRET_KEY=sk_test_bogus`; stripe widgets show an
   amber pill saying 401, not a silent "sample".
   **Result: uses the existing `.pill.warn` CSS class (already theme-aware via
   `var(--warn)`, no new CSS needed). Verified live in a browser (Playwright screenshot):
   with a bogus Stripe key, `stripe.balance` returned
   `{"mode":"stale","warning":"Stripe 403 on /balance"}` and rendered an amber "stale"
   pill with that string as the tooltip; gcal/gmail (no env keys set at all) correctly
   stayed on the neutral "sample" pill since `isLive()` is false and the live path is
   never attempted for them. Zero console errors.**
4. [x] Add `DEBUG_CONNECTORS=1` env: when set, log every outbound request (method, url,
   status, ms) to the server console, never the key.
   → verify: one line per widget fetch, secrets absent from output.
   **Result: `src/lib/debugFetch.ts` wraps every connector's raw `fetch()` call (stripe,
   gcal, gmail, github, weather, rss — system has no network calls, only
   `execFile`/`readFile`). Logs `[connectors] METHOD url -> status (Nms)`; only method,
   url, status and duration are logged, never headers/body, so bearer tokens (sent via
   the `Authorization` header, never in the URL for any of these 7 connectors) never
   reach the log. Verified in dev.log.**

**Note for the next iteration on Phase 1+:** this sandbox's outbound network egress goes
through a proxy that returns HTTP 403 for third-party hosts (Open-Meteo, Stripe, GitHub,
hnrss.org were all tested and all 403'd, even with no auth involved for Open-Meteo/RSS).
That means genuine live-data verification (Phase 1 item 3, Phase 2 "numbers equal the
Stripe dashboard", Phase 3 GitHub mapping, etc.) **cannot be completed inside this
sandboxed session** — only on a machine with real outbound internet and real credentials.
Phase 0's own verification does not need real network access (it only needs a live
attempt to fail, which the sandbox's 403 already does for free), so Phase 0 is genuinely
complete. Phases 1+ that require comparing live output to a real API's ground truth
should be flagged back to the human owner rather than half-verified here.

---

## Phase 1 — keyless connectors first (~1h)

Weather, RSS and System already run live; harden them.

1. **Caching.** Add `src/lib/cache.ts`: in-memory TTL map keyed by
   `widgetId + JSON.stringify(settings)`. Wrap live calls. TTLs: weather 600s, rss 300s,
   github 120s, stripe 60s, gcal/gmail 60s; system not cached.
   → verify: hammer `/api/widget/weather.current` 10× and count 1 upstream request in
   DEBUG_CONNECTORS output.
2. **RSS SSRF guard.** The feed URL is user input. Reject non-http(s) schemes, and reject
   hosts resolving to private ranges (127/8, 10/8, 172.16/12, 192.168/16, 169.254/16, ::1).
   → verify: `url=file:///etc/passwd` and `url=http://169.254.169.254/` both return an
   error state, not data.
3. **System GPU.** Only path needing the target machine (Ryzen 5 / RTX 3070). Run
   `system.gpu` there, confirm `nvidia-smi` parsing against real output, multi-GPU safe.
   → verify: values match `nvidia-smi` run manually, within one refresh interval.

---

## Phase 2 — Stripe (~1–2h)

Single static secret key, so it is the cheapest real-auth test.

1. Create a **restricted** key in the Stripe dashboard, read-only on Balance + Charges.
   Put it in `.env.local`. Never a live-mode full secret key.
2. Verify field mapping against a real response for `/v1/balance` and `/v1/charges`:
   `amount` is minor units; `currency` is lowercase; `available[]`/`pending[]` are arrays
   **per currency** — confirm the currency setting selects, not sums.
   → verify: numbers in the widget equal the Stripe dashboard for the same period.
3. `stripe.revenue`: current code sums up to 100 charges. Implement cursor pagination
   (`starting_after`) with a hard cap (say 1000) and log when the cap truncates.
   → verify: an account with >100 charges in the window reports the same gross volume as
   Stripe's own report.
4. Decide refunds/disputes: gross volume should probably subtract refunds. Pick one,
   document it in the widget description.

## Phase 3 — GitHub (~1–2h)

1. Fine-grained PAT, read-only, no repo write scopes. `.env.local`.
2. Verify `/users/<u>/events` mapping for each type handled (PushEvent commit count,
   PullRequestEvent merged vs opened, IssuesEvent, WatchEvent, ForkEvent, ReleaseEvent).
   Events API only returns ~90 days / 300 events and is cached ~60s server-side by GitHub.
3. `github.contributions` uses the GraphQL API — confirm the PAT type actually has
   GraphQL access (fine-grained tokens historically did not for all queries; fall back to
   REST-derived counts or state the limitation).
4. Add conditional requests: store `ETag` per endpoint, send `If-None-Match`, treat 304 as
   a cache hit. Surface `x-ratelimit-remaining` in the DEBUG log.
   → verify: repeated loads consume no rate-limit budget.

## Phase 4 — Google OAuth: Calendar + Gmail (~3–4h, the real work)

Current code takes a static `GOOGLE_CALENDAR_TOKEN` / `GMAIL_TOKEN` bearer. Google access
tokens expire in ~1h, so this is unusable in practice. Replace with a proper flow.

1. Google Cloud project → OAuth client (Desktop or Web). Scopes:
   `calendar.readonly`, `gmail.readonly`. New env:
   `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`.
2. Add routes `src/app/api/auth/google/route.ts` (redirect to consent, `access_type=offline`,
   `prompt=consent`) and `.../callback/route.ts` (exchange code → refresh token).
   Store the refresh token in `data/credentials.json`, mode 0600, gitignored.
3. `src/lib/google.ts`: `getAccessToken()` — reads the refresh token, exchanges it, caches
   the access token in memory until `expires_in - 60s`. Both connectors call only this.
4. Replace `envKeys` for gcal/gmail with a credential check against the stored file so
   `isLive()` and the connectors panel stay accurate; add a "Connect Google" button in
   DashboardSettings that links to `/api/auth/google`.
5. Gmail: current code does N+1 requests (list + per-message metadata). Use
   `format=metadata&metadataHeaders=From&metadataHeaders=Subject` and batch, or accept the
   cost with the Phase 1 cache. Unread count comes from `labels/UNREAD.messagesUnread`.
   → verify: unread number matches the Gmail UI.
6. Calendar: confirm `singleEvents=true&orderBy=startTime`, all-day events use `start.date`
   not `start.dateTime`, and timezones render in local time.
   → verify: agenda matches Google Calendar for the next 3 days, including an all-day event.
7. → verify the whole phase: leave the dashboard open for >1h; widgets keep working after
   the first access token expires.

## Phase 5 — credentials in the UI (optional, ~2h)

Only if editing `.env.local` proves annoying. Move all secrets into
`data/credentials.json` (0600, gitignored) written by a Connectors tab in settings;
`.env.local` stays as an override that wins. Never send stored secrets back to the
browser — return `configured: true` and a masked suffix only.

## Phase 6 — tests (~2h)

No test runner yet. Add `vitest` (dev dep only).

- Unit: RSS parser (RSS 2.0, RDF, Atom, CDATA, entities, malformed input);
  `df`/`ps`/`nvidia-smi` parsers against captured fixture output; Stripe day-bucketing.
- Contract: for every widget id, assert mock and live parse paths produce the same keys —
  a fixture per connector under `src/connectors/<id>/__fixtures__/`.
- Smoke: keep the existing Playwright flow (add → configure → drag → persist → reload →
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
