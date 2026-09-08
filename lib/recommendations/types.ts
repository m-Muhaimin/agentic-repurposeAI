import type { OutputDefinition } from "@/lib/output-registry/types";
import type { ContentIntelligence, DerivedOpportunity, DerivedOpportunityKind } from "@/lib/intelligence/types";

export type { OutputDefinition } from "@/lib/output-registry/types";
export type { ContentIntelligence, DerivedOpportunity, DerivedOpportunityKind } from "@/lib/intelligence/types";

// ── Objective ────────────────────────────────────────────────────────────────

export type Objective =
  | { kind: "grow_linkedin"; label: string }
  | { kind: "grow_email"; label: string }
  | { kind: "get_reach"; label: string }
  | { kind: "clarify_ideas"; label: string }
  | { kind: "drive_action"; label: string };

// ── Objective Fit ────────────────────────────────────────────────────────────

export type ObjectiveFit = {
  outputId: string;
  fit: "strong" | "good" | "possible" | "not_recommended";
  reason: string;
};

// ── Recommendation Context ───────────────────────────────────────────────────

export type RecommendationContext = {
  objective: Objective;
  intelligence: ContentIntelligence;
};

// ── Enriched Recommendation ──────────────────────────────────────────────────

export type EnrichedRecommendation = {
  definition: OutputDefinition;
  score: number; // 0..1 combined score
  evidenceScore: number; // from registry (0..1)
  objectiveFit: number; // 0..1
  opportunityStrength: number; // 0..1
  confidence: number; // 0..1
  fitLabel: "Strong fit" | "Good fit" | "Possible" | "Not recommended";
  reasons: string[]; // human-readable, never internal
  opportunityIds: string[]; // which opportunity kinds contributed
};
