# ADR-0004 — Agent drafts land in the existing outputs table; distribution never fabricates 'published'

## Context

The agent generates one draft per approved angle × suggested format. A separate
viewer/table for agent drafts would fork the library and editor surfaces and double
the maintenance. Distribution needs an honest audit trail for scheduled vs aired
posts.

## Decision

- **Drafts reuse `outputs`**: the agent's generation writes straight into the
  existing `outputs` table (same service-client pattern as the repurpose worker), so
  agent drafts appear in `/library` and the `/repurpose/[id]` editor with **zero new
  viewer code**. `outputs` has exactly two writers: the worker and the agent runtime.
- **Distribution honesty**: a future-send keeps `v4_distribution_jobs` at
  `scheduled` with `external_id` + `scheduled_at`; `published` is written **only**
  after Buffer confirms the update aired (`lib/agent/tools/distribution.ts` →
  `POST api.bufferapp.com/1/updates/create.json`). Manual human send is the only
  immediate path (`automate`-mode tool registry sends are the agent equivalent);
  never auto-publish, never a fabricated `published` state.
- Buffer OAuth/API-key rows are sentinel-guarded so an API-key-only connection is
  treated as not connected for the manual GraphQL send (`lib/buffer/connections.ts`).

## Consequences

- Zero new viewer surface; editing/regeneration budgets and edit-signal capture apply
  equally to agent drafts (all edits go through the service client).
- The publish queue is a read-and-act surface over `v4_distribution_jobs`, not a new
  state machine. Scheduled jobs park until run; there is deliberately no
  auto-publish scheduler.