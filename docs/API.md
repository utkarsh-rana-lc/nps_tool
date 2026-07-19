# API reference

Base URL: `https://nps.limechat.ai` (local: `http://localhost:4000`). All bodies are JSON.

## Auth

| Header | Used by | Value |
| --- | --- | --- |
| `X-NPS-Write-Key` | widget (browser) | `pk_live_…` public write key |
| `Authorization: Bearer` | dashboard | signed session **JWT** from `/v1/auth/login` |
| `Authorization: Bearer` | service/BI jobs | `sk_admin_…` service key (still accepted) |

`product` is always one of `crm`, `marketing`, `bot`.

---

## Auth endpoints (dashboard login)

### `POST /v1/auth/login`

```json
{ "email": "you@limechat.ai", "password": "…" }
```

**200** → `{ "token": "<jwt>", "user": { "id": 1, "email": "…", "role": "admin", "is_active": true } }`
Errors: `401 invalid_credentials`, `403 inactive`.

### `GET /v1/auth/me`  *(Bearer JWT)*
Returns the current session's user. Used by the dashboard to restore a session on load.

### `GET /v1/auth/users`  *(admin only)*
`{ "users": [ { "id", "email", "name", "role", "is_active", "last_login_at", "created_at" } ] }`

### `POST /v1/auth/users`  *(admin only)*
```json
{ "email": "teammate@limechat.ai", "name": "Teammate", "password": "min-10-chars", "role": "viewer" }
```
**201** → `{ "user": { … } }`. Errors: `409 email_taken`, `400 weak_password`.

### `PATCH /v1/auth/users/:id`  *(admin only)*
Any of: `{ "isActive": false }`, `{ "role": "admin" }`, `{ "password": "new-min-10" }`.

---

## Survey message settings

The question and follow-up prompt shown in the pop-up are editable per product.

### `GET /v1/nps/settings`  *(signed-in user)*
```json
{ "settings": [
  { "product": "crm", "question": "How likely…?", "reasonPrompt": "What's the most important reason…?", "updatedAt": "2026-07-19T…" }
] }
```

### `PUT /v1/nps/settings/:product`  *(admin only)*
```json
{ "question": "How likely are you to recommend LimeChat CRM?", "reasonPrompt": "Tell us why" }
```
**200** → `{ "setting": { "product": "crm", "question": "…", "reasonPrompt": "…" } }`.
Validation: both fields required, max 300 chars each. The widget picks up the new copy on its next eligibility call.

---

## Widget endpoints (write key)

### `GET /v1/nps/eligibility`

Decide whether to show the pop-up. If eligible, a prompt is opened and its id returned.

Query / headers:

| param | in | required | notes |
| --- | --- | --- | --- |
| `product` | query | yes | `crm` \| `marketing` \| `bot` |
| `accountRef` | query | yes | platform-unique account id |
| `accountName` | query | no | cached for display |
| `email` | query | yes | end user's email |
| `userRef` | query | no | host app's user id |

**200**

```json
{
  "eligible": true,
  "promptId": "prm_5f3c…",
  "period": "2026-07",
  "reason": null
}
```

When not eligible:

```json
{ "eligible": false, "promptId": null, "period": "2026-07", "reason": "already_prompted_this_month" }
```

The eligibility response also carries the current **survey copy** for that
product (admin-editable), so the widget always shows the latest message:

```json
{
  "eligible": true,
  "promptId": "prm_5f3c…",
  "period": "2026-07",
  "reason": null,
  "question": "How likely are you to recommend LimeChat CRM to a friend or colleague?",
  "reasonPrompt": "What's the most important reason for your score?"
}
```

### `POST /v1/nps/responses`

Submit a score.

```json
{
  "promptId": "prm_5f3c…",
  "score": 9,
  "reason": "Support team is fast and the bot flows are reliable."
}
```

**201**

```json
{ "id": "res_9a2…", "category": "promoter", "period": "2026-07" }
```

Errors: `409 already_responded`, `400 invalid_score` (must be integer 0–10), `404 prompt_not_found`.

### `POST /v1/nps/responses/:promptId/dismiss`

Records that the user closed the pop-up without scoring. Optional — the prompt already prevents re-asking this month. **204**.

---

## Dashboard endpoints (admin key)

Common filter query params: `product` (`all` default), `dateFrom`, `dateTo` (`YYYY-MM-DD`), `accountRef`.

### `GET /v1/nps/analytics/summary`

```json
{
  "filters": { "product": "all", "dateFrom": "2026-01-01", "dateTo": "2026-07-31" },
  "nps": 42,
  "previousNps": 37,
  "delta": 5,
  "responses": 1280,
  "prompts": 3110,
  "responseRate": 0.41,
  "breakdown": {
    "promoters":  { "count": 690, "pct": 0.539 },
    "passives":   { "count": 320, "pct": 0.250 },
    "detractors": { "count": 270, "pct": 0.211 }
  },
  "rating": "good"
}
```

`rating` ∈ `needs_attention` (<0), `good` (0–49), `excellent` (50–69), `world_class` (70+).

### `GET /v1/nps/analytics/timeseries`

Drives the trend graph. `groupByProduct=true` splits series.

```json
{
  "granularity": "month",
  "points": [
    { "period": "2026-01", "nps": 31, "responses": 180 },
    { "period": "2026-02", "nps": 35, "responses": 202 }
  ],
  "byProduct": {
    "crm":       [ { "period": "2026-01", "nps": 40, "responses": 90 } ],
    "marketing": [ { "period": "2026-01", "nps": 22, "responses": 50 } ],
    "bot":       [ { "period": "2026-01", "nps": 28, "responses": 40 } ]
  }
}
```

### `GET /v1/nps/analytics/accounts`

Per-account roll-up for the table. Supports `sort` (`nps`, `responses`, `latest`) and `search`.

```json
{
  "accounts": [
    {
      "accountRef": "acc_10432",
      "accountName": "Acme Retail",
      "nps": 55,
      "responses": 22,
      "promoters": 14, "passives": 5, "detractors": 3,
      "latestScore": 9,
      "latestAt": "2026-07-14T10:12:00Z",
      "byProduct": { "crm": 60, "marketing": 40, "bot": 50 }
    }
  ]
}
```

### `GET /v1/nps/analytics/accounts/:accountRef/users`

Per-user rows within an account (account id, email, score, category, product, month).

### `GET /v1/nps/export/accounts/:accountRef.csv`

Streams a CSV of every raw response for one account:

```
period,response_at,product,account_ref,account_name,email,user_ref,score,category,reason
2026-07,2026-07-14T10:12:00Z,crm,acc_10432,Acme Retail,ravi@acme.com,usr_88,9,promoter,"Fast support"
```

Add `?product=crm` to scope. Returns `text/csv` with `Content-Disposition: attachment`.

### `GET /v1/nps/export/all.csv`

Same shape, every account (respects filters). For bulk/BI ingestion.
