// Phase 4: Content intelligence — grounded, source-anchored analysis of a
// canonical transcript that is INDEPENDENT of output generation. Everything here
// is either extracted verbatim from the source text (evidence carries exact
// offsets) or marked `synthesized: true` to say "derived, not generated".
//
// `analyzeContent` (see ./index.ts) is a PURE function: no LLM, no server
// client, no env. The reader gets topics, themes, claims, quotes, stories,
// questions, hooks, entities, insights and — later consumed by Phase 6 — a set
// of derived opportunities that a human can approve into real outputs.

export interface EvidenceSegment {
  /** Verbatim slice of the canonical transcript. */
  text: string;
  /** Char offset of the first character in the canonical transcript. */
  start: number;
  /** Exclusive char offset (end) in the canonical transcript. */
  end: number;
  readonly verbatim: true;
}

export type ClaimStance = "assertion" | "conjecture" | "citation";

export interface IntelligenceClaim {
  text: string;
  stance: ClaimStance;
  /** Heuristic confidence 0..1 — derived from frequency/markers, never fabricated. */
  confidence: number;
  evidence: EvidenceSegment;
}

export interface IntelligenceTopic {
  label: string;
  occurrences: number;
  /** 0..1, heavier weighting toward earlier sentences. */
  confidence: number;
}

export interface IntelligenceTheme {
  label: string;
  topics: string[];
}

export interface IntelligenceQuestion {
  text: string;
  rhetorical: boolean;
  evidence: EvidenceSegment;
}

export interface IntelligenceHook {
  text: string;
  kind: "opening" | "stat" | "open_loop" | "rhetorical";
  evidence: EvidenceSegment;
}

export type EntityKind = "person" | "organization" | "place" | "product" | "other";

export interface IntelligenceEntity {
  label: string;
  kind: EntityKind;
  mentions: number;
}

export interface IntelligenceStory {
  summary: string;
  evidence: EvidenceSegment[];
}

export type InsightPattern = "cause_effect" | "contrast" | "generalization";

export interface IntelligenceInsight {
  text: string;
  pattern: InsightPattern;
  evidence: EvidenceSegment;
}

export type DerivedOpportunityKind =
  | "question_led"
  | "clip"
  | "claim_post"
  | "story_newsletter"
  | "quote_carousel";

export interface DerivedOpportunity {
  kind: DerivedOpportunityKind;
  title: string;
  pitch: string;
  /** Verbatim anchors that ground this opportunity in the source. */
  anchors: EvidenceSegment[];
  /** Always true: this is a derived suggestion, never a generated output. */
  synthesized: true;
}

export interface IntelligenceTextStats {
  chars: number;
  words: number;
  sentences: number;
}

export interface ContentIntelligence {
  sourceId: string;
  sourceType: string;
  title: string;
  topics: IntelligenceTopic[];
  themes: IntelligenceTheme[];
  claims: IntelligenceClaim[];
  /** Verbatim segments pulled from quote marks in the source. */
  quotes: EvidenceSegment[];
  stories: IntelligenceStory[];
  questions: IntelligenceQuestion[];
  hooks: IntelligenceHook[];
  entities: IntelligenceEntity[];
  insights: IntelligenceInsight[];
  opportunities: DerivedOpportunity[];
  provenance: "deterministic";
  analyzedAt: string;
  textStats: IntelligenceTextStats;
}

export interface IntelligenceMetadata {
  sourceId: string;
  sourceType: string;
  title: string;
  analyzedAt?: string;
}