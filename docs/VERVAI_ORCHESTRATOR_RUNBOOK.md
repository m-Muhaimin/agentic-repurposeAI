# VervAI Orchestrator v1 — Runbook

Operational guidance for running and debugging VervAI orchestrated runs.

## Safety invariants

1. **Publishing is always human-initiated.** No code path in v1 posts content
   without a real person clicking publish in the queue panel.
2. **Approved plans are immutable.** Any plan change goes through
   `newPlanVersion` (bumps version → re-approval required). Never mutate an
   approved plan in place.
3. **Ownership is asserted server-side.** `buildContext`/`resolveContext` throw
   on a reference the requesting user doesn't own.
4. **No new dependencies.** If a change needs one, stop and justify it.

## Creating a run

1. Resolve the objective + ready sources.
2. `buildContext` (assert ownership) → run recommended steps → `buildPlan`.
3. If `plan.approvalRequired`, park at `awaiting_approval` and show
   `statusLabel("awaiting_approval")` ("Needs your approval").
4. Persist the plan/approval/run to `v4_agent_runs` (existing tables). Emit
   `runEventFor(status)`.

## Approving

- Gate the approval→execution transition with `isExecutable(runId, plan, userId,
  approval)`.
- `approval` from `decide()` is version-bound: editing the plan afterward makes
  the old approval invalid automatically.
- Rejection (`decision: "rejected"`) is also version-bound and must be re-decided
  on a new plan version.

## Driving the executor

- `nextStep(plan, state)` → next runnable step id (respects deps + approval).
- Report results with `markStepDone` / `markStepFailed`. Use
  `markStepRunning` before handing off to the worker.
- `allStepsDone(plan, state)` signals completion.

## Retrying failed steps

- `decideRetry(err, attempt, policy)`:
  - permanent (`isTransientError === false`) → `{ action: "fail" }`;
  - transient within budget → `{ action: "retry", attempt, delayMs }` (backoff);
  - transient past budget → fail.
- Default policy: 4 attempts, base 500 ms, cap 30 s. Backoff is bounded.

## Idempotency / dedupe

- `stableKey({ user, run, objective, sourceIds, outputId })` → key.
- Guard execution with `alreadyRan(seam, key)` and persist via `persistKeySafely`.
- Source order is normalized, so re-runs with reordered sources don't duplicate.

## Tool-risk authority

- `riskForTool(name)` → `read` | `write` | `consequential`.
- `mayActAutonomously(mode, risk)`:
  - `consequential` → NO mode acts autonomously (publishing always gated);
  - `write` → assisted/agent may;
  - `read` → all modes may.
- `stepRequiresApproval(mode, stepType)` drives the UI's approve surface.

## Common failure modes

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `nextStep` returns null forever | approval not granted, or a dep never completed | Check `planApproved`; inspect `stepStatus` |
| Approval "doesn't apply" | plan version bumped after approval | Re-approve the new version (`newPlanVersion`) |
| Repeated transient failures | provider quota/network | Let `decideRetry` budget handle it; check logs for `429`/`503` |
| Duplicate outputs | missing idempotency key/persist | Verify `stableKey` + `persistKeySafely` converged with the schema index |
| Publish step present in plan | plan auto-scheduled publish (v1 forbids) | Plans never include publish auto-steps; route to the manual queue |

## Validation checklist

- `npm test` — all suites green (incl. `lib/agent/orchestrator/orchestrator.test.ts`).
- `npx tsc --noEmit` — clean.
- `npm run build --prefix W:/repupose-ai-v4` — succeeds.
- `npm run brand-check` — exit 0 (no unexpected legacy branding).