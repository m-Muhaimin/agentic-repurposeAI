// Phase 6: Combined scoring.
// finalScore = evidenceScore × (0.5 + 0.5 × objectiveFit) × (1 + opportunityStrength) × confidence
// All components bounded 0..1.

import type { ContentIntelligence } from "@/lib/intelligence/types";

// ── confidence ────────────────────────────────────────────────────────────────

const BASELINE_CONFIDENCE = 0.8;
const MULTI_OPP_BONUS = 0.1;
const LONG_CONTENT_BONUS = 0.1;
const CONFIDENCE_CAP = 1.0;

/**
 * Computes confidence from the intelligence artifact.
 * Baseline 0.8, +0.1 if multiple opportunities match, +0.1 if textStats.words > 500,
 * capped at 1.0.
 */
export function computeConfidence(intelligence: ContentIntelligence): number {
  let c = BASELINE_CONFIDENCE;

  if (intelligence.opportunities.length > 1) {
    c += MULTI_OPP_BONUS;
  }

  if ((intelligence.textStats?.words ?? 0) > 500) {
    c += LONG_CONTENT_BONUS;
  }

  return Math.min(c, CONFIDENCE_CAP);
}

// ── final score ──────────────────────────────────────────────────────────────

/**
 * Combines evidence, objective fit, opportunity strength, and confidence into
 * a single 0..1 score.
 *
 * Formula:
 *   finalScore = evidenceScore × (0.5 + 0.5 × objectiveFit)
 *                × (1 + opportunityStrength) × confidence
 *
 * All inputs are expected to be in [0, 1].
 */
export function finalScore(
  evidenceScore: number,
  objectiveFit: number,
  opportunityStrength: number,
  confidence: number
): number {
  const base = 0.5 + 0.5 * objectiveFit;
  const oppMultiplier = 1 + opportunityStrength;
  const raw = evidenceScore * base * oppMultiplier * confidence;
  return Math.min(1, Math.max(0, raw));
}

// ── fit label ────────────────────────────────────────────────────────────────

export type FitLabel = "Strong fit" | "Good fit" | "Possible" | "Not recommended";

/**
 * Assigns a user-facing fit label from the final combined score.
 */
export function fitLabelFromScore(score: number): FitLabel {
  if (score >= 0.7) return "Strong fit";
  if (score >= 0.45) return "Good fit";
  if (score >= 0.2) return "Possible";
  return "Not recommended";
}
