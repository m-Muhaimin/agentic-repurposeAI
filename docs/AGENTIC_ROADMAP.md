# Agentic RepurposeAI — Roadmap

Status legend: ✅ done · 🟡 partial · ⬜ open · 🔵 user action (not code).

> Read this against reality first: this roadmap runs in parallel with the main
> ROADMAP.md. Everything marked ✅ below is **code-complete in this repo** (type-checks
> clean, all API routes mirror the base app's auth + ownership patterns) and the additive
> schema (`supabase/schema_agentic.sql`) is **applied and verified** against the live
> Supabase project (`npm run verify:agentic`). Since P1 the agentic V4 schema is **also
> reproducible from migrations** (`supabase/migrations/20260907000005_agentic_v4_tables.sql`),
> so a fresh `supabase db push` converges to the same state as the live project. The
> remaining untested surface is the browser-level smoke of `/agent` — a real source +
> Gemini quota are needed for a first run to progress planning → approval → drafts.
> Where a stage is deliberately stubbed or data-model-only, the status says so rather
> than claiming features that don't exist.

## Stage 0 — Durable foundation
| Item | Status | Notes |
|---|---|---|
| `v4_agent_runs` — durable run row with claim/resume + cost tracker | ✅ | Status enum (`created→planning→awaiting_approval→executing→evaluating→done|failed|cancelled`) matching the base worker's 10-min stale-window semantics. `attempt`, `started_at`, `finished_at`, `cost_units`, `input/output_tokens`, `transcript_snapshot`, `output_ids` for post-hoc UI rebuilding. RLS per-user, queue index. |
| `v4_agent_steps` — append-only step history (the run's audit log) | ✅ | Every planning/source/generation/review/distribution/strategy transition persisted with input/output JSON, retry + timing metadata. This doubles as governance history for V1 (see "Ongoing items"). |
| State machine survives restarts | ✅ | Orchestrator (`lib/agent/orchestrator.ts`) claims runs atomically; nothing important lives in memory; `POST /api/agent/process` re-POST picks a parked run back up exactly like a fresh claim. |
| Schema applied to the live project | ✅ | Run `supabase/schema_agentic.sql` in the Supabase SQL editor (after the base `schema.sql`). Reproducible from migrations since P1 (`0005_agentic_v4_tables.sql`). Verified live via `npm run verify:agentic` (`scripts/verify-agentic.mjs`): all six `V4_` tables accept the rows the orchestrator/routes write (service + user clients), per-user RLS holds across accounts, check constraints reject bad values, and user-delete cascades clean agent data. 23 checks passing. |

## Stage 1 — Agentic V1 (single deterministic loop + human gate)
| Item | Status | Notes |
|---|---|---|
| Single-call planner (not a swarm) | ✅ | `lib/agent/planner.ts`: one Gemini call (`gemini-3.6-flash`, JSON mode) → structured Content Plan (3–7 angles w/ titles, suggested formats, verbatim quotes, rationale). `validatePlan` rejects malformed output instead of silently degrading. |
| Content-idea approval surface (human gate) | ✅ | Planner writes angles to `v4_content_ideas`; the run parks at `awaiting_approval`; `POST /api/agent/runs/[id]/approve` + `PlanView` UI let the user keep/reject per angle; only approved angles are generated. Reject-all → `cancelled`. |
| Deterministic generation | ✅ | `generation` tool wraps the base `generateOutput` (Gemini + OpenRouter quota fallback) and writes each draft into the **existing `outputs` table** — agentic drafts show up in `/library` and the `/repurpose/[id]` editor with zero new viewer code (the design doc's reuse principle). |
| Deterministic evaluation (no LLM judge) | ✅ | `lib/agent/evaluator.ts`: weighted rubric (length / format-shape / grounding) flags weak drafts. No extra Gemini call per draft — keeps V1 cost where the roadmap said it should be. |
| Bounded revision | ✅ | `execute`/`automate` modes allow exactly **one** auto-revision pass on a flagged draft (`review` tool → `revisionInstruction`), then re-rank once. A second weak result stays flagged; nothing loops. `assist` mode never auto-revises. |
| Fixed per-mode permissions | ✅ | `lib/agent/permissions.ts`: `assist`/`execute`/`automate` capability sets decided once, not inferred mid-run. Tools declare the modes they require; the orchestrator filters the registry by the run's mode. |
| Cost accounting per run | ✅ | `cost_units` accumulated from real planner token counts (usageMetadata) + a coarse estimate for generation. Deliberately crude for V1 — no per-provider spend ledger yet. |
| Agent UI workspace | ✅ | `/agent` page (`app/agent/page.tsx`) + `components/agent/*`: new-run source+mode picker, run history with resume, plan approval view, durable step timeline, generated-draft list linking to the editor. Nav item in `app-shell.tsx` (Workspace group), `/agent` added to `middleware.ts` protected paths. |

## Stage 2 — Memory (brand voice + edit signals)
| Item | Status | Notes |
|---|---|---|
| Explicit, user-editable brand voice | ✅ | `v4_agent_preferences.brand_tone / brand_forbidden_phrases / brand_examples / brand_samples`. Layered into the planner prompt (`getUserBrandVoice`) and linearized into generation's system prompt. Never auto-mutated. |
| Edit-signal capture (user edits → structured hints) | ✅ | `v4_agent_preferences.edit_signals` (append-only JSON, capped ~12) + `recordEditSignal` exist; the editor's save path (`PATCH /api/outputs/[id]`) now automatically captures edit signals for agent-generated drafts via `lib/agent/edit-diff.ts` (typed diff summary). The generation tool reads recent edit signals and includes them in the system prompt. |
| Confidence-gated confirm loop | ✅ | `suggestFromSignals` derives tone/pattern suggestions from recorded signals; `GET /api/agent/preferences` returns them and `POST /api/agent/preferences/confirm` applies a tone suggestion **only** when the user confirms. No automatic profile rewrites, ever. |
| Preferences surface | 🟡 | `GET/PUT /api/agent/preferences` exist and accept explicit field edits; no dedicated preferences UI page yet (the workspace exposes mode selection; brand fields remain editable via the existing `/branding` page). |

## Stage 3 — Content strategist (seed, not the full loop)
| Item | Status | Notes |
|---|---|---|
| Strategy doc data model | ✅ | `v4_content_strategies` (title/body/source = heuristic\|planner\|manual) with RLS + `GET /api/agent/strategy`. |
| Read-only heuristic seed | ✅ | `strategy` tool derives "what this creator keeps producing / editing" over the lookback window and writes a weekly heuristic doc. User-triggered via `POST /api/agent/strategy`; the agent never auto-writes strategy. |
| Real performance-learning loop | ⬜ | No analytics pipeline, no engagement feedback, no `source='planner'` auto-docs yet — the roadmap's honest gap. |

## Stage 4 — Distribution (schedule/publish)
| Item | Status | Notes |
|---|---|---|
| `v4_distribution_jobs` data model + platform enum | ✅ | Table exists with draft/scheduled/published/failed/cancelled lifecycle and RLS. |
| BYOB Buffer publish path | ✅ | **Stage 4 (BYOB) closed.** `buffer_connections` table (migration `20260907000007`, applied live) stores AES-256-GCM-encrypted Buffer OAuth tokens (key `BUFFER_TOKEN_ENCRYPTION_KEY`, 64-hex). OAuth connect/callback/disconnect routes under `app/api/integrations/buffer/`, CSRF state cookie + timing-safe check. `publishingChannelsConnected(userId, service)` is the real async "is a channel connected" gate (queued send → 503 `PUBLISH_NOT_CONNECTED`). `lib/agent/tools/distribution.ts` is now real: reads the approved draft from `outputs`, resolves profiles + platform mapping, calls Buffer's create-update API, and flips the job to `published` (external_id + published_at) or `failed` (error_message). Manual approval only — the send is user-triggered via `POST /api/agent/queue/publish`, never autonomous. Ratelimited with Retry-After surfaced ("Retry after Xs."), no retry loop. |
| Distribution UI | ✅ | `/connections` shows a Buffer connection card (connect/disconnect, username, connected date) with `?success=buffer`/`?error=` banners; publish queue panel already consumes the API's real `channelsConnected`. |
| Scheduling + multi-channel in one click | ✅ | `POST /api/agent/queue/publish` now accepts `profileIds` (array of Buffer profile IDs, capped at 20) and `scheduledAt` (ISO-8601). `getFreshAccessToken(userId)` resolves the correct access token, refreshing it when near-expiry. `POST /api/integrations/buffer/profiles?platform=` lists connected profiles for the picker. `publish-queue-panel.tsx` exposes a profile selector, "Send now / Schedule" toggle with a `datetime-local` picker, and surfaces per-job scheduled-buffer state. Explicit profile IDs that aren't connected for the platform are rejected with an honest failure — no silent fallback. |
| Access-token refresh | ✅ | `refreshAccessToken` in `lib/buffer/oauth.ts` calls Buffer's refresh-token grant; `getFreshAccessToken` in `lib/buffer/connections.ts` reads `access_token_expires_at`, refreshes when within 60 s of expiry, preserves the stored refresh token when the refresh response omits one, and re-encrypts + persists the rotated pair. When no refresh token exists, the stale token is surfaced as-is (`refreshed: false`) — the job is flagged but not fabricated. Refresh failure (`invalid_grant`) throws `BufferOAuthError("token_refresh_failed")` → the caller marks the job failed; no retry loop. |

## Stage 5 (implicit) — Governance for agentic autonomy
| Item | Status | Notes |
|---|---|---|
| Audit/human-in-the-loop record | ✅ | `v4_agent_steps` is the append-only history of what the agent did and when; the `awaiting_approval` gate plus per-angle decisions give the durable "why this exists" trail for every draft. |
| Cost ceilings per run | 🟡 | `cost_units` tracked and logged, but no hard ceiling/max budget that parks a run — add a plan-aware cap in `lib/agent/orchestrator.ts` before `automate` runs are let loose. |
| User account deletion / privacy | 🟡 | All `V4_` tables cascade from `auth.users`, so account deletion cleans Agentic data too; no explicit export/delete flow yet (matches the base roadmap). |

## Suggested sequencing
🟡 Current: **Stage 4 (BYOB) fully closed** — Buffer connection + real publish + token refresh + profile/schedule picker in the queue panel, migration 0007 applied live, RLS verified 38/38, 167 tests green. Next: Stage 3 depth/quality improvements (performance-learning loop). P10 notes that `0007_buffer_connections` only surfaced in agentic schema when the source project has it — the agentic schema itself is stable.

> V2 master program status: `docs/agentic-v2-audit.md` is the Phase 0 as-found baseline;
> phases P0–P14 are tracked in the session todo list (P0 + P1 complete, P2 complete, P3 complete, P4 complete, P5 complete, P6 complete, P7 complete, P8 complete, P9 complete, P10 complete, P11 complete, P12 complete, P13 complete, P14 complete).
>
> **P1 (baseline hardening) closed:** migration `20260907000005_agentic_v4_tables.sql` makes the
> six `V4_` tables reproducible from `supabase db push` (live project untouched — guarded);
> `tsc --noEmit` + `npm run build` clean; new vitest unit-test infra (`lib/agent/evaluator.test.ts`,
> `lib/billing/plans.test.ts`, `lib/agent/permissions.test.ts`) — 19 tests green; GitHub Actions CI
> (`typecheck → test → build` + secrets-gated live-verifier job); types confirmed matching migration
> 0005; live verify stays green: RLS **24/24**, agentic **23/23**. API validation was audited (the
> `/api/repurpose` enqueue path already enforces format whitelist, ownership, rate limit, idempotency
> and atomic `enqueue_job` reservation) — no changes needed.
>
> **P2 (run budgets + heartbeat + cancel) closed:** migration `20260907000006_agentic_run_budgets.sql`
> adds per-run `max_steps` / `max_cost_units` / `max_runtime_s` ceilings (snapshotted server-side from
> the user's plan bounds at run creation — never client-supplied) plus `heartbeat_at`; check
> constraints enforce the ranges (1–200 steps, >0 cost, 30s–4h runtime). Pure `lib/agent/budgets.ts`
> (`budgetViolation` / `stepsRemaining`) and `lib/agent/errors.ts` (`classifyError` /
> `isTransientError`, `MAX_PHASE_ATTEMPTS = 4`) were written test-first — 15 new unit tests. The
> orchestrator uses heartbeat-based claiming (90s exec / 10-min planning), pre-call cost guards tripped
> *before* spending, transient failures stay claimable for bounded retry, permanent failures fail fast,
> and `finalizeRun()` centralizes done/cancelled/budget-stop as one partial-completion path (completed
> drafts are always kept). New `POST /api/agent/runs/[id]/cancel` handles user cancellation; the runs
> POST route snapshots `agentBudgetFor(plan)` onto the row. Migrated the live project (columns + 3
> constraints verified), extended `verify-agentic.mjs` (+6 budget/heartbeat checks). Green: `tsc
> --noEmit`, `npm run build`, RLS **24/24**, agentic **29/29**, 32 unit tests.
>
> **P3 (intelligence + memory) closed:** objective idea scoring persists onto every
> `v4_content_ideas.evaluation` at ingest (orchestrator planning step) via the new pure
> `lib/agent/idea-scoring.ts` module — deterministic rubric (grounding 0.4 / distinctness 0.3 /
> specificity 0.3, no LLM judge, no fake precision, scores rounded to 2dp) plus a `rankAngles`
> feed for the P5 strategist. Memory capture is wired: `lib/agent/memory.ts` gains typed signals
> (`kind: edit | preference | angle_decision`), a pure `appendSignal` cap helper, and
> `recordEditSignal` / `recordPreferenceSignal` / `recordAngleDecision` plus a `getRecentSignals`
> read-back; the approve route records per-angle keep/reject calls and the preferences PUT records
> explicit brand/mode changes as durable, user-scoped, RLS-protected signals. No schema change —
> both `evaluation` and `edit_signals` reuse existing jsonb columns, so the live DB is untouched.
> New vitest suites: `lib/agent/idea-scoring.test.ts` + `lib/agent/memory.test.ts` (+14 tests).
> Green: `tsc --noEmit`, `npm run build`, RLS **24/24**, agentic **29/29**, 46 unit tests.
>
> **P4 (edit-learning) closed:** the editor save path (`PATCH /api/outputs/[id]`) now
> automatically captures an edit signal whenever a user saves changes to an
> agent-generated draft. The route fetches the original content before updating,
> computes a typed diff summary via the new pure `lib/agent/edit-diff.ts` module
> (tokens added/removed, severity classification: unchanged | light_polish |
> moderate_edit | heavy_rewrite), and — when the output belongs to an agent run
> (checked via `v4_agent_runs.output_ids @> [id]`) — records a durable, user-scoped,
> RLS-protected edit signal via `recordEditSignal`. Signal capture is best-effort
> (fire-and-forget, never surfaces to the user). The generation tool now reads the
> user's last 5 edit signals via `getRecentSignals` and appends a brief context block
> to the system prompt so drafts lean toward what the user keeps vs rewrites. No
> schema change — `edit_signals` jsonb already exists. New vitest suite:
> `lib/agent/edit-diff.test.ts` (7 tests). Green: `tsc --noEmit`, `npm run build`,
> RLS **24/24**, agentic **29/29**, 53 unit tests.
>
> **P5 (strategy agent) closed — the V1→V2 crossing gate PASSED.** `POST
> /api/agent/strategy/next` answers "what should I publish next?" **without
> requiring the user to pick a source first** — it derives the candidate pool
> server-side from the user's own data (ready-transcript sources, existing
> `v4_content_ideas` with their P3 objective scores, edit/angle signals, recent
> output formats, and the monthly/plan budget) and returns a recommended next
> action + ranked alternatives + per-candidate why-not. The pure core is the new
> `lib/agent/strategy.ts` (`buildCandidates(sources, ideas, signals, budget) →
> { recommended, ranked, exclusions, headroom }`, plus `computeBudgetHeadroom`
> and a `toStrategyIdea` adapter) — fully unit-testable with no live DB. The
> deterministic scoring is grounded in P3 scores (neutral baseline for fresh
> sources), a rejected-angle penalty (P4 signals), and a format-diversity bonus,
> with budget gates (`NO_READY_TRANSCRIPT`, `BUDGET_CEILING`) producing explicit
> why-nots. The LLM adds exactly ONE advisory rationale call (GEMINI via the
> repo's existing provider, no retry loop) that can never override the
> deterministic decision and degrades to a factual restatement. The output is
> hand-shaped to the existing runs POST contract (`sourceId` + `mode`), so a UI
> "publish next" can drop straight into the existing orchestrator — the strategy
> feeds, never forks, that flow. Persistence reuses the existing
> `v4_content_strategies` table's `planner` source enum (append-only,
> user-scoped, RLS-protected snapshots) — **no schema change, no migration**, so
> the live DB is untouched and verify-agentic checks (already present for the P5
> snapshot path) stay green. New vitest suite: `lib/agent/strategy.test.ts` (9
> tests). **Gate trace:** sources/ideas/signals/budget are all read
> server-side → `buildCandidates` derives the pool with no preselected source →
> recommendation formed from user's own data ✓. Green: `tsc --noEmit`, `npm run
> build`, RLS **24/24**, agentic **32/32**, 62 unit tests.
>
> **P6 (strategy surface) closed.** The `/agent` page now carries a passive,
> read-mostly **strategy panel** (`components/agent/strategy-panel.tsx`) that
> consumes the strategy route without triggering a new strategy write — a new
> `GET /api/agent/strategy/next` recomputes `buildCandidates` deterministically,
> reads the latest persisted `planner` snapshot for its LLM rationale, and does
> NOT write or call the LLM. The panel shows: the recommended next publish
> (source → angle → formats + objective score), a collapsible ranked
> alternatives list, the why-not exclusions (per-source code + detail), the
> remaining budget headroom from real server data (`jobsRemaining` +
> per-run agent budgets), and a one-call **"Publish next"** action that selects
> a mode and routes into the existing `POST /api/agent/runs` via the workspace's
> `startRun`, dropping the created run straight into the existing
> plan → approve → drafts flow. Pure formatters (`lib/agent/strategy-panel-helpers.ts`:
> `formatScore`, `formatHeadroom`, `formatExclusionCode`) are unit-tested (10
> tests). Everything is server-authoritative: the panel requests, the server
> decides. Loading skeleton + graceful empty/error states consistent with the
> card grammar. No new auth.
>
> **P7 (decision + rationale surfaces) closed.** The run/draft UI now exposes
> the **decision trail** honestly from real data. In the run detail, each
> planned angle shows its keep/reject badge (from `v4_content_ideas.approved`),
> its P3 objective score + sub-dimensions (grounding/distinctness/specificity)
> + flagged weakness (from `ideas.evaluation`), and its rationale. The approval
> gate (`PlanView`) also surfaces the P3 score + weakness on each angle so the
> user sees *why* before deciding. A **"What the agent remembers"** readout
> (fed by `getRecentSignals` via the run-detail route, which now also returns
> the user's recent signals) renders the last few edit / angle-decision /
> preference signals — real data, never fabricated. The run-detail route gained
> one read (`getRecentSignals`) — no schema change.
>
> **P8 (budget + cost visibility) closed.** Real, server-derived budget is
> surfaced read-only. The strategy panel shows live monthly headroom
> (`jobsUsed/jobsLimit/jobsRemaining` from `getUsageSnapshot` + `resolvePlan`)
> and the per-run agent budget snapshot. The run detail now includes a **"Run
> budget"** card showing the run's snapshotted `max_steps` / `max_cost_units` /
> `max_runtime_s` columns against the run's `step_count` / `cost_units`, with a
> simple cost-usage bar computed only when both numbers are real (no invented
> figures, no fake charts). This is the P9 groundwork: read-only, no pricing or
> billing UI built. Green: `tsc --noEmit`, `npm run build`, RLS **24/24**,
> agentic **32/32**, 72 unit tests.

> **P9 (cost/spend surfaces) closed.** Honest, per-step spend is now recorded
> and surfaced, with every figure labeled. `lib/agent/spend.ts` (pure, no I/O)
> converts real provider-observed token counts into estimated USD at published
> rates (`PROVIDER_RATES`), preserves the existing `cost_units` formula exactly
> (`Math.round((in+out)/100)/100`), and aggregates per-step (`aggregateRunSpend`),
> per-run, and per-month (`aggregateMonthlySpend`) spend. The orchestrator
> thread real `usageMetadata` token counts (Gemini path) from
> `lib/ai/generate.ts` → `GenerationResult` through the generation tool into
> planning/generation step outputs as `spend` events, and persists accumulated
> real token totals on the run row (`input_tokens`/`output_tokens`). When the
> provider returns no usage metadata (OpenRouter fallback), the orchestrator
> falls back to the P2 estimate heuristic and labels the spend `estimated`.
> P2 budget guards in `lib/agent/budgets.ts` remain the single stop source — P9
> adds no parallel stop logic. UI: the run detail "Run budget" card now shows
> estimated USD + token split + per-step breakdown (each step labeled
> actual/estimated), and the strategy panel shows a "Monthly agent spend" block.
> All spend data is server-computed (service-role), never client-supplied.
> Green: `tsc --noEmit`, `npm run build`, RLS **24/24**, agentic **32/32**,
> **106** unit tests (11 files).

> **P10 (publish queue: manual approval, honest stub) closed.** The publish
> queue is now built as a human-approval workflow with **no fake publishing**.
> Pure `lib/agent/publish.ts` owns the approval state machine
> (`nextPublishStatus`: draft → scheduled → cancel/published) over the existing
> `v4_distribution_jobs` status vocabulary, `publishingChannelsConnected()` is
> always `false`, and `NOT_CONNECTED_MESSAGE` is the honest block reason —
> `published` is structurally unreachable while no channel is connected. `GET
> /api/agent/queue` lists real publishable drafts (done runs' `output_ids` +
> `outputs`) and the user's jobs, bounded by the P12 retention window. `POST
> /api/agent/queue/publish` is the single pre-send approval step: it requires
> an explicit `confirm: true`, verifies the output via the service client, and
> records a `scheduled` job that **never auto-advances** (no worker, no
> scheduling verb, no autopilot); `mode: "send"` consults the same gate and
> returns a truthful 503 with the "not connected" reason instead of fabricating
> success. The distribution stub (`tools/distribution.ts`) stays the throwing
> path. UI: `components/agent/publish-queue-panel.tsx` (queue-for-approval
> affordance + explicit not-connected banner) on the new `/agent/observe` page
> (nav entry added in `app-shell.tsx`).
>
> **Stage 4 (BYOB) closed:** P10's throwing stub is replaced by the real publish
> path — `publishingChannelsConnected()` now returns the actual Buffer
> connection state, `NOT_CONNECTED_MESSAGE` only shows when genuinely no channel
> is connected, and `tools/distribution.ts` posts approved drafts to Buffer and
> records `published`/`failed` truthfully. Manual approval before send is
> retained (the trigger is always user-clicked, never automatic).

> **P11 (observe: real insights, honest empty states) closed.** `lib/agent/observe.ts`
> (pure) computes the run funnel (runs → steps/done → drafts → approved-drafts
> from real `v4_agent_steps` + `v4_content_ideas`), and `observeDollarEstimate`
> converts real monthly token counts to a published-rate estimate. `GET
> /api/agent/observe` reads only real server rows (bounded to the retention
> window) and always flags `publishingConnected: false` and `engagementAvailable:
> false`; the `components/agent/observe-panel.tsx` renders engagement as an
> honest dashed "No data yet — connect a publishing channel" empty state, never
> fabricated numbers.

> **P12 (retention groundwork) closed.** Pure `lib/agent/retention.ts` defines
> the bounded query window (`RUN_HISTORY_MS`/`QUEUE_HISTORY_MS` = 90 days,
> `MAX_RUNS = 200`, `MAX_STEPS_PER_RUN = 500`, `MAX_QUEUE_ITEMS = 100`) and
> `withinWindow`/`capAt`; the queue + observe routes bound their reads to it.
> Data is retained in full under the hood — the window is a read-bound only.

> **P13 (scale / permission surface, read-only) closed.** Pure
> `lib/agent/scale.ts` derives a `ModeScaleSummary` per mode from
> `lib/agent/permissions.ts` and asserts the structural guarantee
> `autopilotDoorExists: false` (`scheduleIsDraftOnly: true`) — no background
> worker exists, distribution throws, so nothing can auto-advance. `GET
> /api/agent/scale` resolves the user's plan server-side (never client) and
> `components/agent/scale-panel.tsx` renders the read-only surface with an
> amber warning if the guarantee ever flips.

> **P14 (program close-out, groundwork only) closed.** No schema change (all
> work reuses `v4_distribution_jobs`, `v4_agent_runs/steps/ideas`, outputs,
> strategies, spend); live DB untouched; RLS stays per-user
> (`auth.uid() = user_id`); verify scripts stay green. New vitest suites:
> `publish.test.ts`, `observe.test.ts`, `retention.test.ts`, `scale.test.ts`
> (+33 tests). Green: `tsc --noEmit`, `npm run build`, RLS **24/24**, agentic
> **32/32**, **139** unit tests (15 files). Publishing remains human-gated:
> no provider is connected, nothing auto-sends, and the UI truthfully shows the
> "not connected" state everywhere a publish affordance exists.