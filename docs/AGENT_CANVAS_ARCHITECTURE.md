# AGENT CANVAS — Architecture

## The graph is derived, not stored

`GET /api/agent/runs/[id]/graph` is an **auth-guarded read-only projection** of
the durable run state. It:

1. Loads the `v4_agent_runs` row (scoped to `user_id` via `createServiceClient`
   and an extra equality filter), the source row, and the run's
   `v4_agent_steps`, `v4_content_ideas`, `outputs`, and `v4_distribution_jobs`.
2. Aggregates `content_intelligence` into **counts only** — topics, claims,
   quotes, insights, opportunities. Never the transcript, evidence text, or
   prompts.
3. Passes a plain-scalar `AgentGraphInput` into `buildAgentGraph`.

`buildAgentGraph` is a **pure function** in `lib/agent/graph/builder.ts`. It
returns the 11-node canonical graph plus edges connecting the present stages.
Nothing is written anywhere.

## Node status derivation (deterministic)

| Node | Derivation |
|---|---|
| `source` | `source.status` → `completed`(done) / `running`(transcribing/generating) / `failed` / `queued`(uploaded). Fallback: run exists ⇒ completed |
| `understand` | `steps` kind `source`/`ingestion`, else first non-`planning` step; idle before a run starts |
| `intelligence` | `content_intelligence` counts present, else the `planning` step status |
| `opportunity` | `ideas.length` and `evidenceCount` (sum of idea quotes); status from planning/executing |
| `recommendation` | plan existence + ideas status |
| `plan` | run `plan` present → completed; `planning` in flight → running; else idle |
| `approval` | `awaiting_approval` → awaiting; `cancelled` → skipped; approved ≥1 idea while executing → completed |
| `create` | `outputs.length` > 0 → completed; generation step running → running |
| `validate` | evaluator step state |
| `review` | outputs exist and run done → completed |
| `publish` | distribution job rows → completed count, else queued/running |

**Failure pass**: on `failed`, the last active node is marked `failed`, all
descendants are recomputed as `idle` or `skipped` (so the pipeline stops where
it broke and `Retry available` can point there).

**Cancellation pass**: nodes after the approval gate are `idle`/`skipped`.

**Edge pruning**: an edge is only emitted when at least one endpoint is
`present` (not `idle`), so the canvas never draws a chain into the void.

## Frontend

`components/agent/agent-canvas.tsx` uses `@xyflow/react` v12 with:

- a **single custom node type**; `data.node` is a `GraphNode` from the API
- status → `dot` color + `badge` class mapping (design tokens
  `--teal/sage/gold/coral`)
- `fitView` on mount; nodes not draggable/connectable/selectable; attribution
  hidden; `MiniMap` for orientation on tall graphs
- a vertical ladder layout (`x:0`, `y:i*96`) computed by `layoutNodes`

`components/agent/node-detail-panel.tsx` is the only interactive surface:

- **approval** node → real plan review (approved/rejected with the existing
  `POST …/runs/[id]/approve`), `Approve all` / `Reject all`
- **create/review** node → the run's outputs with links into the existing
  `/repurpose/[source_id]` editor
- all other nodes → status, counts, formats, evidence, error message

## State & refresh

`app/(app)/agent/[sourceId]/page.tsx` owns state. It polls:

- run detail + graph together every **2.5s while in flight**, else **6s**
- side metrics (strategy, preferences, publish queue) once on mount

It is client-side for the poll loop; leaf reads come from the same
`lib/api/*` helpers the rest of the app uses.

## Compatibility with the dynamic registry

`buildAgentGraph(input, formatLabels?)` accepts an optional map. When the
output registry changes, only labels change; ids like `custom_longform` pass
through untouched and the graph still renders.

## Security

- Every read is scoped by `user_id` (RLS + explicit equality filters).
- The endpoint exposes counts/status/ids only; no prompts, no transcripts, no
  evidence text, no keys.
- Approve/regenerate/publish go through the existing auth-gated routes.