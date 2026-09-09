# VervAI Source-to-Agent — Canonical Workflow Implementation Map

One page that maps each requirement of the **source-to-agent workflow** to the
code that implements it. Both repos (backend `V:\latest`, frontend
`V:\vervai-production`) are covered.

## The workflow

```
UPLOAD ──> transcription/processing ──> SOURCE (done)
              │
              ▼
        /agent/[source_id]  ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ─
        React Flow canvas view of the canonical agent graph                 │
                                                                             │
  SOURCE ─ UNDERSTAND ─ INTELLIGENCE ─ OPPORTUNITIES ─ RECOMMENDATIONS ─    │
                        PLAN ─ APPROVAL ─ CREATE ─ VALIDATE ─ REVIEW ─       │
                        PUBLISH                                               │
                                                                             ▼
        one approval gate → all formats drafted in brand voice →          published
```

## Reused systems (NOT rebuilt)

| System | Backend file | Why it already existed |
|---|---|---|
| Source creation & status machine | `lib/status.ts`, `app/api/sources/…`, `lib/ingestion/` | Upload pipeline from Create-1 |
| Run orchestration | `lib/agent/orchestrator.ts`, `planner.ts`, `evaluator.ts`, `lib/agent/tools/registry.ts` | v4 agent runtime |
| Databases | `v4_agent_runs`, `v4_agent_steps`, `v4_content_ideas`, `content_intelligence`, `outputs`, `v4_distribution_jobs` | All existing |
| Approval gate | `app/api/agent/runs/[id]/approve/route.ts` | Assist-mode gate |
| Generation | `lib/output-registry/` + `/api/repurpose` | Draft creation |
| Publishing | `app/api/agent/queue/publish/…`, Buffer client | Existing |
| Editor for drafts | `/repurpose/[id]` frontend page | Existing |
| RLS | Existing Supabase policies | Verified unchanged |

## New code

### Backend (`V:\latest`)

| File | Role |
|---|---|
| `lib/agent/graph/types.ts` | `AgentNodeType` (11 types), `AgentNodeStatus` (8 states), `AgentNode`, `AgentEdge`, `AgentGraph`, structural input types `GraphSourceRow`…`AgentGraphInput` |
| `lib/agent/graph/builder.ts` | Pure `buildAgentGraph(input)` — deterministic status derivation from durable state, no chain-of-thought or internal prompts in output |
| `lib/agent/graph/index.ts` | Re-exports |
| `lib/agent/graph/builder.test.ts` | 20 vitest cases (@see `AGENT_CANVAS_VALIDATION.md`) |
| `app/api/agent/runs/[id]/graph/route.ts` | Auth + fetch run/source/ideas/steps/outputs/distribution jobs + aggregated intelligence counts → `{ graph }` |

### Frontend (`V:\vervai-production`)

| File | Role |
|---|---|
| `types/index.ts` | `GraphNodeType`, `GraphNodeStatus`, `GraphNode`, `AgentGraph`, `GraphResponse`, `GRAPH_NODE_LABEL` |
| `lib/api/agent.ts` | `getRunGraph(runId)` — new API helper (reuses `api.get`) |
| `components/agent/agent-canvas.tsx` | Read-only `ReactFlow` canvas, single custom node renderer with status dot/badge/count, smoothstep ladder layout, fitView, MiniMap |
| `components/agent/node-detail-panel.tsx` | Per-node detail drawer — approval gate (approve all / reject all), draft list with editor links, run summary, real evidence counts |
| `app/(app)/agent/[sourceId]/page.tsx` | Rewritten: welcome panel (no run), canvas + drawer layout, 2.5s/6s polling of run+graph, run selection |
| `app/(app)/upload/page.tsx` | Format selector **removed** — source-only upload, success redirects to `/agent/{sourceId}` |
| `app/globals.css` | `.canvas-layout`, `.graph-node` + status modifiers, `.node-drawer`, `.agent-ready-panel`, `.run-kv`, responsive rules |

## Design decisions

1. **Upload purity** — the `Choose outputs` UI is gone. The backend still
   enqueues all three formats (`ALL_FORMATS`), so nothing in the processing
   pipeline changed; the run's outputs are funneled into the `CREATE` node.
2. **Graph derives from state, never persisted** — `buildAgentGraph` reads the
   same rows the dashboard read, so a stale cache cannot disagree with the run.
3. **Dynamic format registry compatible** — `formatLabels` is optional and
   defaults to `FORMAT_LABEL`, so a registry change cannot break the graph.
4. **No internal prompts exposed** — step rows only carry `kind/label/status`;
   the graph surfaces counts and statuses, not transcript slices or prompts.
5. **"Let VervAI decide"** — the first thing a user meets on a fresh source is
   the welcome panel with a single `Start workflow` action and an explanatory
   copy of the pipeline.