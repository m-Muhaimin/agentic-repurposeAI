# Agentic RepurposeAI V2 — Phase 0 Repository Audit

Audit date: 2026-09-07. Repository: `W:\repupose-ai-v4`, git `725ce89 first commit` (clean tree).
Scope: current state before the V2 master implementation (phases P0–P14). This document is the
as-found baseline; every phase below will diff against it.

## 1. Architecture overview

- Next.js 15 (App Router, TypeScript) + Supabase (hosted Postgres). No ORM — typed supabase-js clients.
- Three input paths, all producing a *transcript* (the canonical repurposing input):
  1. file upload of an audio/video to storage;
  2. YouTube source (Google OAuth captions, yt-dlp fallback for videos);
  3. direct transcript file.
- Request path is **enqueue → worker**, never synchronous generation:
  - `POST /api/repurpose` enqueues a row in `jobs` via `enqueue_job` RPC and returns immediately;
  - `POST /api/process` claims jobs, ingests the transcript, generates outputs, marks `done`;
  - dashboard polls `GET /api/sources` every 4s.
- AI providers: **Gemini 3.6-flash** (generation + agent planning), **AssemblyAI** (transcription),
  **OpenRouter** (quota fallback for Gemini). No provider rotation/key management yet.
- An **agentic layer (V1, shipped)** sits on top: `/agent` workspace with runs, plans, approval gates,
  and a durable step timeline. Agent drafts are written into the *existing* `outputs` table so they
  appear in `/library` and `/repurpose/[id]` with zero new viewer code.
- Storage: private `sources` bucket, folder-scoped policies under `sources/{user_id}/{filename}`.

## 2. Agent architecture (V1, base for V2)

- **Autonomy modes** with fixed capability sets (`lib/agent/permissions.ts`): `assist` (plan/generate/
  review/evaluate, no revise), `execute` (+ one bounded auto-revision), `automate` (toggle revise +
  distribute/strategize — those two tools are **honest stubs**, never silent no-ops). Mode is fixed per
  run; a tool can never escalate beyond its mode.
- **Tool registry** (`lib/agent/tools/*`): `source`, `intelligence` (planner), `memory` (brand voice +
  edit signals), `generation`, `review` (deterministic evaluator), `distribution` (throws
  `NotImplementedError`), `strategy` (read-only heuristic seed writing `v4_content_strategies`).
- **Orchestrator** (`lib/agent/orchestrator.ts`): claims/resumes runs with the same 10-minute stale
  window as the base worker; every transition persists a `v4_agent_steps` row; nothing important lives
  in memory between requests. State machine `created → planning → awaiting_approval → executing →
  evaluating → done | failed | cancelled`.
- **Planner** (`lib/agent/planner.ts`): ONE Gemini call, transcript → structured `ContentPlan`.
  Prompt says 3–7 angles; validator accepts 1–7. Pull-quotes must be verbatim. Model returns JSON via
  `responseMimeType: "application/json"`; usage metadata captured for rough cost units.
- **Evaluator** (`lib/agent/evaluator.ts`): **deterministic rubric, no LLM judge**. Weighted score —
  length 0.4 / format-shape 0.3 / grounding 0.3, `failAt` 0.45. Weak drafts get exactly ONE revision
  instruction; a second weak result stays flagged (no revise loop).
- **Memory** (`lib/agent/memory.ts` + `/api/agent/preferences`): brand voice is explicit, user-editable
  fields (tone/forbidden/examples). Edits to drafts are stored as append-only `edit_signals` (cap ~12),
  NOT profile rewrites. Suggestions are confidence-gated (`minConfidence` 0.6) and applied only through
  the `/api/agent/preferences/confirm` endpoint — background auto-application of the profile is by
  design impossible.
- Runs require a source with status `done|failed` (transcript must exist).

## 3. UI surface

- **Agent workspace**: `app/agent/page.tsx` + `components/agent/{agent-workspace,run-list,plan-view,
  run-detail,timeline}.tsx`. Run list → plan approval → generation timeline → drafts. Polls the DB via
  REST `/api/agent/runs*`; the `/api/agent/process` SSE stream is progress-only.
- **Base app** (unchanged by V2): dashboard (4s poll), upload flow, `repurpose/[id]` viewer,
  `branding` (custom prompts), `connections` (YouTube), `content library`, settings.
- Protected via `middleware.ts`: `/dashboard, /upload, /repurpose, /branding, /connections, /library,
  /agent, /settings, /reset-password`.

## 4. Database & RLS

Schema truth lives in two places today (see §9 for the gap):

1. `supabase/schema_agentic.sql` — the six **V4_** tables (applied live + verified):
   `v4_agent_runs`, `v4_agent_steps`, `v4_content_ideas`, `v4_agent_preferences`,
   `v4_distribution_jobs`, `v4_content_strategies`.
2. `supabase/migrations/0001`–`0004` — committed, guarded, idempotent:
   - **0001**: baseline of the live project (sources/outputs/jobs/user_prompts/youtube_connections/
     transcripts + storage policies).
   - **0002**: `profiles` (plan per user, auto-created by auth trigger), `events` (service-role-only
     analytics ledger), `jobs.idempotency_key` + `jobs.refunded`, `outputs.regeneration_count`,
     `sources.duration_seconds`.
   - **0003**: explicit USING **and** WITH CHECK on every update policy (defense-in-depth). Intentionally
     no update policies on profiles/events/outputs/ledger.
   - **0004**: billing ledger `usage_events` (append-only, RLS on with NO policies), `subscriptions`,
     `subscription_events`, and the atomic `enqueue_job` RPC.

**Security posture (consistent with V2 §P1 requirements):**
- every table RLS-enabled; select/insert/update/delete strictly owner-scoped via `auth.uid() = user_id`;
- `events`, `usage_events`, `subscription_events`: RLS **on with no policies** → invisible to clients;
- `profiles`: clients read their own row, never write (plan is server-only);
- `enqueue_job` + `enqueue_job`: **REVOKED from PUBLIC**, EXECUTE granted to `service_role` only, so an
  anonymous caller cannot reserve jobs for arbitrary users;
- `verify-rls.mjs` cross-checks all of the above live.

## 5. Worker semantics

- Base worker (`/api/process`): claim (with 10-min stale re-claim), attempt++, ingest transcript,
  generate formats, mark done. Same stale-window pattern reused by the agent orchestrator.
- Agent worker (`/api/agent/process`): SSE stream is progress-only; UI re-reads durable rows.

## 6. AI providers / prompt & gap handling

- `gemini-3.6-flash` in both `lib/ai/generate.ts` (transcript sliced to 15k) and `lib/agent/planner.ts`
  (sliced to 22k). `lib/ai/retry.ts` wraps overload errors with a bounded jittered backoff (~90 s budget);
  a real failure falls back to OpenRouter (quota path).
- Missing-provider/degraded behaviors degrade gracefully: memory returns null on missing table,
  analytics + ledger writes are logged warnings never thrown into the product path, base worker keeps a
  stale-claim fallback.

## 7. Billing (P3 scaffold — already partially built)

- `lib/billing/plans.ts`: pure config module. `beta` is the only `isPublic`/`available` tier.
  Creator/Pro/Studio exist so enforcement paths are exercised but stay off the marketing surface.
- **Enforcement** lives in the DB (`enqueue_job` RPC): per-user advisory `xact` lock → UTC-month count →
  cap check → insert job → `reserve` ledger row. Atomic; **fails closed** (503 on any RPC error).
  `idempotency_key` handles replay without double-reserving.
- `lib/billing/ledger.ts`: best-effort `reserve|consume|refund|release` writes (log-warn, never throw).
- `lib/billing/entitlements.ts`: `resolvePlan` reads `profiles.plan` (fail-open to beta); `ensureProfile`
  lazily upserts a profile row.
- `lib/billing/usage.ts` + `/api/usage`: **display only** (fail-open), never gates.
- `subscriptions`/`subscription_events`: provider-contract scaffold, **no payment provider wired** and
  nothing writes them yet — open decision point for a later phase.
- **Gap flagged here**: the base repurpose path bills through `enqueue_job`, but **agent runs insert
  `v4_agent_runs` directly** — agent generation is not metered against the monthly job budget yet.
  (V2 P2/P9 must close this.)

## 8. Analytics (validation phase)

- `lib/analytics/event-names.ts` (pure) + `lib/analytics/events.ts` (service-role writes to `events`,
  never throw). `/api/events` bridge lets clients post through the server; `usage-client.ts` is the
  browser fetch helper (returns null on failure).
- Threshold events fire exactly once per crossing (50/80/100%).
- No external analytics provider; internal `events` table is the source.

## 9. Gaps / debt for V2 (from P0 inspection)

1. **V4 schema reproducibility**: the six V4_ tables exist only in `schema_agentic.sql` (applied live),
   they are **not** in `supabase/migrations/`. A `0005` migration is needed so a fresh project converges
   via `supabase db push` alone. → P1.
2. **Generated DB types**: `types/supabase.ts` is hand-written; `scripts/gen-types.mjs` exists but the
   supabase CLI isn't authenticated (no `SUPABASE_ACCESS_TOKEN`), so `npm run db:types` is unavailable.
   Risk of drift; → P1.
3. **No unit tests / no CI**: the only verification is `verify:rls`, `verify:agentic`, `tsc`, and
   `npm run build`. Vitest + GitHub Actions (typecheck→lint→tests→build) are P1 deliverables.
4. **Agent runs unmetered** (see §7) — V2 P2/P9 budget work must cover agent cost.
5. **No run budgets** (`maxSteps/maxCost/maxRuntime`), no heartbeat/cancellation/partial-completion for
   agent runs. → P2.
6. **Old V1 prototype code / unused scaffolding** may remain (e.g. `supabase/schema.sql` tail that is
   superseded by migrations). Confirm-and-clean in P1, carefully.
7. **`.env.example` vs `.env.local` drift**: `.env.local` carries a stale unused
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; no `YTDLP_*` vars locally. Align the example file in P1.
8. **Autopilot not safe**: `automate` mode exists but distribution is a throwing stub and strategy is a
   heuristic seed; the mode must not be exposed until P5+ backend is real (per V2 spec, no fake
   publishing).
9. **No cost/spend tracking** beyond a coarse `cost_units` token estimate — P2/P9.

## 10. Verification baseline (must keep passing)

- `npm run verify:rls` — cross-user RLS checks incl. profiles/events/usage_events/subscriptions.
- `npm run verify:agentic` — 23 checks on the six V4_ tables (row shapes service+user clients, check
  constraints, cross-user isolation, cascade delete). **Currently 23/23 live.**
- `npx tsc --noEmit` and `npm run build` — clean at audit time.
- `npm run lint` is an interactive wizard — intentionally skipped (per repo convention).

## 11. Phase traceability

| V2 phase | As-found status |
|---|---|
| P0 audit | THIS DOCUMENT |
| P1 foundation | migrations/billing/analytics/scaffold partially built; gaps §9 |
| P2 runtime hardening | not started (no budgets/heartbeat/cancellation) |
| P3 content intelligence | not started |
| P4 memory/edit-learning | V1 seed exists (`edit_signals` + confirm gate) |
| P5 strategy agent | `strategyTool` heuristic seed exists; real agent is the P5 gate |
| P6–P14 UI/devops | not started |