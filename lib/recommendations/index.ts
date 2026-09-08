// Phase 6: Recommendation engine — public API.
// Re-exports types + the recommend function. Consumers import from here.

export type { Objective, ObjectiveFit, RecommendationContext, EnrichedRecommendation } from "./types";
export { objectiveFitForObjective, objectiveFitValue } from "./objective-fit";
export { mapOpportunitiesToOutput, mappingEntries } from "./opportunity-mapping";
export { computeConfidence, finalScore, fitLabelFromScore } from "./scoring";
export { recommend } from "./recommend";
export type { FitLabel } from "./scoring";
