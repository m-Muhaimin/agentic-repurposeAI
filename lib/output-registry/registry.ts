import type { ContentIntelligence } from "@/lib/intelligence/types";
import type { OutputDefinition, OutputRecommendation, OutputRequiresEvidence, ValidationResult } from "./types";

// ── registry ───────────────────────────────────────────────────────────────

class OutputRegistry {
  private defs = new Map<string, OutputDefinition>();

  register(def: OutputDefinition): this {
    if (!def.id || def.id.length > 64) throw new Error(`invalid output id: "${def.id}"`);
    this.defs.set(def.id, def);
    return this;
  }

  get(id: string): OutputDefinition | undefined {
    return this.defs.get(id);
  }

  all(): OutputDefinition[] {
    return [...this.defs.values()];
  }

  /** Returns the registered IDs in insertion order (matches old FORMATS shape). */
  formats(): string[] {
    return this.all().map((d) => d.id);
  }

  /**
   * Returns every registered definition scored against the given intelligence.
   * Outputs whose `requiresEvidence` attributes are not met receive score 0 and
   * are excluded. Among qualifying outputs, score = 0..1 derived from how many
   * evidence thresholds are met (more evidence = higher score). The list is
   * sorted descending by score.
   */
  recommend(intelligence: ContentIntelligence): OutputRecommendation[] {
    return this.all()
      .map((def) => {
        if (!def.requiresEvidence) return { definition: def, score: 1, reason: "no evidence gate" };
        const [score, reason] = scoreDefinition(def.requiresEvidence, intelligence);
        return { definition: def, score, reason };
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score);
  }

  validate(id: string, content: string): ValidationResult {
    const def = this.defs.get(id);
    if (!def) return { ok: false, errors: [`unknown output format: "${id}"`] };
    return validateContent(def, content);
  }
}

// ── scoring ────────────────────────────────────────────────────────────────

function countArray<T>(v: T[] | undefined): number {
  return Array.isArray(v) ? v.length : 0;
}

function evaluateEvidence(req: OutputRequiresEvidence, intel: ContentIntelligence): { allMet: boolean; hits: string[]; missing: string[]; ratios: number[] } {
  const hits: string[] = [];
  const missing: string[] = [];
  const ratios: number[] = [];
  const has = (min: number | undefined, got: number, label: string, minLabel: number) => {
    if (min == null) return;
    if (got >= min) {
      hits.push(`${label}: ${got} (≥${minLabel})`);
      ratios.push(Math.min(got / Math.max(minLabel, 1), 3));
    } else {
      missing.push(`${label} needs ≥${minLabel} (got ${got})`);
    }
  };
  has(req.minTopics, countArray(intel.topics), "topics", req.minTopics ?? 0);
  has(req.minClaims, countArray(intel.claims), "claims", req.minClaims ?? 0);
  has(req.minHooks, countArray(intel.hooks), "hooks", req.minHooks ?? 0);
  has(req.minQuotes, countArray(intel.quotes), "quotes", req.minQuotes ?? 0);
  has(req.minQuestions, countArray(intel.questions), "questions", req.minQuestions ?? 0);
  has(req.minStories, countArray(intel.stories), "stories", req.minStories ?? 0);
  return { allMet: missing.length === 0, hits, missing, ratios };
}

function scoreDefinition(req: OutputRequiresEvidence, intel: ContentIntelligence): [number, string] {
  const { allMet, hits, missing, ratios } = evaluateEvidence(req, intel);
  if (!allMet) return [0, `missing: ${missing.join("; ")}`];
  // All minimums met → score starts at 0.5 and rises toward 1 as counts overshoot
  // their requirement (clamped: 3x requirement = full score).
  const overshoot = ratios.length ? ratios.reduce((a, b) => a + b, 0) / ratios.length : 1;
  return [Math.min(1, 0.5 + 0.5 * (Math.min(overshoot, 2.5) - 1) / 1.5), `fits: ${hits.join("; ")}`];
}

// ── validation ─────────────────────────────────────────────────────────────

function words(content: string): number {
  return (content.trim().match(/\S+/g) ?? []).length;
}

function validateContent(def: OutputDefinition, content: string): ValidationResult {
  const v = def.validation;
  if (!v) return { ok: true, errors: [] };
  const errors: string[] = [];
  const wc = words(content);
  const cc = content.length;
  if (v.minWords != null && wc < v.minWords) errors.push(`${wc} words (min ${v.minWords})`);
  if (v.maxWords != null && wc > v.maxWords) errors.push(`${wc} words (max ${v.maxWords})`);
  if (v.minChars != null && cc < v.minChars) errors.push(`${cc} chars (min ${v.minChars})`);
  if (v.maxChars != null && cc > v.maxChars) errors.push(`${cc} chars (max ${v.maxChars})`);
  return { ok: errors.length === 0, errors };
}

// ── singleton ──────────────────────────────────────────────────────────────

export const outputRegistry = new OutputRegistry();
export { OutputRegistry, validateContent, scoreDefinition };
export type { OutputDefinition, OutputRecommendation, OutputRequiresEvidence, ValidationResult } from "./types";