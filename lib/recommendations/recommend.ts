// Phase 6: Recommendation engine entry point.
// Deterministic pipeline: evidence gate → objective fit → opportunity boost →
// confidence → combined score → user-facing label + reasons.
// No LLM. Uses the existing Output Registry as the authoritative source of
// output definitions and evidence gates.

import { outputRegistry } from "@/lib/output-registry";
import type { ContentIntelligence } from "@/lib/intelligence/types";
import type { Objective, RecommendationContext, EnrichedRecommendation } from "./types";
import { objectiveFitForObjective, objectiveFitValue } from "./objective-fit";
import { mapOpportunitiesToOutput } from "./opportunity-mapping";
import { computeConfidence, finalScore, fitLabelFromScore } from "./scoring";

// ── pipeline ────────────────────────────────────────────────────────────────

export function recommend(context: RecommendationContext): EnrichedRecommendation[] {
  const { objective, intelligence } = context;

  // 1. All registered outputs (authoritative source of truth).
  const allOutputs = outputRegistry.all();

  // 2. Registry scores — find each output's evidence score.
  const registryRecs = outputRegistry.recommend(intelligence);
  const scoreByOutputId = new Map<string, { score: number; reason: string }>();
  for (const r of registryRecs) {
    scoreByOutputId.set(r.definition.id, { score: r.score, reason: r.reason });
  }

  // 3-7. Build enriched recommendations for outputs that pass the evidence gate.
  const enriched: EnrichedRecommendation[] = [];

  for (const def of allOutputs) {
    const evidenceEntry = scoreByOutputId.get(def.id);
    const evidenceScore = evidenceEntry?.score ?? 0;

    // Evidence gate: if score === 0, exclude.
    if (evidenceScore === 0) continue;

    // Objective fit.
    const fit = objectiveFitForObjective(objective, def.id);
    const objectiveFit = objectiveFitValue(objective, def.id);

    // Opportunity strength.
    const oppResult = mapOpportunitiesToOutput(intelligence.opportunities, def.id);
    const opportunityStrength = oppResult.strength;

    // Confidence.
    const confidence = computeConfidence(intelligence);

    // Combined score.
    const score = finalScore(evidenceScore, objectiveFit, opportunityStrength, confidence);

    // Fit label from final score.
    const fitLabel = fitLabelFromScore(score);

    // Reasons — user-facing only, never internal model reasoning.
    const reasons: string[] = [];

    // Evidence reasons (from registry — already user-facing strings).
    if (evidenceEntry) {
      reasons.push(evidenceEntry.reason);
    }

    // Objective reason.
    if (fit.fit !== "not_recommended") {
      reasons.push(fit.reason);
    }

    // Opportunity reasons.
    if (oppResult.matchedKinds.length > 0) {
      reasons.push(
        `${oppResult.matchedKinds.length} opportunity match${oppResult.matchedKinds.length > 1 ? "es" : ""} boost${oppResult.matchedKinds.length > 1 ? "es" : ""} this output`
      );
    }

    enriched.push({
      definition: def,
      score,
      evidenceScore,
      objectiveFit,
      opportunityStrength,
      confidence,
      fitLabel,
      reasons,
      opportunityIds: oppResult.matchedKinds,
    });
  }

  // 10. Sort by score descending, stable.
  enriched.sort((a, b) => b.score - a.score);

  return enriched;
}
