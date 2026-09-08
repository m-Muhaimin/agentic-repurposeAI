---
name: vervai-orchestrator
description: "Coordination layer for VervAI content runs — plan, review, and execute multi-step content pipelines. Use when planning/reasoning about the VervAI Orchestrator (lib/agent/orchestrator), wiring a recommendation into a plan, or deciding step/approval/retry/idempotency policy."
---

# VervAI Orchestrator v1

The coordination layer that turns a VervAI recommendation into a reviewable,
approved, multi-step plan. It lives at `lib/agent/orchestrator/` and is a PURE,
testable policy package — it does NOT reimplement intelligence, generation,
validation, publishing, or the durable agent runtime.

## Boundaries

- **It coordinates, it does not do.** The orchestrator never reimplements:
  - intelligence (`lib/intelligence/`)
  - recommendation engine (`lib/recommendations/`)
  - the Output Registry (`lib/output-registry/`) — the AUTHORITATIVE registry; reuse, never fork
  - generation / validation / publishing (existing tools + queues)
  - the durable runtime (`lib/agent/orchestrator.ts`: claim/resume/budget/cancel),
    the tool registry, provider abstraction, billing, permissions
- It reuses the existing run/step model (`v4_agent_runs` / `v4_agent_steps`),
  the agent mode capability sets (`types/agent.ts` + `lib/agent/permissions.ts`),
  and the shared retry classification (`lib/agent/errors.ts`).

## Design rules (v1)

- **Deterministic, no LLM in the policy path.** `canTransition`, `buildPlan`,
  `nextStep`, `decideRetry`, `stableKey` are pure functions with tests
  (`lib/agent/orchestrator/orchestrator.test.ts`).
- **Approval is a hard gate for consequential work.** ALL publishing is
  externally human-initiated. `awaiting_approval → executing` only via
  `→ approved →`. Plans are immutable once approved; editing bumps the version
  and requires re-approval (`newPlanVersion`, `isApprovalValidFor`).
- **Ownership is always server-resolved.** `buildContext` / `resolveContext`
  refuse contexts carrying references the requesting user does not own.
- **Publishing stays manual.** v1 plans never auto-schedule a publish step;
  publish is the existing manual queue panel.
- **No new deps.** All modules are side-effect-free and interoperate with the
  existing recommendation/error/event types.

## Module map

| Module | Responsibility |
| --- | --- |
| `types.ts` | Orchestration domain model + lifecycle/status/tool-risk/error taxonomy |
| `state-machine.ts` | `canTransition` / `transitionPath` / `canPause` / `canCancel` |
| `context.ts` | `buildContext` / `resolveContext` ownership-resolved context |
| `planner.ts` | `buildPlan` / `newPlanVersion` recommendations → structured steps |
| `approvals.ts` | version-bound `decide` / `isApprovalValidFor` / `isExecutable` |
| `executor.ts` | `nextStep` / `markStepDone` / `allStepsDone` deterministic tick |
| `retry.ts` | transient/permanent budget + `backoff` (reuses `isTransientError`) |
| `idempotency.ts` | `stableKey` / `alreadyRan` / `persistKeySafely` |
| `policies.ts` | tool risk class → autonomous authority |
| `errors.ts` | code → user-safe message |
| `events.ts` | status → label + analytics event |
| `index.ts` | public API + `createRun` |

## Workflow (how to use it)

1. Load the objective + context (`buildContext` / `resolveContext`).
2. Run the recommendation engine (`lib/recommendations`), then `buildPlan` to
   make it a structured, reviewable plan.
3. If `plan.approvalRequired`, park it and show `statusLabel("awaiting_approval")`.
   Use `isExecutable` to gate the transition to execution.
4. While executing, drive the existing runtime and use `nextStep` to pick the
   next step, `markStepDone/Failed` to report, `decideRetry` for backoff, and
   `stableKey` to dedupe repeat runs.
5. On completion callers persist to `v4_agent_runs` and emit
   `runEventFor("completed")`.

## References

- Architecture: `docs/VERVAI_ORCHESTRATOR_ARCHITECTURE.md`
- Runbook: `docs/VERVAI_ORCHESTRATOR_RUNBOOK.md`
- Shared error classification: `lib/agent/errors.ts`
