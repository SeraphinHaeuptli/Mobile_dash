# PLAN.md — implementing the connectors for real

> **For AI agents only.** This file (with PROJECT.md) is the machine-readable state for
> whichever agent picks up this repo next — there is no human maintaining it by hand.
> Checkboxes are the source of truth for what is actually done; do not mark one `[x]`
> without having run its `→ verify` step yourself in this session. Each work session:
> read PROJECT.md, check these boxes, do the next unchecked item, then update both files
> (checkboxes here, a dated entry in PROJECT.md's progress log) before ending the turn.

Goal: move every connector from "live code written, never exercised" to "verified against
the real API, with correct auth, caching, and honest error states".
Read PROJECT.md first for the contract and file map.

Ordering is deliberate: Phase 0 is a prerequisite for honestly testing anything else,
then connectors go easiest-credential-first so each phase ends with something working.

---

## Phase 0 — make failure visible (blocking, ~1h) — ✅ DONE 2026-08-26

Today every live call silently falls back to mock on error. While implementing real
connectors this hides exactly the failures you need to see (401, 403, rate limit, bad
field mapping). Fix before touching any API.

- [x] 1. `src/lib/types.ts`: widen mode to `'mock' | 'live' | 'stale'` and add
   `warning?: string` to `WidgetResponse`. Also added `WidgetResult<T>` (the new
   per-handler return shape: `{ data, mode, warning? }`) and changed
   `ConnectorServer.handlers` to return it instead of bare `Json`.
   → verify: `npx tsc --noEmit` — clean (ran, 0 errors).
- [x] 2. Connector handlers: on a live failure return the mock **plus** the reason.
   Added shared helper `withFallback(live, mock, { envKeys, label })` in
   `src/lib/fallback.ts` and used it in all 7 connectors, deleting the seven
   near-identical local `resolve`/`safe` try/catch copies.
   → verify: `grep -rn "catch {" src/connectors/*/server.ts` — the remaining hits are
   unrelated internal fallbacks (URL parsing, `/proc/meminfo` vs `os.totalmem()`, BSD vs
   GNU `ps` flags), not the old mock-substitution pattern. Confirmed by reading each one.
- [x] 3. `WidgetShell.tsx`: `stale` renders the data plus an amber header pill
   (`<span className="pill warn">`, reused the existing `.pill.warn` CSS class) whose
   `title` is the failure reason. `mock` keeps the neutral "sample" pill.
   → verify: ran `STRIPE_SECRET_KEY=sk_test_bogus DEBUG_CONNECTORS=1 npm run dev`,
   screenshotted the dashboard with Playwright (installed ad-hoc, not a project
   dependency). Stripe balance widget showed pill text "⚠ stale" with
   title="Stripe 403 on /balance" instead of the silent "sample" pill. Same confirmed
   live (unforced) for GitHub (401 — `GITHUB_TOKEN` happens to be present in this sandbox
   as a proxy-injected token that Stripe/GitHub/Open-Meteo/the RSS host all reject),
   Open-Meteo (403) and the RSS feed (403) — this sandbox's egress is proxied/restricted,
   so every real outbound call here fails, which incidentally exercised the whole
   mock→stale path against 4 different real APIs for free. `system.gpu` also went
   `stale` for the honest reason `spawn nvidia-smi ENOENT` (no GPU in this container).
- [x] 4. Added `DEBUG_CONNECTORS=1` env, implemented as `src/lib/debugFetch.ts` — a
   drop-in `fetch()` replacement used by every connector's transport function
   (`stripeGet`, `gh`, `gmailGet`, `fetchEvents`, `openMeteo`, `liveFeed`). Logs
   `[connectors] METHOD url -> status (Nms)` per request; system connector has no
   network calls so nothing to log there.
   → verify: inspected `/tmp/dash-dev*.log` — one line per outbound request, plus one
   `[connectors] <label> fallback: <reason>` line per handler that fell back. Grepped the
   full log for the literal env values of every credential env key — zero matches.

Not done in this pass, left for whoever picks up Phase 1+: no `.env.local` in this repo
(nothing to point Stripe/GitHub/Google connectors at except whatever the host environment
happens to inject), so live success paths (as opposed to live *failure* paths, which got
real coverage above) are still unverified. `npm run build` and `npx tsc --noEmit` both
clean after this phase.

---

## Phase 1 — keyless connectors first (~1h) — next up

Weather, RSS and System already run live; harden them.

- [ ] 1. **Caching.** Add `src/lib/cache.ts`: in-memory TTL map keyed by
   `widgetId + JSON.stringify(settings)`. Wrap live calls. TTLs: weather 600s, rss 300s,
   github 120s, stripe 60s, gcal/gmail 60s; system not cached.
   → verify: hammer `/api/widget/weather.current` 10× and count 1 upstream request in
   DEBUG_CONNECTORS output.
- [ ] 2. **RSS SSRF guard.** The feed URL is user input. Reject non-http(s) schemes, and reject
   hosts resolving to private ranges (127/8, 10/8, 172.16/12, 192.168/16, 169.254/16, ::1).
   → verify: `url=file:///etc/passwd` and `url=http://169.254.169.254/` both return an
   error state, not data.
- [ ] 3. **System GPU.** Only path needing the target machine (Ryzen 5 / RTX 3070). Run
   `system.gpu` there, confirm `nvidia-smi` parsing against real output, multi-GPU safe.
   → verify: values match `nvidia-smi` run manually, within one refresh interval.
   Cannot be done from a cloud/CI agent session — no GPU, no `nvidia-smi` in this
   container (confirmed: `spawn nvidia-smi ENOENT`, correctly falls back to `stale`).
   Skip this item unless running directly on the target machine.

---

## Phase 2 — Stripe (~1–2h)

Single static secret key, so it is the cheapest real-auth test.

- [ ] 1. Create a **restricted** key in the Stripe dashboard, read-only on Balance + Charges.
   Put it in `.env.local`. Never a live-mode full secret key.
- [ ] 2. Verify field mapping against a real response for `/v1/balance` and `/v1/charges`:
   `amount` is minor units; `currency` is lowercase; `available[]`/`pending[]` are arrays
   **per currency** — confirm the currency setting selects, not sums.
   → verify: numbers in the widget equal the Stripe dashboard for the same period.
- [ ] 3. `stripe.revenue`: current code sums up to 100 charges. Implement cursor pagination
   (`starting_after`) with a hard cap (say 1000) and log when the cap truncates.
   → verify: an account with >100 charges in the window reports the same gross volume as
   Stripe's own report.
- [ ] 4. Decide refunds/disputes: gross volume should probably subtract refunds. Pick one,
   document it in the widget description.

## Phase 3 — GitHub (~1–2h)

- [ ] 1. Fine-grained PAT, read-only, no repo write scopes. `.env.local`.
- [ ] 2. Verify `/users/<u>/events` mapping for each type handled (PushEvent commit count,
   PullRequestEvent merged vs opened, IssuesEvent, WatchEvent, ForkEvent, ReleaseEvent).
   Events API only returns ~90 days / 300 events and is cached ~60s server-side by GitHub.
- [ ] 3. `github.contributions` uses the GraphQL API — confirm the PAT type actually has
   GraphQL access (fine-grained tokens historically did not for all queries; fall back to
   REST-derived counts or state the limitation).
- [ ] 4. Add conditional requests: store `ETag` per endpoint, send `If-None-Match`, treat 304 as
   a cache hit. Surface `x-ratelimit-remaining` in the DEBUG log.
   → verify: repeated loads consume no rate-limit budget.

## Phase 4 — Google OAuth: Calendar + Gmail (~3–4h, the real work)

Current code takes a static `GOOGLE_CALENDAR_TOKEN` / `GMAIL_TOKEN` bearer. Google access
tokens expire in ~1h, so this is unusable in practice. Replace with a proper flow.

- [ ] 1. Google Cloud project → OAuth client (Desktop or Web). Scopes:
   `calendar.readonly`, `gmail.readonly`. New env:
   `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`.
- [ ] 2. Add routes `src/app/api/auth/google/route.ts` (redirect to consent, `access_type=offline`,
   `prompt=consent`) and `.../callback/route.ts` (exchange code → refresh token).
   Store the refresh token in `data/credentials.json`, mode 0600, gitignored.
- [ ] 3. `src/lib/google.ts`: `getAccessToken()` — reads the refresh token, exchanges it, caches
   the access token in memory until `expires_in - 60s`. Both connectors call only this.
- [ ] 4. Replace `envKeys` for gcal/gmail with a credential check against the stored file so
   `isLive()` and the connectors panel stay accurate; add a "Connect Google" button in
   DashboardSettings that links to `/api/auth/google`.
- [ ] 5. Gmail: current code does N+1 requests (list + per-message metadata). Use
   `format=metadata&metadataHeaders=From&metadataHeaders=Subject` and batch, or accept the
   cost with the Phase 1 cache. Unread count comes from `labels/UNREAD.messagesUnread`.
   → verify: unread number matches the Gmail UI.
- [ ] 6. Calendar: confirm `singleEvents=true&orderBy=startTime`, all-day events use `start.date`
   not `start.dateTime`, and timezones render in local time.
   → verify: agenda matches Google Calendar for the next 3 days, including an all-day event.
- [ ] 7. → verify the whole phase: leave the dashboard open for >1h; widgets keep working after
   the first access token expires.

## Phase 5 — credentials in the UI (optional, ~2h)

- [ ] Only if editing `.env.local` proves annoying. Move all secrets into
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
  remove) as `e2e/flow.spec.ts`. (Playwright is not yet a project dependency — this
  session installed it ad-hoc with `npm install --no-save playwright` to verify Phase 0
  visually, then uninstalled it. Phase 6 should add it for real, as a devDependency.)

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
