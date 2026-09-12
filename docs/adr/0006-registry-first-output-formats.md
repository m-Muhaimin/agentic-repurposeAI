# ADR-0006 — Registry-first output formats: lib/output-registry is the source of truth

## Context

"What outputs exist" lived as hard-coded `FORMATS/FORMAT_LABELS/FORMAT_DESCRIPTIONS/
PROMPTS` constants in `lib/ai/prompts.ts`, duplicated again in `types/agent.ts`,
`types/supabase.ts`, `lib/billing/plans.ts` and UI label maps. `thread` and
`carousel` became first-class LLM formats and the duplication cost real widening
work across every copy.

## Decision

- **`lib/output-registry/` is the single source of truth** for the output catalog
  (`definitions.ts` → `registry.ts` singleton → `types.ts`). Any new format is added
  to `definitions.ts` FIRST; the registry drives `lib/recommendations` (evidence
  gates + scoring) and UI labels.
- `lib/ai/prompts.ts` is a thin typed façade over the registry (`OutputFormat` union
  = the five ids: `linkedin_post | newsletter | shortform_script | thread |
  carousel`). Widenings of the union and the parallel copies are deliberate,
  one-time, and must stay in lock-step with the registry (ARCHITECTURE_FREEZE §1).
- The `OutputFormat` union is deliberately NOT open-ended — leaking arbitrary
  registry ids into it would silently change generation behavior. A registry-only
  format is a design boundary, not a bug.
- Thread/carousel widened end-to-end via migration `20260911000001`
  (`outputs.format` CHECK + `jobs.formats` default) plus the façade, `types/agent.ts`,
  `types/supabase.ts`, `lib/billing/plans.ts` and UI label maps.

## Consequences

- Alignment is regression-pinned: `lib/output-registry/registry.test.ts`
  ("legacy façade ↔ registry alignment").
- Live trap (risk R5): the exported constant is still **`LIGEND_DEFINITIONS`**
  (`definitions.ts:10`, typo — rename to `LEGEND_DEFINITIONS` on the change-first
  list) and the five parallel `OutputFormat` copies must widen in lock-step.
- New formats ship in one deliberate, reviewable change touching registry + union +
  plans + types, not five ad-hoc edits.