# Architecture

## 1. Goals & constraints

- **Collect NPS in-app** across three products (CRM, Marketing, Bot) with **one injectable snippet**.
- **Survey each user at most once per calendar month, per product.** Server-authoritative.
- **Attribute every response** to `account_id` (platform-unique) + user email.
- **Analyse**: NPS overall and per product, trend over months/years, per-user breakdown, downloadable per-account reports.
- **Be trivial to plug in** — no framework assumptions on the host app.

## 2. Component diagram

```
   ┌─────────────────────────────────────────────────────────────┐
   │  Host apps (CRM · Marketing · Bot) — each embeds one snippet  │
   │                                                               │
   │   window.LimeChatNPS.push(['init', { product, account,user}]) │
   └───────────────┬───────────────────────────────┬───────────────┘
                   │  GET  /v1/nps/eligibility      │  (public write key)
                   │  POST /v1/nps/responses        │
                   ▼                                ▼
        ┌──────────────────────────────────────────────────┐
        │         Fastify API  (packages/server)            │
        │  ── auth (write key vs admin key)                 │
        │  ── eligibility service (monthly throttle)        │
        │  ── ingest service (upsert account/user, insert)  │
        │  ── analytics service (NPS math, timeseries)      │
        │  ── export service (CSV per account)              │
        └───────────────┬──────────────────────────────────┘
                        │ SQL
                        ▼
             ┌────────────────────────┐
             │      PostgreSQL         │
             │  accounts · users ·     │
             │  survey_prompts ·       │
             │  nps_responses          │
             └────────────────────────┘
                        ▲
                        │  GET /v1/nps/analytics/*  (admin key)
        ┌───────────────┴──────────────────────────────────┐
        │     React dashboard  (packages/dashboard)         │
        │  score cards · product filter · trend chart ·     │
        │  per-user table · per-account CSV download        │
        └───────────────────────────────────────────────────┘
```

## 3. Data model

Four tables. See [`db/migrations`](../db/migrations).

- **accounts** — one row per LimeChat account. `account_ref` = the platform's unique account id you pass in. Cached name for display.
- **users** — one row per (account, email). This is who we survey.
- **survey_prompts** — every time the widget is *shown* to a user for a product in a month, we record a prompt. This is the throttle ledger and also lets us compute response-rate. Unique on `(user_id, product, period_month)`.
- **nps_responses** — the actual score (0–10) + reason + derived category. Linked to a prompt. Unique on `(user_id, product, period_month)` so a user can only score once per product per month even across races.

`period_month` is a `DATE` pinned to the first of the month (e.g. `2026-07-01`) in the account's reporting timezone. It is the atom of the monthly cadence and the x-axis of every trend.

### Why a `survey_prompts` ledger instead of just checking responses?

Two reasons top survey tools bake in:
1. **Response rate** is a first-class metric. You can only compute it if you know how many people were *asked*, not just how many answered.
2. **Dismissals shouldn't re-nag.** If a user closes the pop-up without scoring, they've been "asked" this month; the ledger records that so they aren't shown it again until next month.

## 4. The monthly throttle (once per user per product)

Eligibility is decided in one place — `EligibilityService.check()` — using the current month:

```
eligible = NOT EXISTS (
  a prompt for (user, product) in the current period_month
)
```

Flow:
1. Widget loads, calls `GET /v1/nps/eligibility?product=crm` with account+user context (identified via write key + headers).
2. Server upserts the account & user, computes `period_month` = first-of-month in the account timezone, checks the ledger.
3. If eligible, server **creates the prompt row** (status `shown`) and returns `{ eligible: true, promptId }`. Creating it here — at decision time — closes the multi-tab race: two tabs can't both be told "yes."
4. Widget renders the pop-up. On submit → `POST /v1/nps/responses` with `promptId`. On dismiss → `POST /v1/nps/responses/:promptId/dismiss` (optional; the prompt already blocks re-asking).

Because the ledger is keyed on `period_month`, the window resets automatically on the 1st of each month. No cron needed for the core cadence.

> A `scheduled-task`/cron is only needed if you want to *proactively* email users who never logged in. The in-app cadence is entirely lazy/pull-based.

## 5. NPS computation

Single implementation in `packages/server/src/domain/nps.ts`, reused by analytics and export:

```
promoters  = count(score >= 9)
passives   = count(score 7..8)
detractors = count(score <= 6)
total      = promoters + passives + detractors
nps        = round( (promoters/total - detractors/total) * 100 )
```

Categories are also denormalised onto each response row at insert time (`category` column) so slicing is cheap and historical scores never re-bucket if definitions were ever to change.

## 6. Security model

- **Write key (`pk_live_…`)** — public, shipped in the browser. Can *only* hit eligibility + response endpoints, and only for its own account scope. Rate-limited per IP + per account.
- **Admin key (`sk_admin_…`)** — server-side only, powers the dashboard analytics + export. Never in the browser bundle.
- Account/user identity is signed into requests by the host app context; the write key scopes what account a caller may write to.
- CORS allow-list configurable via `CORS_ORIGINS`.
- Reasons are free text → stored as-is but always rendered escaped in the dashboard; export is CSV-injection-safe (leading `=+-@` are quoted).

## 7. Analytics surface

`AnalyticsService` supports filters: `product` (crm/marketing/bot/all), `dateFrom`, `dateTo`, `accountRef`.

- **Summary** — NPS, counts, %promoter/passive/detractor, response rate, deltas vs previous period.
- **Timeseries** — NPS per `period_month` (drives the multi-year/month graph), optionally split per product.
- **Per-account / per-user** — NPS and latest score per account+user, sortable/filterable, feeds the table.
- **Export** — per-account CSV of every raw response (date, product, email, score, category, reason).

## 8. Scaling notes

- Reads dominate; add read replicas and cache the summary/timeseries (they change at most once per submit). A 60s cache is plenty for an ops dashboard.
- `nps_responses` is naturally partitionable by `period_month` (range partitioning) once volume grows.
- The write path is a single upsert + insert; safe to run behind an autoscaling API tier. Idempotency comes from the unique `(user, product, period_month)` constraint.
- Widget bundle is a static asset → serve from CDN, immutable-hashed filename.
