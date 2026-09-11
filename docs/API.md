# VervAI — HTTP API Reference

VervAI is a Next.js 14 (App Router) application that turns long-form content
(audio/video files, YouTube URLs, transcripts, documents, URLs) into short-form
drafts (LinkedIn post, newsletter section, short-form script, thread, carousel)
plus an agentic
layer that plans, gates and executes content angles.

This document is the complete reference for the HTTP surface under `app/api/**`
plus the client-side intake flow that calls Supabase directly.

---

## Contents

- [Conventions](#conventions)
- [Authentication & authorization](#authentication--authorization)
- [Shared error & SSE formats](#shared-error--sse-formats)
- [Intake (no HTTP endpoint)](#intake-no-http-endpoint)
- [Core repurpose pipeline](#core-repurpose-pipeline)
- [Outputs](#outputs)
- [Sources](#sources)
- [Prompts & brand voice](#prompts--brand-voice)
- [Auth & account](#auth--account)
- [Recommendations](#recommendations)
- [Usage & billing](#usage--billing)
- [Notifications](#notifications)
- [Analytics events](#analytics-events)
- [Agentic API](#agentic-api)
- [YouTube integration](#youtube-integration)
- [Google Drive integration](#google-drive-integration)
- [Buffer integration](#buffer-integration)
- [Health & diagnostics](#health--diagnostics)
- [Rate limits & safety rails](#rate-limits--safety-rails)
- [Data model](#data-model)

---

## Conventions

- **Base URL:** any environment where the app runs (`http://localhost:3000`
  locally, `https://verv-ai.vercel.app` in production). All routes below are
  absolute from the origin.
- **Auth:** most routes require a signed-in session. Since Next.js 14 reads the
  Supabase session from the `sb*` auth cookies automatically (PKCE, raw-JSON
  SSR cookies), **no `Authorization` header is needed** — the SSR cookie
  carries the session. The server resolves identity with
  `supabase.auth.getUser()`; the owner id is **never** accepted from the
  request body.
- **Request bodies:** JSON. Malformed JSON is tolerated as `{}` on routes that
  use `.json().catch(() => ({}))` (mostly POST/PATCH/PUT), and rejected with
  `400 {"error":"Invalid JSON body"}` where explicitly handled.
- **Ownership:** every user-owned table has per-user Row Level Security
  (`auth.uid() = user_id`). API handlers additionally check ownership
  explicitly and fail closed.
- **`outputs` writes (update/delete) require the service role** — `outputs`
  deliberately has **no UPDATE/INSERT clientside update policy**. Editing and
  regenerating always go through these API routes, never through the Supabase
  client.

---

## Authentication & authorization

- Email/password through Supabase Auth. Login UI: `app/login/page.tsx`.
- `GET /api/auth/callback` performs the PKCE exchange after a magic-link/email
  confirmation.
- `middleware.ts` protects these paths (unauthenticated → redirect `/login`):
  `/dashboard`, `/upload`, `/repurpose`, `/branding`, `/connections`,
  `/library`, `/agent`, `/publish`, `/content`, `/settings`,
  `/notifications`, `/reset-password`,
  plus the account delete/export APIs (`/api/account/delete`,
  `/api/account/export`) and `/api/notifications`.
- Public/unauthed endpoints:
  - `GET /api/auth/callback`
  - `POST /api/billing/webhook` (Paddle signature verified)
  - The two OAuth *redirect* kick-offs still require a session.

Every other endpoint returns `401 {"error":"Not signed in"}` when the session
is missing.

---

## Shared error & SSE formats

### JSON errors

Non-SSE handlers return `{ "error": string, ...extras }` with an appropriate
status:

| Status | Meaning |
|---|---|
| `400` | Missing/invalid body, invalid format ids, prompt too long, invalid plan |
| `401` | Not signed in |
| `404` | Resource not found / not owned |
| `409` | Wrong state (e.g. source already processing, run not awaiting approval) |
| `429` | Rate limit or usage/regeneration limit reached |
| `500` | Server / DB error |
| `502` | Upstream failure (model, provider, token refresh) |
| `503` | Feature unavailable / schema migration not applied / not configured |

Limit errors additionally carry a structured body via `limitErrorBody`:

```json
{ "error": "…", "code": "USAGE_LIMIT_REACHED|OUTPUT_LIMIT_REACHED|REGENERATION_LIMIT_REACHED",
  "limit": 5, "used": 3, "remaining": 2, "percent": 60, "resetAt": "2026-09-30T23:59:59.999Z" }
```

The monthly `USAGE_LIMIT_REACHED` body includes `resetAt` (UTC month end).
Rate-limit responses include `{"retryAfter": <seconds>}` and the
`Retry-After` HTTP header.

### Server-Sent Events

`POST /api/process` and `POST /api/agent/process` stream progress as a
`text/event-stream` response (`cache-control: no-cache, no-transform`):

```
event: progress
data: {"stage":"Generating outputs","pct":82}
```

Events:

| Event | `data` | Meaning |
|---|---|---|
| `progress` | `{ stage: string, pct: number }` | Stage + 0–100 progress |
| `done` | `{ ok: true, skipped?: true }` | Job/run finished (or was already claimed) |
| `error` | `{ error: string }` | Job/run failed; source/run marked `failed` |

The client must also poll the REST resources (sources / agent run) — the
stream is a progress channel, the DB is the source of truth.

---

## Intake (no HTTP endpoint)

There is **no upload API route**. File intake goes **browser → Supabase
Storage** directly, then a `sources` row is inserted with the Supabase client
(RLS-gated):

1. Upload bytes to the private `sources` storage bucket at
   `sources/{user_id}/{filename}`.
2. Insert a `sources` row (`source_type` = `audio`|`video`|`transcript`;
   `storage_path` = the full object path).
3. For YouTube URLs, the client validates with `lib/youtube-url.ts` and inserts
   a `sources` row with `source_type = 'youtube'` and `source_url = <url>`.
4. For pasted links / URLs, a `sources` row with `source_type = 'transcript'`
   and `source_url = <url>`.

Accepted kinds & extensions (`lib/limits.ts`):

- Audio/video: `mp3 m4a m4b wav aiff aac ogg flac webm mp4 mov mpeg mpg`
- Transcript text/subtitles: `txt srt vtt md markdown`
- Documents: `pdf docx`
- Images: `png jpg jpeg gif webp bmp heic heif avif`

---

## Core repurpose pipeline

### `POST /api/repurpose` — enqueue a repurpose job

**Auth:** required. **SSR**

Enqueue-only. Returns immediately with a `jobId`; the caller (or the dashboard
poll loop) then kicks `POST /api/process`.

Request body:

```json
{
  "sourceId": "uuid",                       // required
  "formats": ["linkedin_post", "newsletter"], // optional; empty = all five defaults
  "idempotencyKey": "any-string",           // optional, per-user replay key
}
```

Guards, in order:

1. `sourceId` present → `400 {"error":"sourceId is required"}`.
2. `formats` valid ids (`linkedin_post|newsletter|shortform_script|thread|carousel`) → `400`
   otherwise.
3. Signed in → `401`.
4. Source exists **and belongs to the caller** → `404`.
5. Source status is `uploaded` or `failed` → else `409
   {"error":"Source is already processing"}`.
6. Output budget: `formats.length <= plan.maxOutputsPerJob` →
   `400 OUTPUT_LIMIT_REACHED`.
7. Rolling-minute rate limit → `429` with `Retry-After` (default 10/min).
8. Atomic `enqueue_job` RPC (service role): advisory-locked per user; checks
   monthly cap **and** idempotency replay in one transaction, writes the
   `reserve` ledger row. Failure/missing migration → **`503` (fail closed)**,
   never an unchecked insert.

Special responses from the RPC:

```json
{ "ok": false, "error": "…", "code": "USAGE_LIMIT_REACHED",
  "used": 5, "limit": 5, "remaining": 0, "percent": 100, "resetAt": "…" }
```

Success (new or idempotent replay):

```json
{
  "ok": true,
  "jobId": "uuid",
  "idempotent": false,             // true when a key was replayed
  "usage": { "plan": "beta", "used": 2, "limit": 5, "remaining": 3,
             "percent": 40, "resetAt": "2026-09-30T23:59:59.999Z" }
}
```

### `POST /api/process` — worker (SSE)

**Auth:** required. **SSE**

Request body: `{ "jobId": "uuid" }` → `400` if missing, `404` if the job
doesn't exist for the caller.

Claims the job atomically:
- `queued` jobs, or `running` jobs whose `started_at` is older than the
  **10-minute stale window**, are claimable.
- A concurrent claim loses the UPDATE and gets `done` `{ok:true, skipped:true}`.

Job flow (each stage emits `progress`):

1. **Preparing** (`pct` 5) — deletes prior outputs for the source, sets source
   `status = transcribing`.
2. **Ingesting** — `ingestSource` resolves audio/video/YouTube (AssemblyAI
   transcription) or transcript/document/URL providers into one canonical
   `TranscriptDocument`. No `progress` stage unless the provider reports.
3. **Duration cap** — media duration must be ≤ plan `maxInputMinutes`; exceeding
   it is user input → job `failed`, **not refunded**.
4. **Saving transcript** — upsert into `transcripts` (keyed `source_id`);
   missing table degrades to a log + `sources.transcript`.
5. **Content intelligence** — deterministic extraction (topics/claims/quotes/
   hooks/opportunities) persisted to `content_intelligence`; **best-effort**,
   every evidence segment verified verbatim before writing.
6. **Generating outputs** (`pct` 82→97) — the requested formats (or all five
   defaults) generated in parallel via `generateOutput` (Gemini
   `gemini-3.6-flash`, OpenRouter fallback only on quota). Prompts come from
   `buildSystemPrompt(format, userPrompts)` (custom override > built-in
   `PROMPTS[format]` > brand voice layer).
7. **Ready** (`pct` 100) — writes `outputs` rows, source → `done`, job → `done`,
   `consume` ledger event, `done` event.

Errors stream an `error` event and mark the source `failed` with
`error_message`; the job is marked `failed`, and for platform-side failures
(transcription/generation) the monthly usage is **refunded** (`refund` ledger
event + `jobs.refunded = true`).

---

## Sources

### `GET /api/sources` — list owned sources + active jobs

**Auth:** required.

Returns:

```json
{
  "sources": [ { "...": "full sources row", "outputs": [ { "...": "outputs rows" } ] } ],
  "jobs": [ { "id": "uuid", "source_id": "uuid", "status": "queued|running", "started_at": "…" } ]
}
```

- `sources` sorted by `created_at` descending, each row embedded with its
  `outputs` (RLS-scoped to the caller).
- `jobs` = the caller's `queued`/`running` jobs (used by the dashboard's 4s
  poll loop to re-kick `/api/process`).

### `DELETE /api/sources/[id]` — delete a source

**Auth:** required.

- Loads the source (owned) → `404` otherwise.
- If `storage_path` exists, removes the object from the `sources` bucket via the
  service client (storage has no delete policy) → `500` on storage error.
- Deletes the source row via the user client (RLS backstops ownership). Jobs and
  outputs cascade (FK `on delete cascade`).
- Success: `{ "ok": true }`.

---

## Outputs

### `PATCH /api/outputs/[id]` — edit an output

**Auth:** required.

Request body: `{ "content": string }`. Requirements:
- Non-empty string → `400 {"error":"content is required"}`.
- ≤ 100 000 chars → `400 {"error":"Content is too long"}`.
- Output must exist and be owned → `404`.

Writes through the **service client** (no RLS update policy on `outputs`).
If the `updated_at` column is missing (migration not applied) it retries
without it. When an agent-generated output is edited it captures an **edit
signal** (best-effort, fire-and-forget) into the agent's memory.

Success: `{ "ok": true }`.

### `POST /api/outputs/[id]/regenerate` — regenerate an output

**Auth:** required.

- Output must exist and be owned → `404`.
- Format must be one of the registry's LLM formats (`isOutputFormat`, plans
  module) → `400
  {"error":"This output can't be regenerated."}`.
- **Budget:** `regeneration_count` must be `< plan.maxRegenerationsPerJob`
  (atomic optimistic update reserves the slot) → `429 REGENERATION_LIMIT_REACHED`.
- Source must exist → `404`; source must have a transcript → `409.
- Runs `generateOutput` for the same format against the stored transcript with
  the user's resolved prompts.
- Model failure releases the reservation and returns `502` with the error.
- Success: `{ "content": "<new draft>" }` (also bumps `regeneration_count`).

---

## Prompts & brand voice

### `GET /api/prompts`

**Auth:** required.

Returns the user's custom prompts:

```json
{
  "brand_voice": "…",                       // global voice note ("" = none)
  "overrides": { "linkedin_post": "…", "newsletter": "", "shortform_script": "", "thread": "", "carousel": "" }
}
```

`PROMPT_KEYS` = `["linkedin_post", "newsletter", "shortform_script", "thread", "carousel", "brand_voice"]`.
Blank values mean the built-in default applies.

### `POST /api/prompts`

**Auth:** required.

Request body: `{ "format": "<PROMPT_KEYS member>", "prompt": string }`.

- Unknown format → `400`.
- `prompt` must be a string → `400`; ≤ 8000 chars → `400`.
- **Empty/whitespace prompt** deletes the override (restores built-in default):
  `{ "ok": true, "restored": true }`.
- Otherwise upserts (conflict key `user_id,format`): `{ "ok": true, "saved":
  { "format", "prompt" } }`.
- If the `user_prompts` table is missing → `503` with a migration hint.

### `POST /api/prompts/analyze-voice` — synthesize a brand voice

**Auth:** required. No body.

Reads the caller's own drafts (newest sources first, max 6 samples × 2600
chars) and asks Gemini to write one reusable brand-voice description.

- `< 2` usable samples → `{ "ok": false, "code": "NOT_ENOUGH_DATA", "samples": n }`.
- Success: `{ "ok": true, "voice": "<80-160 word description>" }`.
- Generation failure → `502` with the raw message.
- **Never auto-saves** — the client pastes the result into the settings form.

---

## Auth & account

### `GET /api/auth/callback`

Public. Query params: `code`, `next`.
- Exchanges the OAuth `code` for a session (PKCE).
- `next === "reset-password"` is the only allowlisted redirect →
  redirect to `/reset-password`.
- Otherwise redirect to `/dashboard`.

### `GET /api/auth/google/connect` — Sign in with Google

Public (the user is not signed in yet). Redirects to Google's consent screen
(OpenID Connect scopes `openid email profile`) and sets a `google_auth_state`
httpOnly `sameSite=Lax` cookie (600s) carrying `{ state, nonce }` for CSRF
state binding + id_token nonce verification. Reuses `GOOGLE_CLIENT_ID`/`SECRET`.

- **Redirect URI:** `{origin}/api/auth/google/callback` — a *separate* entry from
  the youtube/drive callbacks on the same Google Cloud OAuth client.
- `GOOGLE_CLIENT_ID` missing → `503 {"error":"Google OAuth is not configured."}`.

### `GET /api/auth/google/callback`

Public OAuth callback. Query: `code`, `state`, optional `error`.

- Consent denied → `/login?google=denied&reason=denied`.
- State mismatch / missing code → `/login?google=error&reason=state`
  (constant-time compare).
- Exchanges the code for an id_token, then
  `supabase.auth.signInWithIdToken({ provider: "google", token, nonce })` —
  Supabase verifies the token (incl. nonce claim) and auto-creates/links the
  user, and the session cookie is persisted onto the response.
- Success → `/dashboard`. Config missing → `?google=error&reason=config`; other
  failures → `?google=error&reason=failed`.
- No provider-level redirect registration beyond the Google console entry;
  the Google provider must be enabled in the Supabase dashboard.

### `GET /api/account/export`

**Auth:** required.

Returns the caller's personal data:

```json
{
  "exportedAt": "ISO",
  "userId": "uuid",
  "sources": [ … ], "outputs": [ … ], "jobs": [ … ], "prompts": [ … ]
}
```

Any of the four tables may be empty arrays.

### `PATCH /api/account/delete`

**Auth:** required.

Deletes the caller's Supabase user via the **service-role admin API**
(`auth.admin.deleteUser`). All owned rows cascade. Success: `{ "ok": true }`.

---

## Recommendations

### `GET /api/recommendations?sourceId=<uuid>`

**Auth:** required.

Returns ranked, explainable output recommendations for a source's
`content_intelligence`, based on a deterministic objective:

- `sourceId` query param required → `400`.
- Intelligence row must exist and be owned (either by `user_id`, or the
  referenced source owned by the user) → `404 {"error":"Content intelligence
  not found or not accessible"}`.
- Objective resolved from `user_preferences.current_objective` if stored,
  otherwise `get_reach`.

Response:

```json
{
  "recommendations": [ { "…": "enriched, scored recommendations" } ],
  "objective": { "kind": "get_reach", "label": "Get more reach" },
  "sourceId": "uuid"
}
```

Objective kinds: `get_reach | grow_linkedin | grow_email | clarify_ideas |
drive_action`. The engine is deterministic (no LLM).

---

## Usage & billing

### `GET /api/usage` — usage snapshot

**Auth:** required.

```json
{
  "usage": {
    "plan": "beta", "planName": "Beta",
    "used": 2, "limit": 5, "remaining": 3, "percent": 40, "atLimit": false,
    "resetAt": "…", "windowLabel": "…",
    "maxInputMinutes": 30, "maxInputSeconds": 1800,
    "maxOutputsPerJob": 3, "maxRegenerationsPerJob": 2
  }
}
```

The job count is reactive/display-grade (excludes refunded jobs in the current
UTC month); enforcement is separate and atomic (see `/api/repurpose`).

### `GET /api/usage/spend` — daily spend & error rate

**Auth:** required.

```json
{ "spend": { "…": "aggregate from usage_events" }, "errorRate": { "…": "…" } }
```

### `POST /api/billing/checkout` — start a Paddle checkout

**Auth:** required.

Request body: `{ "plan": "creator|pro|studio" }`.

- Invalid plan → `400`.
- Paddle not configured (`PADDLE_API_KEY`/`PADDLE_WEBHOOK_SECRET` missing) →
  `503 {"error":"Billing is not configured yet"}`.
- No price id for the plan → `503`.
- Success: `{ "url": "<Paddle Checkout transaction url>" }`.

### `POST /api/billing/webhook` — Paddle webhook

**Public** (caller-authenticated by signature). Reads the **raw** body.

- Signature header `Paddle-Signature: ts=<unix>;h1=<hex>` — HMAC-SHA256 over
  `${ts}:${rawBody}` with the notification-destination secret, verified within
  a 5s replay window → `401` if missing config or bad signature.
- Invalid JSON → `400`.
- Applies events idempotently (upsert keyed on `provider_subscription_id`,
  `subscription_events.paddle_event_id` dedup): activates `profiles.plan`,
  downgrades on cancel, flags past_due/paused.
- Always ack `200 {"ok":true}` once applied.

---

## Analytics events

### `POST /api/events`

**Auth:** required. Thin server-side bridge — clients can never write the
`events` table directly.

Request body: `{ "name": string, "properties"?: object }`.

- `name` must be a known allowlisted event → `400` otherwise.
- Writes via the service role and attributes the session user. Success:
  `{ "ok": true }`.

Known event names:

```
signup_completed  first_job_started  first_job_completed  job_failed  job_retried
limit_reached  usage_50_percent  usage_80_percent  usage_100_percent
regeneration_used  draft_opened  draft_copied  waitlist_clicked
save_button_clicked  recommendations_viewed  recommendation_selected
agent_decision_requested  agent_plan_approved  generation_started
generation_completed  publish_started  publish_completed
orch_run_created  orch_context_loaded  orch_recommendations_ready  orch_plan_created
orch_approval_requested  orch_plan_approved  orch_plan_rejected
orch_execution_started  orch_step_completed  orch_run_completed
orch_run_failed  orch_run_cancelled
```

---

## Notifications

In-app notification rows, **created server-side only** (service-role writer in
`lib/notifications/`; the browser can read and mark-read, never create/edit/
delete — there are no write policies on `notifications`). Delivery is Supabase
Realtime (INSERT changes, RLS-filtered) plus a 30 s poll + `visibilitychange`
refresh in the UI. Full design, taxonomy, and dedupe semantics:
`docs/NOTIFICATION_ARCHITECTURE.md` (status: implemented — reconciled 2026-09-12
after the security re-audit).

### `GET /api/notifications` — list (paginated, unread-counted)

**Auth:** required.

Query parameters:

| param | type | default | notes |
|---|---|---|---|
| `limit` | int | 20 | clamped to `[1, 50]` |
| `cursor` | string | — | opaque keyset `${encodeURIComponent(createdAt)}|${id}` from a previous `nextCursor`; garbage → newest page |
| `unreadOnly` | bool | false | `"true"` filters to `read_at is null` |
| `type` | string | — | single taxonomy type (`source.ready`, `agent.started`, …); unknown type → empty list |

Response `200` — rows are camelCase domain records; `nextCursor` is always
present (`null` = last page):

```json
{
  "notifications": [ { "id", "userId", "type", "title", "body", "severity",
                       "entityType", "entityId", "actionUrl", "metadata",
                       "dedupeKey", "expiresAt", "readAt", "createdAt" } ],
  "nextCursor": "… | null",
  "unreadCount": 3
}
```

- `unreadCount` is present on every page (including empty ones).
- Table missing (migration `20260912000001_notifications.sql` not applied) →
  fails **open**: `200 { "notifications": [], "nextCursor": null, "unreadCount": 0 }`.
- `401 {"error":"Not signed in"}`; `500` on DB error.

### `POST /api/notifications/[id]/read` — mark one read

**Auth:** required. Body `{}` (empty body tolerated).

- Empty `id` (after trim) → `400 {"error":"Missing notification id"}`.
- Non-UUID `id` → `404 {"error":"Notification not found"}` **before** the RPC
  (same indistinguishable posture as a row the caller doesn't own, so
  existence is never leaked).
- Calls security-definer RPC `notifications_mark_read(p_id uuid)` (ownership
  checked in-body) on the user client. RPC returns `false` (row missing / not
  owned) → `404 {"error":"Notification not found"}`.
- Missing RPC → `503` fail-closed with a migration hint
  (`"Notifications are not available yet — the notifications migration has not
  been applied."`); other RPC errors → `500`.
- Success → `200 {"ok": true}`.

### `POST /api/notifications/read-all` — mark all read

**Auth:** required. Body `{}`. Calls `notifications_mark_all_read()` (returns
the integer row count). Success → `200 {"ok": true, "marked": 3 | null}`; same
503/500 paths as above.

---

## Agentic API

The agent layer (`/agent`) plans 3–7 content angles from a transcript, parks
them for human approval, then generates + deterministically evaluates drafts
straight into the existing `outputs` table. Modes: `assist | execute |
automate`. Run statuses: `created | planning | awaiting_approval | executing |
evaluating | done | failed | cancelled`.

### `POST /api/agent/runs` — create a run

**Auth:** required.

Request body: `{ "sourceId": "uuid", "mode?" : "assist|execute|automate" }`
(default mode `assist`).

- Source must exist & be owned → `404`.
- Source status must be `done` or `failed` (needs a transcript) → `409
  {"error":"Source is still processing — the agent needs the transcript first."}`.
- Seeds the user's agent-memory row; snapshots the plan's agent budget onto the
  run (`max_steps`, `max_cost_units`, `max_runtime_s`).
- `v4_agent_runs` table missing → `503` with a schema hint.
- Success `201`: `{ "ok": true, "run": { "id", "status":"created", "mode",
  "created_at", "max_steps", "max_cost_units", "max_runtime_s" } }`.

### `GET /api/agent/runs` — list runs

**Auth:** required.

`{ "runs": [ { …run…, "sourceTitle": "…" } ] }` — newest first, max 50,
each augmented with its source title. Missing schema → `{ "runs": [] }`.

### `GET /api/agent/runs/[id]` — run detail

**Auth:** required. `404` if not owned.

```json
{
  "run": { "…": "full v4_agent_runs row" },
  "ideas": [ { "…": "v4_content_ideas rows, by sort_order" } ],
  "steps": [ { "…": "v4_agent_steps rows, by created_at" } ],
  "outputs": [ { "…": "outputs rows referenced by run.output_ids" } ],
  "signals": [ "…recent memory signals…" ],
  "monthlySpend": { "…": "token/cost aggregation or null" }
}
```

### `POST /api/agent/runs/[id]/approve` — the human gate

**Auth:** required.

Request body:

```json
{
  "approval": "approved | rejected",
  "ideas": [ { "id": "uuid", "approved": true, "title?": "…", "description?": "…" } ]
}
```

- Run must be owned and in `awaiting_approval` (else `409`).
- `approval` must be `approved`/`rejected` → `400`; empty `ideas` array → `400`.
- Per-idea flags + optional title/description edits are persisted (edits only
  apply to kept ideas); decisions are recorded as durable memory signals.
- Run → `executing` if any idea kept, else `cancelled`.
- Success: `{ "ok": true, "status": "executing|cancelled" }`.
- A later `POST /api/agent/process` picks the run up.

### `POST /api/agent/runs/[id]/cancel`

**Auth:** required. Cancels any non-terminal run (`created|planning|
awaiting_approval|executing|evaluating`). Terminal runs return idempotently:
`{ "ok": true, "status": "<existing>", "alreadyTerminal": true }`.
Success: `{ "ok": true, "status": "cancelled" }`.

### `POST /api/agent/process` — agent worker (SSE)

**Auth:** required. **SSE**

Request body: `{ "runId": "uuid" }` → `400` if missing; run must be owned →
`404`.

Same SSE format as `/api/process`. Re-POSTing resumes the run from wherever it
parked (`awaiting_approval` → resumes execution after approval; fresh →
planning). Mirrors the job claim/resume semantics (10-min stale window, service
client, durable `v4_agent_steps` timeline). Modes gate tools via
`lib/agent/permissions.ts` + the tool registry.

### `GET` / `PUT /api/agent/preferences` — agent memory

**Auth:** required.

`GET` → `{ "autoMode": "assist|execute|automate", "brand": { "tone": "…",
"forbiddenPhrases": [], "examples": [] }, "brandSamples": "…|null",
"suggestions": [ "…confidence-gated suggestions…" ] }`. Missing row → defaults
with `suggestions: []`.

`PUT` partial updates **explicit user edits only** (never auto-applied):

```json
{ "autoMode?": "assist|execute|automate", "tone?": string,
  "forbiddenPhrases?": string[], "examples?": string[], "brandSamples?": string|null }
```

- Unknown `autoMode` → `400`; empty patch → `400 {"error":"Nothing to update"}`
- Writes through the service client; each changed field is recorded as a memory
  signal. Success: `{ "ok": true }`.

### `POST /api/agent/preferences/confirm` — apply a suggested tone

**Auth:** required.

Request body: `{ "field": "tone", "value": string }`.

- Only `field: "tone"` is confirmable in V1 → `400`.
- Recomputes suggestions from the stored edit signals before applying (a stale
  or forged suggestion can't be applied). No matching suggestion → `404`.
- Applies `value` to `brand_tone`. Success: `{ "ok": true }`.

### `GET` / `POST /api/agent/strategy` — strategy docs

**Auth:** required.

`GET` → `{ "strategies": [ …v4_content_strategies rows, newest 20 ] }`.
Missing table → `{ "strategies": [] }`.

`POST` → regenerates a heuristic strategy seed immediately (user-triggered
only). Success: `{ "ok": true, "strategyId": "uuid", "body": "…" }`;
failure → `400`.

### `GET` / `POST /api/agent/strategy/next` — “what should I publish next?”

**Auth:** required.

`GET` (passive, no LLM, no write): `{ "ok": true, "strategyId": "uuid|null",
"recommended": {…} | null, "ranked": [ … ], "exclusions": [ … ], "headroom":
{…}, "rationale": "<latest snapshot rationale>|null", "monthlySpend": {…}|null }`.

`POST` (adds ONE bounded LLM-assisted rationale from the deterministic ranking,
then persists an append-only `v4_content_strategies` snapshot with
`source: "planner"`; rationale failure never blocks the recommendation). Same
response shape, with the fresh `rationale` + `strategyId`. Never forks the
orchestrator flow — the response carries `recommended.sourceId` + `mode` for
`POST /api/agent/runs`.

### `GET /api/agent/observe` — insights funnel

**Auth:** required. Computed from real server data (bounded retention window).

```json
{
  "ok": true,
  "funnel": { "runs": n, "steps": n, "drafts": n, "approvedDrafts": { … } },
  "spend": { "…": "token/cost aggregation" },
  "estimatedCostUsd": "…|null",
  "strategyDocs": n, "lastStrategyAt": "…|null",
  "publishingConnected": false, "engagementAvailable": false, "hasAnyData": bool,
  "historyWindowMs": 2592000000,
  "note": "…"
}
```

Engagement/performance analytics are always flagged unavailable when no
publishing channel is connected — never fabricated.

### `GET /api/agent/scale` — scale/permission surface

**Auth:** required.

```json
{ "ok": true, "planId": "beta", "planName": "Beta",
  "…": "structural summary of the permission model (no autopilot door exists)" }
```

### `GET /api/agent/queue` — publish queue

**Auth:** required.

```json
{
  "ok": true,
  "publishable": [ { "id", "runId", "format", "preview", "createdAt" } ],
  "jobs": [ { "id", "runId", "outputId", "platform", "status",
              "statusLabel", "blockReason", "scheduledAt", "publishedAt",
              "externalId", "errorMessage", "createdAt", "updatedAt",
              "preview", "format" } ],
  "channelsConnected": false,
  "notConnectedMessage": "…",
  "historyWindowMs": …,
  "note": "…"
}
```

`publishable` = drafts from `done` runs not yet covered by a distribution job.
Job statuses: `draft | scheduled | published | failed | cancelled`.

### `POST /api/agent/queue/publish` — manual send / queue

**Auth:** required. **Manual-approval only.**

Request body:

```json
{
  "outputId": "uuid",                       // required
  "platform": "linkedin|x|newsletter|youtube_shorts|tiktok|instagram",
  "confirm": true,                          // REQUIRED — the single approval step
  "mode": "queue | send",                   // default "queue"
  "profileIds": [ "profile-ids" ],          // optional, max 20 (send mode)
  "scheduledAt": "ISO-8601"                 // optional (send mode)
}
```

- Unknown platform → `400`; `confirm !== true` → `400`.
- Output must exist and be owned → `404`.
- **`mode: "queue"`** — records a `v4_distribution_jobs` row in `scheduled`
  (pending human approval). Never auto-advances, never reaches a provider.
  Response: `{ "ok": true, "job": {…}, "status": "scheduled",
  "channelsConnected": bool, "publishBlockedMessage": "…|null" }`.
- **`mode: "send"`** — gate 1: a real Buffer channel must be connected →
  else `503 {"ok": false, "error": "…", "code": "PUBLISH_NOT_CONNECTED",
  "channelsConnected": false}`. Gate 2: posts to Buffer via the distribution
  tool (optionally to chosen `profileIds`, at `scheduledAt`). Success →
  `{ "ok": true, "updateId": "…", "channelsConnected": true }`; failure →
  `502 {"ok": false, "error": "…", "code": "PUBLISH_FAILED"}`.
- Immediate send → job `published` (external_id + published_at). Future send →
  stays `scheduled` with `external_id` + `scheduled_at` — never a fabricated
  `published` state.

### `GET /api/agent/posts?status=<comma-separated>` — Buffer posts for repurposing

**Auth:** required. Lists the caller's Buffer posts via the MCP connector
(`list_posts`, 100/organization) for the "repurpose an existing post" picker.

- No Buffer API key → `503 {"ok":false,"error":"…","code":"NO_BUFFER_API_KEY"}`.
- MCP failure → `502 {"ok":false,"error":"…","code":"rate_limited|buffer_error"}`.

Response: `{ "ok": true, "posts": [ { "id", "status", "text", "preview",
"channelName", "channelService", "dueAt", "sentAt", "createdAt" } ] }`.

### `POST /api/agent/repurpose` — repurpose a Buffer post as a new run

**Auth:** required. Body: `{ "postId": string, "mode?": "assist|execute|automate" }`
(default `assist`).

- `postId` missing → `400`.
- No Buffer API key → `503 {"error":"…","code":"NO_BUFFER_API_KEY"}`.
- Post fetch fails → `502`; the post has no text → `422 {"error":"That Buffer
  post has no text to repurpose."}`.
- Creates a transcript-style `sources` row (marker `storage_path`) → canonical
  `transcripts` row → seeds memory + budget snapshot → inserts a `v4_agent_runs`
  row. Missing agent schema → `503` with a schema hint.
- Success `201`: `{ "ok": true, "sourceId": "uuid", "run": { "id", "status":
  "created", "mode", "created_at", "max_steps", "max_cost_units",
  "max_runtime_s" } }`.

### `POST /api/agent/metrics/refresh` — refresh post metrics

**Auth:** required. Pulls fresh Buffer `list_posts` metrics onto the user's
`v4_distribution_jobs` (`metrics` + `metrics_refreshed_at`), capped at 4×100.

- No Buffer API key → `503 {"ok":false,"error":"…","code":"NO_BUFFER_API_KEY"}`.
- Failure → `502 {"ok":false,"error":"Metrics refresh failed."}`.
- Success: `{ "ok": true, …refreshRunMetrics result… }` (jobs iterated, per-job
  status, errors list).

### `GET /api/agent/runs/[id]/graph` — run workflow graph

**Auth:** required. Rebuilds the authoritative workflow graph for one run from
durable state (source, ideas, steps, outputs, distribution jobs, intelligence
counts) — never persisted, rebuilt on every read. `404` if the run isn't owned.

Response: `{ "graph": { "nodes": [ … ], "edges": [ … ] } }` (maps 1:1 to the
React Flow canvas; intelligence returns counts only — never transcript/evidence
text).

---

## YouTube integration

Google OAuth (YouTube Data API v3) to import a connected channel's own video
captions. Refresh tokens are AES-256-GCM encrypted at rest.

- **Scopes:** `youtube.readonly` + `youtube.force-ssl`, `access_type=offline`,
  `prompt=consent` (guaranteed refresh token).
- **Redirect URI:** `{origin}/api/integrations/youtube/callback` must be in the
  Google Cloud console.
- The refresh token never leaves the server; the browser only ever gets the
  authorize URL.

### `GET /api/integrations/youtube/connect`

**Auth:** required. Redirects to Google consent; sets an `yt_oauth_state`
httpOnly `sameSite=Lax` cookie (600s) for CSRF state binding.

### `GET /api/integrations/youtube/callback`

Public OAuth callback. Query: `code`, `state`, optional `error`.

- Consent denied → redirect `/upload?youtube=denied`.
- Not signed in → `/login?next=/upload&message=Connect-YouTube-after-login`.
- State mismatch / missing code → `/upload?youtube=error`. State checked with a
  constant-time compare.
- Exchanges code (PKCE), fetches the channel, persists encrypted tokens
  (one row per user) → `/upload?youtube=connected`. Config missing →
  `/upload?youtube=config`.
- Deletes the `yt_oauth_state` cookie.

### `GET /api/integrations/youtube/status`

**Auth:** required.

```json
{ "connected": true, "channelId": "…", "channelTitle": "…" }
```

Channel name only — tokens never returned.

### `GET /api/integrations/youtube/videos`

**Auth:** required. The user's recent uploads for the picker (25 items).

- Not connected → `400 {"error":"YouTube is not connected."}`.
- Token refresh failure → `502 {"error":"YouTube access expired — reconnect your
  channel."}`.
- Fetch failure → `502`.

Response: `{ "videos": [ { "id", "title", "…" } ] }`.

### `DELETE /api/integrations/youtube/disconnect`

**Auth:** required. Deletes the connection row (and encrypted tokens).
`{ "ok": true }`.

---

## Google Drive integration

Google OAuth (Drive API v3) to read a connected user's Drive files for intake.
Reuses the **same Google Cloud OAuth client** as YouTube
(`GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`) with the `drive.readonly` scope.
Tokens are AES-256-GCM encrypted at rest with the same
`YOUTUBE_TOKEN_ENCRYPTION_KEY`.

- **Redirect URI:** `{origin}/api/integrations/drive/callback` — this is a
  **separate entry** from the YouTube callback in the Google Cloud console.
- `access_type=offline` + `prompt=consent` (guaranteed refresh token).

### `GET /api/integrations/drive/connect`

**Auth:** required. Redirects to Google consent; sets a `gd_oauth_state` httpOnly
`sameSite=Lax` cookie (600s) for CSRF state binding. `GOOGLE_CLIENT_ID` missing →
`503 {"error":"Google OAuth is not configured."}`.

### `GET /api/integrations/drive/callback`

Public OAuth callback. Query: `code`, `state`, optional `error`.

- Consent denied → `/connections?success=drive&error=denied`.
- Not signed in → `/login?next=/connections&message=Connect-Drive-after-login`.
- State mismatch / missing code → `/connections?success=drive&error=state`
  (constant-time compare).
- Exchanges the code, fetches the account (email/name), persists encrypted
  tokens (one row per user) → `/connections?success=drive`. Config missing →
  `?error=config`; other failures → `?error=failed`.
- Deletes the `gd_oauth_state` cookie.

### `GET /api/integrations/drive/status`

**Auth:** required.

```json
{ "connected": true, "email": "…", "name": "…" }
```

Account name/email only — tokens never returned.

### `DELETE /api/integrations/drive/disconnect`

**Auth:** required. Deletes the connection row (and encrypted tokens).
`{ "ok": true }`.

---

## Buffer integration

"Bring Your Own Buffer" publishing — two deliberately separate auth paths:

- **OAuth (PKCE S256)** → manual "Send now"/"Schedule" from the publish queue
  (GraphQL), gated by a human click.
- **API key (MCP)** → the agent's scheduling, repurpose-from-post, and post
  metrics over Buffer's MCP connector (`mcp.buffer.com/mcp`).

Tokens and API keys are AES-256-GCM encrypted at rest.

- **Redirect URI:** `{origin}/api/integrations/buffer/callback`.
- Needs `BUFFER_CLIENT_ID/SECRET` + a stable `BUFFER_TOKEN_ENCRYPTION_KEY`.

### `GET /api/integrations/buffer/connect`

**Auth:** required. Redirects to Buffer consent (auth.buffer.com, S256 PKCE).
Sets a `buffer_oauth_state` cookie (`{state, verifier}`, httpOnly, Lax, 600s) —
the cookie is the only holder of the PKCE verifier.

### `GET /api/integrations/buffer/callback`

Public OAuth callback. Query: `code`, `state`, optional `error`.

- Denied → `/connections?success=buffer&error=denied`.
- Not signed in → `/login?next=/connections&message=Connect-Buffer-after-login`.
- State/verifier mismatch → `/connections?success=buffer&error=state`
  (constant-time state check).
- Exchanges code with the verifier, fetches the Buffer user, persists encrypted
  tokens → `/connections?success=buffer`. Errors → `?error=config|failed`.

### `GET /api/integrations/buffer/profiles?platform=<id>`

**Auth:** required. Lists the caller's Buffer profiles, optionally narrowed to a
platform's Buffer service id.

- Not connected → `404 {"ok": false, "error": …,
  "code":"PUBLISH_NOT_CONNECTED"}`.
- Success: `{ "ok": true, "platform": "<service id or null>", "profiles":
  [ { "id", "service", "username", "avatar", "default" } ] }`.
- Failure → `502 {"ok": false, "error", "code":"PROFILES_FAILED"}`.

### `DELETE /api/integrations/buffer/disconnect`

**Auth:** required. Deletes the connection row (and encrypted tokens).
`{ "ok": true }`.

### `GET` / `PUT` / `DELETE /api/integrations/buffer/api-key` — MCP connector key

**Auth:** required. Manages the per-user Buffer API key
(`publish.buffer.com/settings/api`) that authenticates the agent's MCP connector
(agent scheduling, repurpose-from-post, metrics). Encrypted at rest; the key
never leaves the server — this surface only reports whether one exists.

- `GET` → `{ "ok": true, "hasApiKey": boolean }`.
- `PUT` body `{ "apiKey": string }` → saves/overwrites. Rejects an empty key →
  `400`; `buffer_connections.api_key` column missing (migration `20260910000001`
  not applied) → `503` with a hint; `BUFFER_TOKEN_ENCRYPTION_KEY` missing →
  `500` with a config hint. Success → `{ "ok": true, "hasApiKey": true }`.
- `DELETE` → drops the key (any OAuth connection is untouched) →
  `{ "ok": true, "hasApiKey": false }`.

An api-key-only row uses sentinel OAuth values (`buffer_account_id='api-key'`,
blank `access_token`) so it is **never** treated as an OAuth connection — manual
GraphQL "Send now" stays OAuth-gated.

---

## Health & diagnostics

### `GET /api/healthz` — liveness + readiness probe

**Public.** Lightweight Supabase reachability check (3s timeout) plus env
region/commit. `200` when the DB responds, `503` when degraded:

```json
{ "status": "ok|degraded", "ok": boolean, "service": "verv-ai-backend",
  "version": "0.1.0", "db": "ok|degraded", "region": "...|null",
  "commit": "...|null", "time": "ISO" }
```

### `GET /api/healtz` — liveness probe

**Public.** Minimal reachability ping (e.g.
`https://vervai.onrender.com/api/healtz`), always `200`:

```json
{ "status": "ok", "ok": true, "service": "verv-ai-backend", "time": "ISO" }
```

### `GET /api/integrations/debug` — OAuth diagnostics

**Auth:** required. Prints the **exact redirect URIs** that must be registered in
each provider console (directly diagnoses `redirect_uri_mismatch`), plus env
presence — never secrets:

```json
{
  "env": { "nextPublicAppUrl": "...|null", "requestOrigin": "...",
           "effectiveBase": "..." },
  "google": { "clientId": bool, "clientSecret": bool },
  "buffer": { "clientId": bool, "clientSecret": bool, "encryptionKey": bool,
              "youtubeEncryptionKey": bool },
  "redirectUris": { "youtube": "...", "drive": "...", "buffer": "..." },
  "hint": "…"
}
```

`effectiveBase` shows the origin `NEXT_PUBLIC_APP_URL` resolves to (a
localhost/private pin reaching a public request is ignored in favor of the real
request origin).

---

## Rate limits & safety rails

Configurable via env (`lib/limits.ts`, `lib/rate-limit.ts`):

| Rail | Default | Enforcement |
|---|---|---|
| Max source file size | 200 MB (`MAX_SOURCE_FILE_MB`) | client + worker |
| Max input duration | 2 h (`MAX_INPUT_SECONDS`) | worker (plan-aware `maxInputMinutes`) |
| Enqueue rate limit | 10/min/user (`REPURPOSE_RATE_LIMIT_PER_MIN`) | `/api/repurpose`, `429` + `Retry-After` |
| Monthly job cap (plan) | beta 5, creator 20, pro 75, studio ∞ | atomic `enqueue_job` RPC |
| Outputs per job (plan) | 3 / 5 / 6 / 10 | `/api/repurpose` + RPC |
| Regenerations per output (plan) | 2 / 5 / 10 / 25 | `/api/outputs/[id]/regenerate` |
| Agent run budgets (plan) | steps 50/60/80/100, cost 2500/5000/10000/20000, runtime 1800/2700/3600/5400 s | snapshotted on `v4_agent_runs` |

- File extension/MIME allowlists are strict; unknown MIME passes only when the
  extension gate holds. Text-subtitle/document/image kinds ride the
  `transcript` `source_type`.
- **Idempotency:** client `idempotencyKey` on `/api/repurpose` (partial unique
  index `(user_id, idempotency_key)`); content hash dedupe on `sources`
  (`sources_user_type_hash_unique`).

---

## Data model

Source of truth: `supabase/migrations/`. All tables in the `public` schema;
every user-owned table has per-user RLS (`auth.uid() = user_id`).

### Core tables

| Table | Purpose | Key notes |
|---|---|---|
| `sources` | One input per row | `source_type` `audio\|video\|youtube\|transcript`; `status` `uploaded\|transcribing\|transcribed\|generating\|done\|failed`; `storage_path` for files, `source_url` for YouTube/URLs; `content_hash` dedupe |
| `outputs` | Generated drafts | `format` `linkedin_post\|newsletter\|shortform_script\|thread\|carousel`; `content`; `regeneration_count`; **no client update policy** |
| `jobs` | Async queue | `status` `queued\|running\|done\|failed`; `formats text[]`; `idempotency_key`; `refunded`; `attempt` |
| `transcripts` | Canonical transcript per source | `unique (source_id)`; `provider` `assemblyai\|youtube_captions\|transcript_file` |
| `user_prompts` | Prompt overrides + brand voice | PK `(user_id, format)` |
| `youtube_connections` | YouTube OAuth | `unique (user_id)`; tokens AES-GCM encrypted |
| `drive_connections` | Google Drive OAuth | `unique (user_id)`; tokens AES-GCM encrypted (same key as YouTube) |
| `buffer_connections` | Buffer OAuth + MCP key | `unique (user_id)`; tokens + `api_key` AES-GCM encrypted |
| `notifications` | In-app notification rows | **SELECT-only RLS** (own rows); service-role writes only; mark-read via security-definer RPCs `notifications_mark_read(uuid)→boolean` / `notifications_mark_all_read()→integer`; `unique (user_id, dedupe_key)` |
| `content_intelligence` | Grounded analysis per source | `unique (source_id)`; `intelligence jsonb` + `provenance` |
| `profiles` | Billing plan | **service-role write only**, read-own only |
| `events` | Analytics ledger | RLS on, **no policies** (service-role write) |
| `usage_events` | Billable ledger | `action` `reserve\|consume\|refund\|release`; **no client policies** |
| `subscriptions` | Paid billing contract | select-own only; status incl. `paused` |
| `subscription_events` | Provider/webhook log | `paddle_event_id` dedup; **no client policies** |

### Agentic `V4_*` tables

| Table | Purpose | Key notes |
|---|---|---|
| `v4_agent_runs` | Durable run | `status` `created\|planning\|awaiting_approval\|executing\|evaluating\|done\|failed\|cancelled`; `mode` `assist\|execute\|automate`; budgets + `heartbeat_at` |
| `v4_agent_steps` | Append-only timeline | `kind` `planning\|source\|generation\|review\|distribution\|strategy` |
| `v4_content_ideas` | Planned angles + evaluation | `approved`, `evaluation jsonb`, `suggested_formats[]` |
| `v4_agent_preferences` | Stage 2 memory | `unique (user_id)`; `edit_signals jsonb`, brand voice fields |
| `v4_distribution_jobs` | Publish queue | `status` `draft\|scheduled\|published\|failed\|cancelled`; `platform` check |
| `v4_content_strategies` | Strategy docs | `unique (user_id, title)`; `source` `heuristic\|planner\|manual` |

### Storage

Private bucket `sources`; objects at `sources/{user_id}/{filename}` (uploads)
and `sources/{user_id}/youtube/{ts}-{name}.mp3` (YouTube fallback). Storage
policies key the first folder segment to `auth.uid()`.

### Key DB function

`public.enqueue_job(p_user_id, p_source_id, p_formats, p_idempotency_key,
p_max_jobs_per_month, p_max_outputs_per_job)` — one transaction serialized per
user (advisory xact lock): idempotent replay → output-cap check → monthly-cap
check → job insert → `reserve` ledger write. Returns `(job_id, created_new,
jobs_used, jobs_limit_reached, error_code)`. Execute privilege is granted to
`service_role` only.