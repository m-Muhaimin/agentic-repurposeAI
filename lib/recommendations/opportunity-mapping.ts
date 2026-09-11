// Phase 6: Opportunity → output mapping.
// Maps DerivedOpportunityKind values to output IDs using the registry's actual
// IDs (linkedin_post, newsletter, shortform_script, thread, carousel), each with
// a per-opportunity strength boost (0.05..0.15). Deterministic, no LLM.

import type { DerivedOpportunity, DerivedOpportunityKind } from "@/lib/intelligence/types";

// Each entry: which output IDs this opportunity kind boosts, and how much per
// matched opportunity (capped globally at 0.3 total across all matched kinds).
interface MappingEntry {
  opportunityKind: DerivedOpportunityKind;
  outputIds: string[];
  strength: number; // per-opportunity boost, 0.05..0.15
}

const MAP: MappingEntry[] = [
  {
    opportunityKind: "question_led",
    outputIds: ["shortform_script", "linkedin_post"],
    strength: 0.12,
  },
  {
    opportunityKind: "clip",
    outputIds: ["shortform_script", "linkedin_post"],
    strength: 0.15,
  },
  {
    opportunityKind: "claim_post",
    outputIds: ["linkedin_post", "newsletter", "thread"],
    strength: 0.12,
  },
  {
    opportunityKind: "story_newsletter",
    outputIds: ["newsletter", "shortform_script"],
    strength: 0.10,
  },
  {
    opportunityKind: "quote_carousel",
    outputIds: ["linkedin_post", "carousel"],
    strength: 0.05,
  },
];

const OPPORTUNITY_STRENGTH_CAP = 0.3;

// ── public API ────────────────────────────────────────────────────────────────

/**
 * Computes the total opportunity strength for a given output ID from the set
 * of derived opportunities in the intelligence artifact.
 *
 * `matchedKinds` is filled with the opportunity kinds that contributed (for
 * the reasons array and debugging).
 */
export function mapOpportunitiesToOutput(
  opportunities: DerivedOpportunity[],
  outputId: string
): { strength: number; matchedKinds: string[] } {
  let total = 0;
  const matchedKinds: string[] = [];

  for (const entry of MAP) {
    if (entry.outputIds.includes(outputId)) {
      const count = opportunities.filter((o) => o.kind === entry.opportunityKind).length;
      if (count > 0) {
        const boost = entry.strength * count;
        total += boost;
        matchedKinds.push(entry.opportunityKind);
      }
    }
  }

  total = Math.min(total, OPPORTUNITY_STRENGTH_CAP);

  return { strength: total, matchedKinds };
}

/**
 * Returns the raw mapping entries (for tests / inspection).
 */
export function mappingEntries(): Readonly<MappingEntry>[] {
  return MAP;
}
