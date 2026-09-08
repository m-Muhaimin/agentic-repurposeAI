// Intentionally no runtime imports: this module declares the registry's shape
// only. The compatibility surface (lib/output-registry/registry.ts) is where
// ContentIntelligence is read.

export interface OutputRequiresEvidence {
  minTopics?: number;
  minClaims?: number;
  minHooks?: number;
  minQuotes?: number;
  minQuestions?: number;
  minStories?: number;
}

export interface OutputValidation {
  minWords?: number;
  maxWords?: number;
  minChars?: number;
  maxChars?: number;
}

export interface OutputDefinition {
  id: string;
  label: string;
  description: string;
  systemPrompt: string;
  requiresEvidence?: OutputRequiresEvidence;
  validation?: OutputValidation;
  derived?: boolean;
}

export interface OutputRecommendation {
  definition: OutputDefinition;
  score: number;
  reason: string;
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}