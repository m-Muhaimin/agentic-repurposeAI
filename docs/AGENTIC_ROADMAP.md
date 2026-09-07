# Agentic RepurposeAI — Roadmap

Status legend: ✅ done · 🟡 partial · ⬜ open · 🔵 user action (not code).

> Read this against reality first: this roadmap runs in parallel with the main
> ROADMAP.md. Everything marked ✅ below is **code-complete in this repo** (type-checks
> clean, all API routes mirror the base app's auth + ownership patterns) and the additive
> schema (`supabase/schema_agentic.sql`) is **applied and verified** against the live
> Supabase project (`npm run verify:agentic`). The remaining untested surface is the
> browser-level smoke of `/agent` — a real source + Gemini quota are needed for a first
> run to progress planning → approval → drafts. Where a stage is deliberately stubbed or
> data-model-only, the status says so rather than claiming features that don't exist.

## Stage 0 — Durable foundation
| Item | Status | Notes |
|---|---|---|
| `v4_agent_runs` — durable run row with claim/resume + cost tracker | ✅ | Status enum (`created→planning→awaiting_approval→executing→evaluating→done|failed|cancelled`) matching the base worker's 10-min stale-window semantics. `attempt`, `started_at`, `finished_at`, `cost_units`, `input/output_tokens`, `transcript_snapshot`, `output_ids` for post-hoc UI rebuilding. RLS per-user, queue index. |
| `v4_agent_steps` — append-only step history (the run's audit log) | ✅ | Every planning/source/generation/review/distribution/strategy transition persisted with input/output JSON, retry + timing metadata. This doubles as governance history for V1 (see "Ongoing items"). |
| State machine survives restarts | ✅ | Orchestrator (`lib/agent/orchestrator.ts`) claims runs atomically; nothing important lives in memory; `POST /api/agent/process` re-POST picks a parked run back up exactly like a fresh claim. |
| Schema applied to the live project | ✅ | Run `supabase/schema_agentic.sql` in the Supabase SQL editor (after the base `schema.sql`). Verified live via `npm run verify:agentic` (`scripts/verify-agentic.mjs`): all six `V4_` tables accept the rows the orchestrator/routes write (service + user clients), per-user RLS holds across accounts, check constraints reject bad values, and user-delete cascades clean agent data. 23 checks passing. |

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
| Edit-signal capture (user edits → structured hints) | 🟡 | `v4_agent_preferences.edit_signals` (append-only JSON, capped ~12) + `recordEditSignal` exist; the signal is NOT yet recorded from the editor (`/repurpose/[id]`) because the editor wasn't touched — the data model and writer are ready, the capture hook is not. |
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
🟡 Current: browser smoke of `/agent` — start the dev server, log in, pick a source whose transcript is ready, run the agent through plan → approve → drafts → confirm-gate suggestion. Then wire the editor's save button into `recordEditSignal` (Stage 2's biggest real gap), add a max-budget guard for `automate`, and only then build real Stage 4 publish actions.