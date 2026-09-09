# AGENT CANVAS — Validation

Automated validation is done in-repo. Manual/browser validation must be
performed from a logged-in browser (this environment cannot reach Vercel).

## Automated (passed)

Backend `V:\latest`:

- `npx tsc --noEmit` — clean.
- `npm test` — **455 tests, 0 failures**, including the 20 graph tests
  (`lib/agent/graph/builder.test.ts`):
  - structural: 11 nodes in canonical order, edges pruned correctly
    (7 upstream edges + approval gate for `awaiting_approval`, all 10 when done)
  - status derivation per node (source, approval, create, review, intelligence)
  - failure pass marks only the last active node failed
  - cancellation pass leaves the post-approval pipeline idle
  - dynamic registry compatibility via custom `formatLabels`

Frontend `V:\vervai-production`:

- `npx tsc --noEmit` — clean.
- `npm run build` — succeeded; `/agent/[sourceId]` and `/upload` both compile.

## Deployed

- Backend → `verv-ai-backend.vercel.app` (aliased ✓)
- Frontend → `verv-ai.vercel.app` (aliased ✓)

## Manual browser checklist

1. Upload a source from `/upload` — no format checkboxes should appear; button
   says `Upload source`; success screen links to `/agent/{sourceId}`.
2. Let the source finish processing, open the agent workspace.
3. First visit shows the **Let Vervai decide** welcome panel; click
   `Start workflow`.
4. Canvas updates ladder style, node by node, ending in an
   `awaiting_approval` gate.
5. Click the approval node → plan review drawer; `Approve all` starts drafts.
6. Create/Review nodes link into the existing editor at `/repurpose/{id}`.
7. Publish node reflects the queue; a completed graph shows all 10 edges.
8. Trigger a failure (e.g. exceed a step budget) → the last node turns red with
   `Retry available`, no downstream node shows stale `completed`.
9. Mobile viewport: canvas and drawer stack; touch target at least 44px on the
   approval actions.

## Known gaps / notes

- The sandbox cannot reach the deployed hosts (`curl`/`WebFetch` both time out);
  verify step 1–9 from a browser.
- The Drive migration `20260908000005_drive_connections.sql` from the prior
  task still needs applying in the Supabase SQL editor, and the Drive callback
  URI must be registered in the Google OAuth console.