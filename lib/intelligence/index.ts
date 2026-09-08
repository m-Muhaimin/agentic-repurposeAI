import { extractIntelligence } from "./extract";
import type { ContentIntelligence, EvidenceSegment, IntelligenceMetadata } from "./types";

// Orchestrator for Phase 4. `analyzeContent` is the ONLY entry the rest of the
// app uses; it returns the deterministic extraction wrapped with provenance.
// It never generates output and never calls an LLM — by construction,
// "source → intelligence, without output generation".

export { extractIntelligence } from "./extract";
export type {
  ClaimStance,
  ContentIntelligence,
  DerivedOpportunity,
  DerivedOpportunityKind,
  EntityKind,
  EvidenceSegment,
  InsightPattern,
  IntelligenceClaim,
  IntelligenceEntity,
  IntelligenceHook,
  IntelligenceInsight,
  IntelligenceMetadata,
  IntelligenceQuestion,
  IntelligenceStory,
  IntelligenceTextStats,
  IntelligenceTheme,
  IntelligenceTopic
} from "./types";

export function analyzeContent(
  text: string,
  meta: IntelligenceMetadata
): ContentIntelligence {
  if (!text || !text.trim()) {
    throw new Error("analyzeContent requires non-empty text");
  }
  return extractIntelligence(text, meta);
}

// Guard used by the persistence seam (and tests): every EvidenceSegment in an
// intelligence artifact must be a verbatim slice of the source it claims to
// come from. Anything else is a fabrication bug, checked before a row is saved.
export function assertGrounded(intelligence: ContentIntelligence, sourceText: string): void {
  const segments: EvidenceSegment[] = [
    ...intelligence.claims.map((c) => c.evidence),
    ...intelligence.quotes,
    ...intelligence.stories.flatMap((s) => s.evidence),
    ...intelligence.questions.map((q) => q.evidence),
    ...intelligence.hooks.map((h) => h.evidence),
    ...intelligence.insights.map((i) => i.evidence),
    ...intelligence.opportunities.flatMap((o) => o.anchors)
  ];
  for (const s of segments) {
    if (s.text.length === 0) throw new Error("empty evidence segment");
    if (sourceText.slice(s.start, s.end) !== s.text) {
      throw new Error(
        `evidence not grounded in source: "${s.text.slice(0, 40)}" at ${s.start}:${s.end}`
      );
    }
  }
}