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
| Worker schedule/publish verbs | ⬜ | `lib/agent/tools/distribution.ts` is a **structured stub**: in `automate` mode the capability is exposed but the tool deliberately throws `NotImplementedError` ("no post was scheduled or published"). This is the honest, gated-off state the roadmap specified — no silent no-ops pretending to publish. |
| Distribution UI | ⬜ | Nothing; gated until Stage 4 verbs are real. |

## Stage 5 (implicit) — Governance for agentic autonomy
| Item | Status | Notes |
|---|---|---|
| Audit/human-in-the-loop record | ✅ | `v4_agent_steps` is the append-only history of what the agent did and when; the `awaiting_approval` gate plus per-angle decisions give the durable "why this exists" trail for every draft. |
| Cost ceilings per run | 🟡 | `cost_units` tracked and logged, but no hard ceiling/max budget that parks a run — add a plan-aware cap in `lib/agent/orchestrator.ts` before `automate` runs are let loose. |
| User account deletion / privacy | 🟡 | All `V4_` tables cascade from `auth.users`, so account deletion cleans Agentic data too; no explicit export/delete flow yet (matches the base roadmap). |

## Suggested sequencing
🟡 Current: add a max-budget guard for `automate`, then build real Stage 4 publish actions. The editor save path is now wired to `recordEditSignal` (P4), so Stage 2 is complete.

> V2 master program status: `docs/agentic-v2-audit.md` is the Phase 0 as-found baseline;
> phases P0–P14 are tracked in the session todo list (P0 + P1 complete, P2 complete, P3 complete, P4 complete).
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