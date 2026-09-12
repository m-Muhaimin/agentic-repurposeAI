# ADR-0003 — v1 orchestrator as a pure policy package + sibling bridge behind an env flag

## Context

The agent runtime (`lib/agent/orchestrator.ts`, the durable worker) grew hot and
repetitive; the team wanted a reviewed, unit-testable lifecycle (15 states, plan/
approval/execution) without rewriting the runtime or risking the production path.

## Decision

- **Pure policy package** `lib/agent/orchestrator/` (16 files): state machine,
  planner, executor tick, approvals, retry, idempotency, policies, events. PURE per
  `types.ts:11-13` — no network/DB/side-effect imports — so it is safe for any
  server code to import.
- **Bridge** `lib/agent/orchestrator-bridge.ts` (1001 lines) maps the 15-state v1
  policy onto the 8-state runtime tables. It is a **sibling** of the runtime, never
  part of the policy package (purity contract) and never inside the hot path.
  Deep-import rule (`:10-14`): policy pieces only via deep paths; never the bare
  specifier `@/lib/agent/orchestrator` (which resolves to the runtime file).
- **Flag gate**: `VERVAI_ORCHESTRATOR_V1` read once per request at the seam
  (`lib/agent/orchestrator/flag.ts:1-4`, `app/api/agent/process/route.ts:3-5`);
  flag OFF by default → the bridge is currently inert in production (dead-by-design
  until a staged flip).

## Consequences

- The 15→8 status map is explicit and lossy — it refuses `paused` (bridge `:72-102`);
  the runtime has no paused concept.
- `evaluating` is claimable + rendered but no code path writes it (bridge `:89,116`) —
  dormant, open question.
- **Cost (R3)**: `v1Planning :367-576` / `v1Execution :580-853` duplicate runtime
  logic ("transcribed from runtime"); there is no differential test (runtime vs
  `processAgentRunV1` on the same run). Any runtime edit must be mirrored or the flag
  can never flip. A composable-phases refactor would have been cheaper; accepted as
  the price of a zero-risk rollout path.