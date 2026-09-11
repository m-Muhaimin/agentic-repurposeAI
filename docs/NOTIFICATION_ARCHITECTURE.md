# Notification Architecture — VervAI in-app notifications

> **Status: implemented — reconciled 2026-09-12 (re-reconciled after the
> security re-audit of 2026-09-12: per-user dedupe keys, 404-on-non-UUID read).**
> This document describes the shipped system as it exists: migration
> `20260912000001_notifications.sql`, the `lib/notifications/` service, the
> three API routes, the frontend (`components/notifications/`), and every
> emitter call site (§13). Drift between the original plan and the
> implementation is corrected in place; the specific deltas are itemised in
> §13.2. Read with `docs/ARCHITECTURE_FREEZE.md` (locked runtime contracts)
> and `docs/IMPLEMENTATION_MAP.md` (ground truth).

The in-app notification system surfaces domain transitions (agent runs, source
processing, generation, publishing, usage limits) to the user as durable rows in
a `notifications` table, delivered to the UI via Supabase Realtime with a
polling fallback. It is a **read-and-act surface over existing domain state** —
it introduces no new state machine, no new worker, and no new event bus.

---

## 1. Architecture overview

```
VervAI DOMAIN STATE ──► DOMAIN EVENT ──► NOTIFICATION SERVICE ──► notifications TABLE (durable source of truth)
                                                                          │
                                                                          ├─► (optionally) Supabase Realtime ──► In-App UI
                                                                          │
                                                                          └─► (future) Database Webhook ──► Edge Function ──► Email/Push
```

Principles, in freeze order:

- **The browser and the React flow are NEVER the source of truth.** A
  notification exists only when the backend/domain state transitions and the
  notification service persists a row. The UI renders rows; it does not invent
  them. This mirrors the existing `sources`/`job` model where
  `docs/IMPLEMENTATION_MAP.md` §1.5 holds `jobs` as the durable queue and the
  dashboard only reflects it.
- **Trending: the domain event is an explicit, typed call site, not an
  ambient mechanism.** Emitters call into the notification service at the same
  place they already mutate domain state (worker, orchestrator, distribution
  tool, enqueue path). There is no pub/sub bus between domains; see the
  "event bus" exclusion in the appendix.
- **Database webhooks are explicitly NOT the core notification mechanism.**
  They are a *future, optional* external-delivery path (§11). In-app delivery
  is: persist → Realtime → render, with DB polling as the safety net.
- **Fail-open** for the app, **fail-closed-secure** for the data: a
  notification write failure never breaks a domain operation (§10), while the
  `notifications` table is unreadable/writable by any client except through
  the sanctioned RLS + RPC seams (§5).

The notification service is the only component that touches the
`notifications` table. It reuses the repo's existing service-role write
pattern verbatim: `lib/analytics/events.ts::track` (try/catch, log-only on
failure, never throw into the product path) and `lib/logger.ts` for the JSON
log line.

---

## 2. Notification lifecycle

```
domain transition (worker / orchestrator / approve+cancel routes / distribution
                   tool / schedule tool / queue route / enqueue / Paddle webhook)
        │  (after domain write commits)
        ▼
typed builder in lib/notifications/events.ts (notifyAgentRunChanged /
notifySourceChanged / notifyContentGenerated / notifyPublishChanged /
notifyUsageLimit / notifyBillingEvent) → NotificationInput
        │
        ▼
createNotification()  — the ONLY writer (lib/notifications/create.ts)
  1. validate   — type ∈ taxonomy allowlist (§3); userId present; severity ∈
                  check-constraint set; actionUrl passes isSafeActionUrl;
                  metadata JSON-safe and ≤ 2048 bytes; dedupeKey ≤ 255 chars.
                  Any violation → `notification.rejected` log, return null.
  2. sanitize   — trim title/body/entity fields; strip control chars (body
                  keeps \n); truncate title ≤ 160, body ≤ 1000, entity_type
                  ≤ 255, entity_id ≤ 128.
  3. dedupe     — if dedupeKey set: `.upsert(..., { onConflict:
                  "user_id,dedupe_key", ignoreDuplicates: true }).select()
                  .single()` (§8). The unique constraint swallows a duplicate →
                  PostgREST error PGRST116 → re-select the existing row and
                  return it as the record. (The installed postgrest-js 2.115.0
                  dropped the chainable `.insert().onConflict().
                  ignoreDuplicates()` API; `.upsert()` emits the identical wire
                  request.)
  4. insert     — service-role client (`createServiceClient`,
                  `lib/supabase/server.ts:38`) — RLS is bypassed, so this is
                  the ONLY path that can write. Never from a client bundle.
  5. no server broadcast — durability is satisfied by step 4 (persist-first).
                  Delivery is passive via the supabase_realtime publication
                  (§6): the browser's own postgres_changes subscription sees
                  the commit and merges it. There is no server-side push step
                  that can fail.
        │
        ▼
Realtime postgres_changes INSERT (filter user_id=eq.<uid>, RLS-filtered) ──► UI reconcile
        │
        ▼
UI state: merge by id — a row already in local state with the same id is
replaced, not re-added (id-based client dedup covers overlapping realtime +
poll + load-more responses).
        │
        ▼
mark-read: POST /api/notifications/[id]/read or /read-all →
security-definer RPC (§5) sets read_at.
```

Emitters are one-line calls placed *after* the domain write commits, so a
notification always reflects persisted state and a notification failure can
never roll back the domain transition. Worker ↔ orchestrator ↔ distribution
each gain a small set of emit sites; they do not learn about the
notifications table itself.

---

## 3. Domain event taxonomy

`type` is the allowlist enforced by `validate()` in `createNotification`.
Unknown types are dropped with a `notification.rejected` log (see §12) — the
taxonomy is the contract, not a free-text column.

| type | severity | wiring | dedupe | notes |
|---|---|---|---|---|
| `agent.started` | info | **EMITTED** — planning→executing transitions: approve route with ≥1 kept idea (`status: "executing"`, `app/api/agent/runs/[id]/approve/route.ts:136`) and automate auto-approval inside `runPlanning` (`lib/agent/orchestrator.ts:331`) | `agent.agent.started:agent_run:<userId>:<runId>` | a run that re-enters executing (resume after claim) re-fires; the per-run key makes it a no-op |
| `agent.awaiting_approval` | info | **EMITTED** — `runPlanning` parks at `awaiting_approval` (`lib/agent/orchestrator.ts:331`, human path) | `agent.agent.awaiting_approval:agent_run:<userId>:<runId>` | a re-park of the same run must not notify twice |
| `agent.completed` | success | **EMITTED** — `finalizeRun` with clean finish → `done` (`lib/agent/orchestrator.ts:686`); includes the no-approval-needed path that goes straight to done | `agent.agent.completed:agent_run:<userId>:<runId>` | terminal; retried finalize re-emission is idempotent-safe |
| `agent.failed` | error | **EMITTED** — permanent-failure path (`lib/agent/orchestrator.ts:835`) and budget-stop `finalizeRun` (`:686`); transient failures deliberately NOT notified | `agent.agent.failed:agent_run:<userId>:<runId>` | terminal state; re-emission (retried finalize) is idempotent-safe |
| `agent.paused` | warning | **EMITTED** — cancel route (`app/api/agent/runs/[id]/cancel/route.ts:53`), worker-observed cancel in `finalizeRun` (`:686`), and reject-all approval (`approve/route.ts:136` → `cancelled`) | `agent.agent.paused:agent_run:<userId>:<runId>` | no `paused` state exists in the enum; `cancelled` is the trigger, "paused" is the user-facing copy |
| `source.processing` | info | **EMITTED** — worker claims the job (`queued→running`, `app/api/process/route.ts:151`) | `processing:source:<userId>:<sourceId>` | one announcement per source per state; a retried "Try again" can't re-announce |
| `source.ready` | success | **EMITTED** — worker flips `sources.status` → `done` (`app/api/process/route.ts:303`) | `ready:source:<userId>:<sourceId>` | the canonical "drafts are ready" notification |
| `source.failed` | error | **EMITTED** — worker flips `sources.status` → `failed` (`app/api/process/route.ts:337`) | `failed:source:<userId>:<sourceId>` | repeated failed runs of the same source notify once |
| `content.generated` | success | **EMITTED — regenerate only.** Fires from `POST /api/outputs/[id]/regenerate` after the content write succeeds (`app/api/outputs/[id]/regenerate/route.ts:160,168`). The initial-generation worker path does NOT emit it; `content.validated` (below) was folded out of scope | **none — deliberate** | entity = output id; per-output repeats are legitimate, never deduped |
| `content.validated` | info | **reserved** — deterministic evaluator pass exists (`lib/agent/evaluator.ts`) but no notification fires there | — | |
| `content.review_required` | warning | **reserved** — flagged drafts exist, no notification wired | — | |
| `content.approved` | info | **reserved** — approval lives on `v4_content_ideas.approved`; the approve route notifies run transitions instead (§13) | — | wire to the approve endpoint only if product wants an event there |
| `publish.scheduled` | info | **EMITTED** — human queue / send-with-`scheduledAt` (`app/api/agent/queue/publish/route.ts:167`), live-send scheduling (`lib/agent/tools/distribution.ts:267`), automate schedule tool (`lib/agent/schedule.ts:227`) | `publish.scheduled:distribution_job:<userId>:<jobId>` | immediate sends take the `published` path, not this one |
| `publish.started` | info | **reserved** — a send is initiated with no notification between click and outcome | — | |
| `publish.published` | success | **EMITTED** — Buffer confirms: job flips to `published` with `external_id` + `published_at` (`lib/agent/tools/distribution.ts:237`); **immediate sends only** — a scheduled post is never fabricated as `published` (§ Stage 4 rule) | `publish.published:distribution_job:<userId>:<jobId>` | `metadata.channel` carries the platform |
| `publish.failed` | error | **EMITTED** — live-send job → `failed` (`lib/agent/tools/distribution.ts:292`) and automate schedule insert-failure → failed job (`lib/agent/schedule.ts:253`) | `publish.failed:distribution_job:<userId>:<jobId>` | retry loops can't spam |
| `usage.limit_near` | warning | **EMITTED** — 80% crossing only, in `POST /api/repurpose` after the atomic RPC (`app/api/repurpose/route.ts:205`); 50% remains analytics-only; `notifyUsageLimit` re-guards `percent < 80 → null` | `usage.limit_near:usage:<userId>:<windowLabel>` | entity *is* the month window (`currentWindow().label`), so next month is a fresh key |
| `usage.limit_reached` | error | **EMITTED** — 100% crossing only (`app/api/repurpose/route.ts:208`) | `usage.limit_reached:usage:<userId>:<windowLabel>` | |
| `subscription.updated` | info | **EMITTED** — webhook route after `applyPaddleEvent` returns (`app/api/billing/webhook/route.ts:40`, spec computed in `lib/billing/paddle.ts`): canceled → plan downgrade note; activation/upgrade (incl. trialing) → new plan | none | `metadata.plan` carries the plan id; Paddle webhook only fires once env vars exist |
| `payment.failed` | error | **EMITTED** — `past_due`/`paused` events (`app/api/billing/webhook/route.ts:40`, spec from `lib/billing/paddle.ts`) | none | same Paddle gate as above |
| `system.maintenance` | warning | **reserved** — manual/admin emit; no admin surface today | — | |
| `system.warning` | warning | **reserved** | — | |
| `system.announcement` | info | **reserved** | — | |

**Anti-spam stance:** only phase-level transitions notify. The `v4_agent_steps`
append-only timeline, per-format generation progress, transcript polling, and
other substep noise do **not** become notifications — that is what the live
dashboard/SSE progress is for. If a transition is visible on a page the user is
already watching, it should not also beep.

---

## 4. Database schema

Migration: **`supabase/migrations/20260912000001_notifications.sql`** — idempotent
(`if not exists` guards) like `20260908000004_content_intelligence.sql`, safe to
re-run in the SQL editor or via `supabase db push`. The shipped DDL:

```sql
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  severity text not null default 'info' check (severity in ('info', 'success', 'warning', 'error')),
  entity_type text,
  entity_id text,
  action_url text,
  metadata jsonb,
  dedupe_key text,
  expires_at timestamptz,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  -- Dedupe is opt-in: NULL dedupe_keys never conflict (NULLs are distinct in
  -- Postgres), so rows that don't participate in dedupe are unaffected.
  -- Dedupe scope is per-user: unique (user_id, dedupe_key) — keys are NOT
  -- globally unique (e.g. usage window labels repeat across every tenant), so
  -- the user_id arm prevents one user's key from swallowing another's row.
  unique (user_id, dedupe_key)
);

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

create index if not exists notifications_user_unread_idx
  on public.notifications (user_id) where read_at is null;
```

Deltas from the original plan (same taxonomy, narrower physical model):

1. **`notifications_user_created_idx`** — the feed, `(user_id, created_at desc)`.
   The keyset comparison in §7 uses an `or()` of `created_at.lt.<cursor>` and
   `(created_at.eq.<cursor> and id.lt.<cursor>)` so the composite index is not
   required; the cursor tiebreak on `id` happens in the query, not the index.
2. **`notifications_user_unread_idx`** — partial `(user_id) where read_at is null`
   (plan name `…_unread_created_idx`). Serves the unread badge count and
   `unreadOnly` listings without scanning read history. The badge is computed
   from this index at query time — unread counts are never client-accumulated
   (§12).
3. **Dedupe is a plain table-level `unique (user_id, dedupe_key)`** — not the
   planned partial unique index. Per-user scope: keys are NOT globally unique
   (usage window labels repeat across every tenant), so the `user_id` arm
   prevents one user's key from swallowing another's row. Postgres treats NULLs
   as distinct, so NULL-keyed rows never conflict; the constraint is what
   `.upsert(..., { onConflict: "user_id,dedupe_key", ignoreDuplicates: true })`
   targets.
4. **`body` is `NOT NULL`** (plan had it nullable) and **`metadata` is nullable
   with no default** (plan had `not null default '{}'`); the service writes
   `null` when no metadata is supplied.
5. The severity check is an inline unnamed constraint (plan named it
   `notifications_severity_check`) — behavior identical.

Also required by the repo's type discipline: `notifications` was added to the
handwritten `types/supabase.ts` by hand (`Row`/`Insert`/`Update` + empty
`Relationships`) — the `supabase` CLI is unauthenticated here, so
`npm run db:types` cannot regenerate (`AGENTS.md`, "Types gotcha"). The two RPCs
are deliberately **not** in the `Functions` map — the routes cast just the `rpc`
surface locally (`app/api/notifications/[id]/read/route.ts:36-41`) so the
handwritten file stays untouched on the `Functions: Record<string, never>`
guard.

---

## 5. RLS model

The `notifications` table follows the repo's per-user RLS grammar
(`auth.uid() = user_id`, as frozen in `ARCHITECTURE_FREEZE.md` §2 and applied
in every user-owned table) — with one deliberate narrowing: **SELECT only**.

```sql
alter table public.notifications enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policy
    where polrelid = 'public.notifications'::regclass
      and polname = 'Users can view their own notifications'
  ) then
    create policy "Users can view their own notifications"
      on public.notifications for select
      using (auth.uid() = user_id);
  end if;
end $$;
```

- **No INSERT, UPDATE, or DELETE policies exist.** Clients cannot create, edit,
  or delete notifications — creation is service-role-only (§2 step 4), and
  read-state mutation is exclusively through the RPCs below. The write-side
  posture mirrors `outputs` (no UPDATE policy — all edits via service-role
  routes) and the ledger tables (service-role-write, no client policies).
- **Read-state via security-definer RPCs**, ownership checked in-body —
  the RLS filter cannot be applied from the client for a write, so the RPCs
  re-assert `user_id = auth.uid()` themselves:

```sql
create or replace function public.notifications_mark_read(p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated integer;
begin
  update public.notifications
     set read_at = now()
   where id = p_id
     and user_id = auth.uid();
  get diagnostics v_updated = row_count;
  -- true only if the row exists AND belongs to the caller.
  return v_updated > 0;
end;
$$;

create or replace function public.notifications_mark_all_read()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated integer;
begin
  update public.notifications
     set read_at = now()
   where user_id = auth.uid()
     and read_at is null;
  get diagnostics v_updated = row_count;
  return v_updated;
end;
$$;

revoke all on function public.notifications_mark_read(uuid) from public;
grant execute on function public.notifications_mark_read(uuid) to authenticated;

revoke all on function public.notifications_mark_all_read() from public;
grant execute on function public.notifications_mark_all_read() to authenticated;
```

  `security definer` runs as the migration owner (bypasses RLS), so the
  `user_id = auth.uid()` predicates are the authorization — a caller can only
  mark **their own** rows read, even with a foreign `p_id` (the update simply
  matches nothing; the RPC returns `false` and the route answers `404`,
  deliberately not distinguishing missing from not-owned so existence is not
  leaked). `set search_path = public` pins the lookup, and `auth.uid()` reads
  the caller's JWT from the request context. Grants are `authenticated`-only;
  `revoke … from public` strips the default public EXECUTE (which also covers
  anon) — matching the `enqueue_job` convention. Returns differ from the
  original plan (boolean for single, integer row-count for all) and are surfaced
  by the routes: `false` → `404`, integer → `marked`.

- **RPCs are the only mutation surface**, which keeps the freeze simple: no
  client policy can ever be added that writes `notifications`; the RPC column
  of the source of truth is the function body itself. Adding a client
  INSERT/UPDATE/DELETE policy later is a freeze break.

---

## 6. Realtime model

**Locked decision (shipped): reuse Supabase Realtime `postgres_changes` on
`notifications`, filtered `user_id=eq.<uid>`.** This is not a new abstraction —
it is the pattern the dashboard already uses for `sources`/`jobs`, implemented
in `components/notifications/use-notifications.ts:209-239` (client subscribes to
**INSERT only**, not `*` — updates come from the RPCs' own responses and the
poll):

```ts
supabase
  .channel(`notifications-${userId}`)
  .on("postgres_changes", {
    event: "INSERT",                 // not "*" — see below
    schema: "public",
    table: "notifications",
    filter: `user_id=eq.${userId}`   // RLS-enforced by the server
  }, (payload) => mergeById(rowToRecord(payload.new)))
  .subscribe();
```

The INSERT payload arrives as a snake_case row and is defensively mapped to the
camelCase record (`rowToRecord`); unknown severities fall back to the DB default
`info`, never crash a render. `UPDATE`/`DELETE` changes are not subscribed:
`read_at` is reconciled from the mark-read RPC responses and the poll, and rows
are never deleted.

### Why Broadcast was evaluated and rejected

`channel` Broadcast (and Presence) on a channel named `user:{uid}:notifications`
**cannot satisfy the cross-user isolation requirement**. With only the anon key
(which every browser already holds), any client can join a named channel for a
uid they know — channel names are not authorized. "User A cannot subscribe to
User B's notification realtime channel" is unenforceable with Broadcast.

`postgres_changes` has no such hole: the server applies RLS to the change
stream, so a `user_id=eq.<otherUid>` subscription simply receives nothing even
if the client guesses the filter. RLS is the authorization; the channel name is
irrelevant noise. **Freeze: no Broadcast-based notification channel. If
Realtime on this table is ever revisited, it stays `postgres_changes`.**

### Publication migration (guarded, optional)

```sql
-- Optional but recommended. Absence is NOT fatal — the client polls (§ below).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;
```

Matches the repo's documented-but-optional stance for `sources`/`jobs`
(`supabase/schema.sql:337-340`). On hosted Supabase the equivalent is the
dashboard "Realtime" toggle for the table; either is fine, the guard just makes
the migration idempotent.

### Polling fallback (30 s + visibility)

Realtime is a **delivery optimization only. The DB is authoritative.** The
client reconciles against `/api/notifications` (`use-notifications.ts:244-263`):

- **30 s interval** (`POLL_INTERVAL_MS = 30_000`) — one cadence for every state,
  idle or busy; the original plan's 4 s-while-unread short-poll was dropped in
  implementation.
- **`visibilitychange` refresh** — an immediate quiet fetch when the tab becomes
  visible (skips while hidden). This is what heals long-idle tabs and missed
  Realtime windows; there is no short-interval polling anywhere.
- **Quiet merge semantics** — poll failures never set `loading` and never clear
  the list (last good data stays visible), matching the repo convention.

UI reconcile is id-based (`components/notifications/merge.ts`): rows seen via
Realtime and rows seen via poll merge by `id` in a Map, re-sorted
`(created_at, id)` desc; no duplicates, no re-render storms. A poll that
overlaps "Load more" keeps the deepest reached cursor instead of rewinding to
page one.

---

## 7. API contracts

All three routes follow the repo conventions: identity resolved server-side
via `supabase.auth.getUser()` (never a client-supplied `user_id` — it is
ignored if present), `{ error }` JSON shape, `401 { error: "Not signed in" }`
when unauthenticated. Middleware adds `"/notifications"` and
`"/api/notifications"` to `protectedPaths` (`middleware.ts:47,51`) as
defense-in-depth; each route still guards itself. The full contracts (with the
frontend's wire expectations) are also in `docs/API.md` → "Notifications".

### `GET /api/notifications` — list (paginated, unread-counted)

Query parameters (`app/api/notifications/route.ts`):

| param | type | default | notes |
|---|---|---|---|
| `limit` | int | 20 | clamped to `[1, 50]` (`Math.trunc`, non-finite → default) |
| `cursor` | string | — | opaque keyset: `${encodeURIComponent(createdAt)}|${id}` from the previous page's `nextCursor`; **garbage (wrong shape / unparseable timestamp) is treated as "no cursor" → newest page, not a 400** |
| `unreadOnly` | bool | false | `"true"` (exact string) adds `read_at is null` |
| `type` | string | — | single taxonomy-type filter via `eq` — **not validated**; an unknown type just matches nothing (empty list) |

Keyset pagination on `(created_at, id)` descending via
`.or("created_at.lt.<ts>,and(created_at.eq.<ts>,id.lt.<id>)")` — the same `or()`
grammar as the job-claim filter in `app/api/process/route.ts`. The route fetches
`limit + 1` rows; the extra row proves a next page and is dropped. No `OFFSET`,
no page skips/dupes when rows are inserted mid-pagination.

Response `200` — rows are the **camelCase domain records**
(`notificationRowToRecord` in `lib/notifications/create.ts`), and `nextCursor`
is **always present**, `null` when there is no further page:

```json
{
  "notifications": [
    { "id": "…", "userId": "…", "type": "source.ready", "title": "…", "body": "…",
      "severity": "success", "entityType": "source", "entityId": "…",
      "actionUrl": "/agent", "metadata": null, "dedupeKey": null,
      "expiresAt": null, "readAt": null, "createdAt": "…" }
  ],
  "nextCursor": "2026-09-12T10%3A00%3A00.000Z|…" ,
  "unreadCount": 3
}
```

Errors / degradation:

| status | body | condition |
|---|---|---|
| `401` | `{ "error": "Not signed in" }` | no session |
| `500` | `{ "error": "Failed to load notifications" }` (or `…count_failed`) | DB error on list or exact unread count |
| `200` | `{ "notifications": [], "nextCursor": null, "unreadCount": 0 }` | **table missing** (migration not applied) — the PostgREST missing-table grammar (`/could not find the…|does not exist|PGRST205|42P01/`) fails **open** with an empty page + `log.warn("notifications.table_missing")` |

`unreadCount` is present on every page (including empty and fails-open ones) —
the badge is derived from the DB's partial-unread index, never accumulated
client-side.

### `POST /api/notifications/[id]/read` — mark one read

Body `{}` accepted (`app/api/notifications/[id]/read/route.ts`).

- `id` param missing/empty after trim → `400 { "error": "Missing notification id" }`.
- **UUID-format validation (404)** — a non-UUID id is rejected **before** the
  RPC with `404 { "error": "Notification not found" }`, deliberately
  indistinguishable from a missing/not-owned row so existence is never leaked
  (only empty ids get the `400`). Corrected during the security re-audit: a
  malformed id previously fell through to the RPC's uuid-typed `p_id`
  parameter and surfaced as a `500`.
- Calls `notifications_mark_read(p_id)` on the **user (RLS) client** — the RPC
  is security-definer and checks ownership in-body.
- `false` return (no row owned by the caller) → `404 { "error": "Notification
  not found" }` — deliberately not distinguishing missing-vs-not-owned.
- Missing RPC (migration not applied) → **`503` fail-closed** with the migration
  hint `"Notifications are not available yet — the notifications migration has
  not been applied."`, mirroring the prompts route's 503 style.
- Other RPC errors → `500 { "error": "Failed to mark notification as read" }`.
- Success → `200 { "ok": true }`.

### `POST /api/notifications/read-all` — mark all read

Body `{}` (`app/api/notifications/read-all/route.ts`). Calls
`notifications_mark_all_read()` on the user client.

- Missing RPC → `503` fail-closed with the same migration hint.
- Other RPC errors → `500 { "error": "Failed to mark notifications as read" }`.
- Success → `200 { "ok": true, "marked": 3 | null }` — `marked` is the integer
  row count the RPC returned (or `null` if the response wasn't a number). The
  client reconciles its optimistic `unreadCount` against `marked`.

---

## 8. Deduplication strategy

`dedupe_key` is **opt-in per notification type** — `NULL` (the default) means
"this event may repeat and each occurrence is a legitimate notification"
(`content.generated` per output, `subscription.updated` per webhook event).

Key format is per-builder (all built in `lib/notifications/events.ts`; the
emitters never pass a raw key):

- `agent.agent.started:agent_run:<userId>:<runId>` — note the double prefix: the builder
  template is `` `agent.${type}:agent_run:${userId}:${run.id}` `` with `type`
  itself namespaced. A run that legitimately progresses awaiting_approval →
  executing → done produces **distinct** keys per mapped type, so all three
  notifications fire; re-entry into the same status is dedupe-hit.
- `processing:source:<userId>:<sourceId>` / `ready:source:<userId>:<sourceId>` /
  `failed:source:<userId>:<sourceId>` — **all three** source states are keyed (the plan
  only keyed `failed`), deliberately: "Try again" re-queues the SAME source id,
  so a retried run would otherwise re-announce `processing` and a second `ready`
  for the same source would be spam. One announcement per source per state.
- `publish.scheduled:distribution_job:<userId>:<jobId>` / `publish.published:…` /
  `publish.failed:…` — per (event, job): a failing job that retries must not
  spam, while scheduled → published are distinct keys.
- `usage.limit_near:usage:<userId>:<windowLabel>` / `usage.limit_reached:usage:<userId>:<windowLabel>` —
  the entity **is** the month window (`currentWindow().label`, e.g. `2026-09`);
  each month is a fresh key and the user notifies again. The `userId` segment is
  mandatory tenant scope: the bare window label is identical across ALL users
  and the dedupe constraint is per-user (`unique (user_id, dedupe_key)`, §4), so
  a label-only key would let the first user to cross a threshold in a month own
  it and silently swallow every other user's usage notification.

Mechanics: the service inserts with
`.upsert(payload, { onConflict: "user_id,dedupe_key", ignoreDuplicates: true }).
select().single()` (`lib/notifications/create.ts`), backed by the table-level
`unique (user_id, dedupe_key)` from §4. **The installed `@supabase/postgrest-js`
(2.115.0) removed the chainable `.insert().onConflict().ignoreDuplicates()`
API** — the comment in `create.ts` verifies `.upsert()` emits the identical wire
request (`on_conflict=user_id,dedupe_key` + `Prefer: resolution=ignore-duplicates` +
`return=representation`), so conflict semantics are unchanged. A dedupe hit
returns zero rows and `.single()` surfaces it as PostgREST **error `PGRST116`**
— that is the dedupe-hit signal: the service re-selects the existing row by
`dedupe_key` AND `user_id` (`notification.dedupe` log) and returns it as the
record, so callers always get a usable `NotificationRecord` — and never another
tenant's row, even though the re-read runs on the RLS-bypassing service client.
This makes **retry-safe emission free**: re-emitting a transition after a
transient failure (network blip in the worker, duplicate orchestrator kicks —
both already real in this codebase) cannot double-notify, because the second
insert is ignored atomically (per user + key).

**Deliberate non-dedupe:** `content.generated` carries the output's own id as
the entity, so per-output notifications are naturally distinct and must never
be collapsed by a coarse key (e.g. `${type}:source:<userId>:<sourceId>` would wrongly
squash "output B ready" after "output A ready"). Same for `subscription.updated`
/ `payment.failed` — every plan change / failed payment is its own event. Rule
of thumb: dedupe only **repeatable backend events that are semantically one
state**, never **distinct instances of a repeated event**.

---

## 9. Security model

The 12-point checklist. Points 1–3 are the horizontal guarantees; 4–12 the
per-notification hygiene.

1. **Cross-user isolation.** RLS `SELECT` is `auth.uid() = user_id` (§5);
   Realtime is RLS-enforced (§6); both RPCs re-assert ownership in-body. A user
   cannot read, mutate, or subscribe to another user's notifications — the
   Broadcast rejection exists precisely because channels could not say this.
2. **No arbitrary browser creation.** No client INSERT/UPDATE/DELETE policies;
   only the service-role service can write. Spam-forging notifications in the
   browser is impossible by construction, not by convention.
3. **Identity comes from the session.** API routes resolve via
   `auth.getUser()`; `user_id` in a request body is ignored. A client cannot
   create/read/mark-as-read for a uid it chooses.
4. **`action_url` is allowlisted.** `isSafeActionUrl` (`lib/notifications/
   types.ts`) requires: a relative internal path with exactly one leading `/`
   (no `//` protocol-relative), no `:` (blocks `https:`, `javascript:`,
   `mailto:`), no backslashes, no control characters, and a known app-route
   prefix. The shipped prefix list: `/agent /library /repurpose /publish
   /settings /dashboard /content /connections /branding /notifications
   /upload`. Anything else is dropped at creation (the stored value is `NULL`)
   AND re-checked at render — the UI renders no link at all rather than an
   unsafe one. The planned 512-char cap was not implemented (the prefix +
   scheme checks are the boundary).
5. **Plain-text rendering.** `title`/`body` are plain text. The UI renders them
   as React text nodes (escaped by default) — **no `dangerouslySetInnerHTML`**,
   no markdown/HTML interpretation in the render path.
6. **No secrets, tokens, prompts, or chain-of-thought in payloads.** Payloads
   carry ids, statuses, and titles — the same PII/secret discipline as
   `lib/logger.ts` ("Never log PII — use ids, statuses, and durations"). A
   notification never embeds an access/refresh token, API key, transcript
   content, system prompt, or model reasoning.
7. **Service role never reaches the browser.** `createServiceClient`
   (`lib/supabase/server.ts:38`) stays in server-only modules; the existing
   audit guarantee from `ARCHITECTURE_FREEZE.md` §2 applies to the notification
   service too.
8. **Untrusted-at-render-boundary.** Every value arrives from the DB (a
   compromised/duplicated row is hostile input): sanitize at creation (§2 step
   2), escape at render (§9 pts 4–5), and treat `metadata` as opaque — render
   only allowlisted keys through typed components, never raw.
9. **RPCs are authenticated-executable only.** `revoke all … from public`;
   `grant execute … to authenticated` (revoking from public strips the default
   public EXECUTE, which also covers anon), `security definer` with
   `set search_path = public` so no search-path hijack, ownership checked
   in-body.
10. **Realtime channel data is RLS-filtered** — a guessed `user_id=eq.<uid>`
    filter yields zero rows, and the anon key alone authorizes nothing beyond
    the caller's own rows.
11. **`metadata` jsonb carries no PII and no user-controlled HTML**; it is for
    structured affordances only (e.g. a severity icon hint), non-PII by
    contract (enforced at the emit sites, matching the logger rule).
12. **Log lines never contain bodies or PII.** `notification.*` log events
    carry `type`, `user_id`, `entity_type/id`, `dedupe_key` — ids, not
    content (see §12 table).

---

## 10. Failure/retry behavior

- **Notification failures NEVER break domain ops.** `createNotification` is
  best-effort, wrapped like `analytics.track` (`lib/analytics/events.ts:22-31`):
  any throw is caught, `log.warn("notification.create_failed", …)`, and the
  caller continues. The worker/orchestrator/distribution paths do not branch on
  notification success. A dead `notifications` table degrades the app to
  "no badges", never to "no processing".
- **Dedupe makes retries free** (§8): a transient failure followed by a retried
  emit of the same transition is dedupe-hit rather than duplicate — so retry
  loops can re-emit without fear of spam, and the existing claim/resume
  semantics of the worker and orchestrator need no changes.
- **Persist-first.** The row insert is the ONLY durability point (there is no
  server-side broadcast step to fail — delivery is passive via the Realtime
  publication; §2 step 5). The client's 30 s + visibility polling covers missed
  realtime events — the UI converges with the DB even with Realtime fully
  down.
- **RPC failures are fail-closed (503), not silent** — marking read must not
  be silently lost (migration missing ~ table degraded), matching the
  `enqueue_job` precedent; the migration hint string differs from prompts but
  the posture is identical. Whole-feed reads **fail open** (empty list + warn
  log) because read-path degradation is safe and observable — the bell renders
  "No notifications yet" instead of a hard error.

---

## 11. Webhook/external delivery architecture (future — optional)

Email/push is deliberately a **bolt-on over the existing durability layer**,
not a second notification system:

```
notifications INSERT
      │  (Supabase Database Webhook, on public.notifications)
      ▼
narrow Edge Function  → reads notification_preferences (per user × type)
      │                → respects email_enabled / push_enabled
      ▼
Email / Push provider
```

**Locked ground rules:**

- **The webhook must never create notifications.** Receiving a row from the
  `notifications` table and inserting back into it is the recursion trap; the
  Edge Function is a delivery-only consumer. Its only DB surface is a read of
  `notification_preferences` and idempotent external-call bookkeeping.
- **Preferences seam.** The design reserves a table so external delivery can
  land without touching the core (the core in-app path does not read it):

```sql
create table if not exists public.notification_preferences (
  user_id           uuid primary key references auth.users(id) on delete cascade,
  notification_type text not null,        -- taxonomy type, §3; 'default' = fallback
  in_app_enabled    boolean not null default true,
  email_enabled     boolean not null default false,
  push_enabled      boolean not null default false,
  updated_at        timestamptz not null default now(),
  unique (user_id, notification_type)
);
```

  RLS per the per-user grammar (SELECT/UPDATE own; INSERT/DELETE as needed for
  settings UI), and the same graceful-degradation rule as every new table:
  absence of the table (migration not applied) → the in-app path continues,
  the external path logs and skips. `notification_type = 'default'` is the
  fallback row for types without an explicit row.
- **Why not now:** no email/push provider is wired, no Edge Functions deploy
  pipeline exists, and the delivery volume is trivial today. The webhook path
  adds blast radius (another always-on consumer) for zero current users. When
  it ships, the webhook config is a dashboard/managed step like the Realtime
  publication — never a hard migration dependency.

---

## 12. Operational troubleshooting

### Log events (all via `lib/logger.ts`, ids not content)

| event | level | when | fields |
|---|---|---|---|
| `notification.created` | info | row persisted (or re-selected after a dedupe hit) | `type`, `user_id`, `entity_type`, `entity_id` |
| `notification.create_failed` | warn | validate/sanitize/insert threw | `type`, `user_id`, `error.message` |
| `notification.rejected` | warn | validation returned null (unknown type, unsafe `action_url`, oversized `dedupe_key`/`metadata`) | `type`, `user_id`, `reason` |
| `notification.dedupe` | info | `.upsert()` returned zero rows → `PGRST116` → re-selected the existing row | `type`, `user_id`, `dedupe_key` |
| `notifications.table_missing` | warn | list route degraded to an empty page (missing-table grammar matched) | `user_id` |
| `notifications.list_failed` | warn | list query failed after the missing-table check passed | `user_id`, `error.message` |
| `notifications.count_failed` | warn | exact unread-count query failed | `user_id`, `error.message` |
| `notifications.mark_read_failed` | warn | mark-one RPC threw (route 500/503) | `user_id`, `error.message` |
| `notifications.mark_all_read_failed` | warn | mark-all RPC threw (route 500/503) | `user_id`, `error.message` |

There is deliberately **no `notification.realtime_failed`** — nothing server-side
broadcasts, so there is no broadcast failure to log (§2 step 5); missed delivery
is healed by the 30 s + visibility polling, not a log line.

`LOG_LEVEL=warn` quiets the two `info` rows (`notification.created`,
`notification.dedupe`) if success spam is an issue (`AGENTS.md`, Logging) — the
failure rows are `warn` and survive.

### Common failure modes

1. **Migration not applied** — the `notifications` table (or the RPCs) is
   missing. Reads match the PostgREST error
   (`/could not find the\s*\w*\s*["']?\w+|does\s*not\s*exist|PGRST205|42P01/`)
   and return `{ notifications: [], nextCursor: null, unreadCount: 0 }` +
   `notifications.table_missing` warn. Emitters log `notification.create_failed`
   and continue; the app is otherwise unchanged. Read/list routes degrade this
   way (fail open); mark-read routes are fail-closed 503 with a migration hint
   (never an unchecked client-side UPDATE — RLS forbids it by design).
2. **Realtime publication missing / Realtime down** — the 30 s + visibility
   polling fallback (§6) keeps the UI correct; there is no error event to look
   at, by design. Check `pg_publication_tables` for the `notifications` row or
   the dashboard table toggle.
3. **No Paddle config** — `getPaddleConfig()` returns null, so `subscription.*`
   and `payment.*` emitters are inert (wiring is live, the provider is not:
   the webhook route emits, fail-open, `app/api/billing/webhook/route.ts` —
   `lib/billing/paddle.ts` stays client-safe and only computes the spec).
   This is expected until Stage 5 go-live; do not
   treat the absence of subscription notifications as a bug.
4. **Missing notifications / wrong dedupe** — first check the dedupe_key
   semantics (§8): a repeatable event given no dedupe key spams; a distinct
   event given a coarse key squashes. Both are service-level mistakes visible
   in `notification.dedupe` frequency (info-level — requires `LOG_LEVEL=info`
   to observe).
5. **Unread count drift** — the badge is recomputed from the DB
   (`unreadCount` on every `/api/notifications` response, partial-unread
   index), never accumulated client-side, so drift is transient at worst: any
   refresh, poll, or realtime event re-syncs. If the badge is persistently
   wrong, verify RPC execution (`read_at` updates) — a caller can only ever
   affect their own rows, so a wrong *foreign* badge is impossible by RLS/RPC
   construction.

---

## 13. Emitter call-site inventory (shipped)

Every `notify*` caller, verified against the code 2026-09-12. This is the
ground truth behind the taxonomy table (§3) — if you add a site, keep both in
lock-step. All callers import the typed builder from `lib/notifications/events.ts`
(fire-and-forget after the domain write commits; never `createNotification`
directly).

| file:line | domain transition (after write commits) | type | dedupe key |
|---|---|---|---|
| `app/api/process/route.ts:151` | job claimed (`queued→running`) | `source.processing` | `processing:source:<userId>:<id>` |
| `app/api/process/route.ts:303` | `sources.status → done` | `source.ready` | `ready:source:<userId>:<id>` |
| `app/api/process/route.ts:337` | `sources.status → failed` | `source.failed` | `failed:source:<userId>:<id>` |
| `app/api/repurpose/route.ts:205` | `enqueue_job` success, rolling-month usage ≥ 80 % | `usage.limit_near` | `usage.limit_near:usage:<userId>:<windowLabel>` |
| `app/api/repurpose/route.ts:208` | same, atLimit (100 %) | `usage.limit_reached` | `usage.limit_reached:usage:<userId>:<windowLabel>` |
| `app/api/outputs/[id]/regenerate/route.ts:160,168` | regenerate wrote a new draft | `content.generated` | none |
| `lib/agent/orchestrator.ts:331` | `runPlanning` → automate auto-approval (`executing`) | `agent.started` | `agent.agent.started:agent_run:<userId>:<id>` |
| `lib/agent/orchestrator.ts:331` | `runPlanning` parks human-gated (`awaiting_approval`) | `agent.awaiting_approval` | `agent.agent.awaiting_approval:agent_run:<userId>:<id>` |
| `lib/agent/orchestrator.ts:686` | `finalizeRun` clean finish → `done` | `agent.completed` | `agent.agent.completed:agent_run:<userId>:<id>` |
| `lib/agent/orchestrator.ts:686` | `finalizeRun` observed cancel → `cancelled` | `agent.paused` | `agent.agent.paused:agent_run:<userId>:<id>` |
| `lib/agent/orchestrator.ts:835` | permanent failure → `failed` | `agent.failed` | `agent.agent.failed:agent_run:<userId>:<id>` |
| `app/api/agent/runs/[id]/approve/route.ts:136` | ≥1 idea kept → `executing` | `agent.started` | `agent.agent.started:agent_run:<userId>:<id>` |
| `app/api/agent/runs/[id]/approve/route.ts:136` | reject-all → `cancelled` | `agent.paused` | `agent.agent.paused:agent_run:<userId>:<id>` |
| `app/api/agent/runs/[id]/cancel/route.ts:53` | non-terminal run → `cancelled` | `agent.paused` | `agent.agent.paused:agent_run:<userId>:<id>` |
| `app/api/agent/queue/publish/route.ts:167` | human send with `scheduledAt` → job `scheduled` | `publish.scheduled` | `publish.scheduled:distribution_job:<userId>:<id>` |
| `lib/agent/tools/distribution.ts:237` | Buffer confirmed immediate send → job `published` | `publish.published` | `publish.published:distribution_job:<userId>:<id>` |
| `lib/agent/tools/distribution.ts:267` | live-send scheduling (`markJobScheduled`) | `publish.scheduled` | `publish.scheduled:distribution_job:<userId>:<id>` |
| `lib/agent/tools/distribution.ts:292` | job → `failed` (`markJobFailed`) | `publish.failed` | `publish.failed:distribution_job:<userId>:<id>` |
| `lib/agent/schedule.ts:227` | automate schedule tool → job `scheduled` | `publish.scheduled` | `publish.scheduled:distribution_job:<userId>:<id>` |
| `lib/agent/schedule.ts:253` | automate schedule insert-failure → failed job | `publish.failed` | `publish.failed:distribution_job:<userId>:<id>` |
| `app/api/billing/webhook/route.ts:40-52` | webhook route emits after `applyPaddleEvent` returns (spec computed in `lib/billing/paddle.ts` 2b block) — activation/upgrade/trial (new plan) and `subscription.canceled` downgrade | `subscription.updated` | none |
| `app/api/billing/webhook/route.ts:40-52` | `past_due`/`paused` events | `payment.failed` | none |

### 13.2 Plan → shipped reconciliation deltas

The original plan (this document as written before implementation) diverged
from what shipped in the following places — each is corrected in place in the
sections above:

1. **Write path**: planned chainable `.insert().onConflict().ignoreDuplicates()` —
   shipped `.upsert(..., { onConflict: "user_id,dedupe_key", ignoreDuplicates: true })`
   + `PGRST116` → re-select. The installed `@supabase/postgrest-js` 2.115.0
   removed the chainable API; the comment in `create.ts` documents the wire
   equivalence.
2. **Polling**: planned 4 s-while-unread / 30 s-idle — shipped a single 30 s
   interval + `visibilitychange` refresh (§6).
3. **Realtime**: planned `event: "*"` — shipped INSERT-only subscription;
   `read_at` heals from RPC responses + poll, rows are never deleted.
4. **Taxonomy**: `content.validated`, `content.review_required`,
   `content.approved`, `publish.started`, and the `system.*` types are
   **reserved**, not wired; `agent.paused` IS emitted today (on `cancelled`
   transitions — no `paused` enum state exists); `content.generated` fires
   **only** from the regenerate route, not the worker (the plan claimed both).
5. **Usage thresholds**: planned 50/80/100 % analytics parity — shipped 80/100 %
   only (the 50 % crossing stays analytics-only). **Dedupe keys are per-user**
   (`usage.limit_<near|reached>:usage:<userId>:<windowLabel>`): the plan's
   optimistic "window label alone is globally unique" was corrected during the
   security re-audit — the label is identical across ALL tenants, so `userId`
   is mandatory tenant scope in every dedupe key (§8).
6. **Schema**: shipped `unique (user_id, dedupe_key)` table constraint (planned partial
   unique index), indexes `(user_id, created_at desc)` + partial
   `(user_id) where read_at is null` (planned 3-part composite + partial created
   idx), `body NOT NULL` (planned nullable), `metadata` nullable no default
   (planned `NOT NULL default '{}'`), inline severity check (planned named
   constraint), `notifications` + RPCs types in the handwritten
   `types/supabase.ts` (RPCs kept out of `Functions` map).
7. **RPC signatures**: `notifications_mark_read(uuid) → boolean` (planned
   `uuid[] → void`), `notifications_mark_all_read() → integer` (planned void);
   grants via `revoke … from public; grant … to authenticated` (planned explicit
   anon revoke).
8. **API contracts**: cursor `encodeURIComponent(createdAt)|id` (planned
   base64url); garbage cursor → newest page, not 400; **non-UUID `[id]/read`
   ids → `404` pre-RPC** (added during the security re-audit — a malformed id
   previously fell through to the RPC's uuid cast and surfaced as a `500`);
   `read-all` returns `{ ok, marked }`; GET fails **open** on a missing table
   while mark-read routes fail **closed** (503 + migration hint).
9. **Sanitize caps**: title ≤ 160 (planned 120); no `action_url` length cap
   (planned 512) — the internal-prefix allowlist is the only boundary.
10. **Log events**: `notification.rejected` (planned `drop_invalid_type`),
    `notification.dedupe` (planned `dedupe_hit`), no `notification.realtime_failed`,
    plus the `notifications.table_missing|list_failed|count_failed|
    mark_all_read_failed` family.
11. **Settings form**: the plan's appendix flagged a "Coming soon" placeholder —
    it shipped replaced by live copy pointing at the bell (see appendix note).
12. **Emitter surface**: the approve + cancel routes are emitters (added versus
    plan); the Paddle emitter — originally planned inside `applyPaddleEvent`
    (`lib/billing/paddle.ts`) — shipped in the **webhook route** instead:
    `app/api/billing/webhook/route.ts` emits fail-open while `paddle.ts` only
    computes the notification spec (paddle.ts must stay client-safe, see §12
    failure mode 3); `content.generated` from the worker was dropped.

---

## Appendix — Repository discovery (as-found, pre-implementation)

> **Historical baseline.** This appendix records the repository discovery made
> while the notification plan was written — before any implementation existed.
> Everything above this point is the reconciled shipped system; where they
> disagree, §§1–13 win. Two items below are superseded by implementation: the
> "In-app alerts … Coming soon" placeholder bullet (replaced by live bell copy,
> `components/settings-form.tsx:104-107` — the block now reads "check the bell
> in the top bar"), and the middleware `/notifications` + `/api/notifications`
> entries it anticipated (now real, `middleware.ts:47,51`).

Verified against the repo while writing this document:

- **No prior notification system.** No `notifications` table, migration,
  policy, module, or component exists. The only traces are the
  "In-app alerts … we're building these and they aren't live yet" placeholder
  in `components/settings-form.tsx:99-116` (badge: *Coming soon* — replaced
  since, see note above) and
  incidental hits in `lib/buffer/mcp.ts` (JSON-RPC `notifications/initialized`)
  and `lib/billing/paddle.ts` (Paddle "notification-destination" webhook
  secret) — unrelated.
- **Existing infra REUSED, not duplicated:**
  - Service-role best-effort write pattern: `lib/analytics/events.ts::track`
    (try/catch, `log.warn` on failure, never throws) — the template for
    `createNotification`.
  - Structured logging: `lib/logger.ts` (`log.info/warn/error`, `LOG_LEVEL`,
    optional `LOG_WEBHOOK_URL` fire-and-forget).
  - Auth gate: `middleware.ts::protectedPaths` session redirect; new
    `"/notifications"` + `"/api/notifications"` entries follow the same list.
  - Per-user RLS grammar `auth.uid() = user_id` with idempotent
    `do $$ … if not exists` policy guards
    (`supabase/migrations/20260908000004_content_intelligence.sql`).
  - Realtime pattern: `postgres_changes` + `user_id=eq.<uid>` filter +
    interval refresh (`app/(app)/library/source-list.tsx:262-299`), optional
    publication (`supabase/schema.sql:337-340`).
  - Output registry precedent for typed, singleton, test-pinned modules:
    `lib/output-registry/` (`definitions.ts → registry.ts → types.ts` +
    `registry.test.ts`).
  - Hand-rolled dropdown (outside-click + Escape, `role="menu"`,
    `aria-*`): `components/user-menu.tsx`.
  - Inline-SVG icon style (`stroke="currentColor"`, `size-4`,
    `aria-hidden`), not an icon library.
  - Design tokens: `tailwind.config.ts` — `primary-500 #2A4DFF`, Figtree
    body / Archivo display (`--font-figtree` / `--font-archivo`).
- **Explicitly NOT created** (freeze): no second event bus / broker
  (no Kafka/Redis/NATS, no DTO event hub — the emitter call sites are the
  bus), no second realtime abstraction (supabase-js channels only), no second
  DB access layer (user client for reads, service client for writes — the two
  existing clients from `lib/supabase/server.ts`), and no toast/notification
  dependency (`package.json` carries none).