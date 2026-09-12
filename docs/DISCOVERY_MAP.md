# Discovery Map — VervAI Architecture (consolidated)

Durable architecture snapshot from the 2026-09-12 discovery pass
(`tasks/discovery-scout.md` — system map; `tasks/discovery-architect.md` — analysis).
Verified facts carry file:line evidence; open questions are marked **❓**.

**Authority ordering** (unchanged by this document): `docs/API.md` = HTTP surface,
`docs/IMPLEMENTATION_MAP.md` = current ground truth, `docs/ARCHITECTURE_FREEZE.md` =
locked runtime contracts, `docs/data-model.md` = table-level authority, `docs/adr/` =
decision record for the load-bearing choices below.

## 1. System overview

Next.js 14.2.15 (App Router) + Supabase (Postgres / Auth / Storage / Realtime) + Gemini
(`gemini-3.6-flash`), OpenRouter fallback (quota-only), AssemblyAI transcription.
`app/` pages + API routes · `components/` UI · `middleware.ts` session gate.

- **Core pipeline** (repurpose plane): `POST /api/repurpose` (enqueue-only; rate limit
  + atomic `enqueue_job` RPC, fail-closed 503) → `jobs` table → `POST /api/process`
  (SSE worker, atomic claim, 10-min stale window) → `ingestSource` →
  `saveTranscript` → parallel `generateOutput` → `outputs` → flips `sources.status` →
  `recordUsageEvent("consume")`. Dashboard polls `/api/sources` 4s + Realtime
  `postgres_changes`; duplicate worker kicks are harmless (atomic claim).
- **Agentic layer** (agent plane): `lib/agent/` + `v4_*` tables (per-user RLS), modes
  `assist|execute|automate` gate tools via `lib/agent/permissions.ts`; deterministic
  evaluator (`lib/agent/evaluator.ts`, no LLM judge); drafts written into the existing
  `outputs` table.
- **Two orchestrator runtimes co-exist** — see §5.

## 2. Two execution planes, one queue

| Plane | Worker | Claim semantics | SSE surface |
|---|---|---|---|
| Repurpose | `app/api/process/route.ts` (claim `:107-144`) | atomic `queued→running`, re-claimable after 10 min stale | `progress` / `done` / `error` |
| Agent | `app/api/agent/process/route.ts` (flag read once `:3-5`) | atomic claim; planning stale after 10 min; executing/evaluating re-claimed after 90 s heartbeat gap or 10 min | `progress` / `done{ok,stopped,outputs,completed,cancelled}` / `error{error,retryable}` |

Both share the **jobs-table-as-queue** primitive (ADR-0001); there is no broker
(no Redis/SQS). Duplicate kicks are safe by construction across both planes.
The 90 s heartbeat guard means two workers can never hold the same agent run.

## 3. Client split — user vs service (load-bearing)

- **User client** `createClient()` — `lib/supabase/server.ts:5-34`: session cookie,
  RLS-scoped, used for ownership checks + reads in routes/components.
- **Service client** `createServiceClient()` — `lib/supabase/server.ts:38-45`:
  service role, **bypasses RLS**, `persistSession: false`, required
  `@supabase/supabase-js`. Confined to API routes/server work; never in client-facing
  components; never in client bundles (audited, ARCHITECTURE_FREEZE §2).
- **The boundary is enforced twice**: in code (route resolves identity from the
  session, never accepts `user_id` from the body) and in the DB (RLS grammar, §4).
- `outputs` has exactly **2 writers** today: the repurpose worker and the agent
  runtime. No UPDATE/DELETE client policy → the service client is the only update
  path (`PATCH /api/outputs/[id]`, regeneration, agent drafts).

## 4. RLS grammar — two families

| Family | Tables | Policies | Writes |
|---|---|---|---|
| Per-user (every user-owned table: base + `V4_` + `content_intelligence` + `notifications`) | `sources`, `transcripts`, `outputs`, `jobs`, `user_prompts`, `youtube_connections`, `drive_connections`, `buffer_connections`, `v4_*`, `content_intelligence`, `notifications` | `auth.uid() = user_id` (SELECT/INSERT/UPDATE/DELETE; `20260907000003` makes every UPDATE `WITH CHECK` explicit) | user client for reads/ownership; service client for privileged writes (`outputs`) |
| Ledger/contract — **RLS on with NO client policies** | `events`, `usage_events`, `subscriptions`, `subscription_events`, `profiles` | none (clients get nothing) | service-role only (`20260907000004_billing_ledger.sql:7-8,26-34,63-67,73-83`) |

Exception carved deliberately: `subscriptions` keeps a single **SELECT** policy
("Users can view their own subscription", `20260907000004_billing_ledger.sql:65-67`)
so the app can display tier from DB truth; everything else in that family is client-invisible.
`enqueue_job` EXECUTE is revoked from `public` and granted only to `service_role`
(`:194-195`) — an anon caller must never reserve slots for an arbitrary `user_id`.

Regressions pinned by `npm run verify:rls` (24/24) and `npm run verify:agentic` (38/38).

## 5. Agent domain — three layers + flag gate

1. **Runtime** — `lib/agent/orchestrator.ts` (849 lines): durable hot-path worker
   (claim/resume/heartbeat/budgets/approvals). This is what runs when the flag is OFF.
2. **Pure policy package** — `lib/agent/orchestrator/` (16 files): state machine,
   planner, executor tick, approvals, retry, idempotency, policies, events. PURE per
   `types.ts:11-13` (no network/DB/side-effect imports) so it is unit-testable and
   safe for any server code to import.
3. **Bridge** — `lib/agent/orchestrator-bridge.ts` (1001 lines): sibling adapter +
   loop (`processAgentRunV1`) mapping the 15-state v1 policy onto the 8-state runtime
   tables; **deep-import rule** (`:10-14`) — policy pieces only via deep paths, never
   the bare specifier (which resolves to the runtime file), never the policy index.

**Flag gate** — `VERVAI_ORCHESTRATOR_V1` (`lib/agent/orchestrator/flag.ts:1-4`, pure
env read, `=== "1"`), read once per request at the seam
`app/api/agent/process/route.ts:3-5`. Both imports sit in the route; the flag picks
`processAgentRun` (runtime) vs `processAgentRunV1` (bridge). **Currently OFF → the
bridge is dead in production** (design intent: staged flip). Migration
`20260912000003_orchestrator_v1_idempotency.sql` adds the run/policy idempotency key.

## 6. State machines (all verified)

### `sources` — `uploaded → transcribing → generating → done | failed`
- Re-queue only from `uploaded`/`failed` ("Try again" / "Start processing" both
  re-POST `/api/repurpose`).
- `uploaded` is **overloaded**: fresh upload AND enqueue-lost. **❓** whether to
  introduce a distinct queued/idle state.

### `jobs` — `queued → running → done | failed`
- `attempt` counter, `refunded` flag, `idempotency_key`. 10-min stale window makes
  `running` re-claimable. Ledger actions: `reserve` (enqueue) / `consume` (success) /
  `refund` (platform-side failure) / `release` (user-cancelled) —
  `usage_events.action` CHECK at `20260907000004_billing_ledger.sql:30`.

### `v4_agent_runs` — 8 statuses
`created | planning | awaiting_approval | executing | evaluating | done | failed | cancelled`
- Claimable: `created`/`planning` (>10 min stale) and `executing`/`evaluating`
  (>90 s heartbeat gap or 10 min).
- Never claimable: `awaiting_approval` (human-gated), `done`/`failed`/`cancelled`.
- `evaluating` is claimable + rendered ("Rating drafts…" `lib/status.ts`) but **no code
  path writes it** (`orchestrator-bridge.ts:89,116`). **❓** deliberate-dormant or prune.

### v1 policy — 15 states (pure, `lib/agent/orchestrator/state-machine.ts`)
`idle, understanding, context_loaded, opportunities_identified, recommendations_ready,
planning, awaiting_approval, approved, executing, validating, review, completed, failed,
cancelled, paused`
- EDGES table `:44-60`; `TERMINAL = {completed, failed, cancelled}` `:12-16`;
  `awaiting_approval→executing` requires the `approved` leg (`transitionPath :109-130`);
  paused resumable to any non-terminal active state (`:65-67,87-90`).
- The 15→8 map to the runtime tables is explicit and **lossy — it refuses `paused`**
  (bridge `:72-102`); runtime has no paused concept.

### Distribution jobs — `draft → scheduled | published | failed | cancelled`
- `scheduled` = `external_id` + `scheduled_at` set; **never fabricate `published`**
  until Buffer confirms the airing (ADR-0004). Manual send only (human click or
  `automate`-mode tool); immediate send → `published`.

### Subscriptions — `incomplete | active | past_due | canceled | trialing (+ paused)`
- `paused` added by `20260908000001_paddle_billing.sql` (currently **missing** from
  `types/supabase.ts:99` — drift, see R4).
- `profiles.plan` = enforcement source of truth (`resolvePlan`,
  `lib/billing/entitlements.ts`); `profiles.plan_status` = `active | cancelled`.

## 7. API contract table (verified surface, details in `docs/API.md`)

| Route | Success | Error semantics |
|---|---|---|
| `POST /api/repurpose` | `{ok, jobId, idempotent?, usage}` | 400 / 401 / 404 / 409 / 429 (Retry-After, rolling minute) / 429 (monthly, via RPC) / **503 fail-closed** if `enqueue_job` RPC unavailable |
| `POST /api/process` (SSE) | `progress` → `done{ok:true}` | 400 / 404; claim-lost → `done{ok:true,skipped:true}`; `error` event |
| `POST /api/agent/process` (SSE) | `done{ok,stopped,outputs,completed,cancelled}` | `error{error,retryable}` |
| `POST /api/billing/webhook` | 200 idempotent (dedupe on `paddle_event_id`, `20260908000001`) | 401 bad signature; 5 s replay window; notification emission **fail-open** (logged, never throws) |
| `GET /api/cron/storage-retention` | 200 sweep | 401 unless `Authorization: Bearer CRON_SECRET` (SHA-256 digest + `crypto.timingSafeEqual`, fail-closed); 500 fail-closed on setup failure; bounded 200 users / 500 deletes |
| `GET /api/integrations/debug` (authed) | exact OAuth redirect URIs + env presence | never prints secrets |

Degradation contract (ADR-0005) appears in ≥5 places: PostgREST error family regex →
retry without column / return defaults (`lib/prompts.ts`, `app/api/process/route.ts`,
regenerate route, `lib/ingestion/save.ts`, `lib/billing/paddle.ts`).

## 8. Failure modes

| Mode | Behavior | Verdict |
|---|---|---|
| Rate limiter query errors | `if (error) return { ok: true }` — **fails open** (`lib/rate-limit.ts:27`) | **R2 risk** — abuse gate opens when DB struggles (deliberate "never block enqueue on schema lag", but expensive on a paid platform) |
| `enqueue_job` RPC errors | 503 fail-closed, never falls back to unchecked insert | Correct (adjacent to R2) |
| Worker death mid-job | re-claimable windows + attempt counting; generation failure → whole job `failed` + `refund` | Correct policy — except regeneration delete (R1) |
| Gemini overload / OpenRouter | `retryOnOverload` 8 attempts / 90 s budget honoring `RetryInfo.retryDelay`; OpenRouter **quota-only** fallback | Correct (ARCHITECTURE_FREEZE §5) |
| Buffer refresh failure | job `failed` honestly, no silent requeue, Retry-After surfaced | Correct |
| Notifications insert failure | logged, never throws; dedupe `ignoreDuplicates` + PGRST116 re-read | Correct (fail-open surface) |
| Cron sweep setup failure | deletes nothing | Correct (fail-closed) |
| Paddle duplicate delivery | no-op via `paddle_event_id` unique; pre-migration degrade | Correct |

## 9. Ranked risks (top 5)

- **R1 — Regeneration destructive-delete** (highest): `app/api/process/route.ts:194`
  deletes **all** prior `outputs` rows before generation; a single-format failure
  (`:292-299` insert never reached) leaves the user with `failed` status and **zero
  drafts**, no rollback. **❓** is delete-then-regenerate intended, or should old drafts
  survive until the new ones succeed?
- **R2 — Rate limiter fails open**: `lib/rate-limit.ts:27` (`if (error) return { ok: true }`).
  Fix direction: fail-closed 429/503 on error, or explicit table-presence degradation
  like the enqueue path.
- **R3 — Runtime/bridge dual implementation**: the bridge's `v1Planning :367-576` and
  `v1Execution :580-853` are transcribed from the runtime ("transcribed from runtime"
  per source); flag OFF → bridge unexercised by traffic; no differential test
  (runtime vs `processAgentRunV1` on the same run). Any runtime edit must be mirrored
  or the flag can never flip.
- **R4 — `types/supabase.ts` drift**: handwritten placeholder; `subscriptions.status`
  missing `'paused'` (`:99`), `subscription_events` missing `paddle_event_id`
  (`:104-109`), `Functions` types only `enqueue_job` (notification mark-read RPCs
  absent). CI (tsc/lint/build) cannot catch it; a future `npm run db:types` blows up
  wholesale.
- **R5 — `LIGEND_DEFINITIONS` typo + parallel `OutputFormat` unions**:
  `lib/output-registry/definitions.ts:10`; the union is duplicated across
  `lib/ai/prompts.ts`, `types/agent.ts`, `types/supabase.ts`, `lib/billing/plans.ts`,
  UI label maps — must be widened in lock-step (ADR-0006).

## 10. Open questions (from the architect pass, unresolved)

1. ❓ V1 flag flip acceptance gate + parity-test owner (**R3**).
2. ❓ `evaluating`: deliberate dormant state or vestigial?
3. ❓ Regeneration UX: preserve drafts until success, or delete-then-regenerate intended? (**R1**)
4. ❓ Paddle go-live TODOs: cancel-at-period-end, paused/grace, customer pre-creation, spend-alerting.
5. ❓ Storage retention for live sources: age-based deletion deliberately not implemented — product decision pending?
6. ❓ `uploaded` overload: distinct queued/idle source state?
7. ❓ Buffer REST v1 aging: move all publishing to MCP, retire the OAuth manual path?

## 11. Stale / superseded docs (do not read as truth)

- `docs/agentic-v2-audit.md` — stale (claims Next 15 / stub publish; false).
- `docs/data-model.md` — predates `buffer_connections` (migration 0007) and the
  `20260908+-` migration practice.

## 12. Discovery artifacts

- `tasks/discovery-scout.md` — system map (structure, routes, components, APIs, DB,
  auth, integrations, env, tests, abstractions, debt; file:line evidence).
- `tasks/discovery-architect.md` — architecture analysis (boundaries, data flow,
  contracts, state machines, failure modes, scalability, extend-over-build verdicts,
  top-5 risks, change-first list, open questions).
- This file consolidates both; the ADRs in `docs/adr/` record the durable decisions.