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

function evaluateEvidence(req: OutputRequiresEvidence, intel: ContentIntelligence): [number, string[]] {
  const hits: string[] = [];
  const total = Object.keys(req).length;
  if (req.minTopics != null && countArray(intel.topics) >= req.minTopics) hits.push(`${countArray(intel.topics)} topics (≥${req.minTopics})`);
  if (req.minClaims != null && countArray(intel.claims) >= req.minClaims) hits.push(`${countArray(intel.claims)} claims (≥${req.minClaims})`);
  if (req.minHooks != null && countArray(intel.hooks) >= req.minHooks) hits.push(`${countArray(intel.hooks)} hooks (≥${req.minHooks})`);
  if (req.minQuotes != null && countArray(intel.quotes) >= req.minQuotes) hits.push(`${countArray(intel.quotes)} quotes (≥${req.minQuotes})`);
  if (req.minQuestions != null && countArray(intel.questions) >= req.minQuestions) hits.push(`${countArray(intel.questions)} questions (≥${req.minQuestions})`);
  if (req.minStories != null && countArray(intel.stories) >= req.minStories) hits.push(`${countArray(intel.stories)} stories (≥${req.minStories})`);
  const score = total > 0 ? hits.length / total : 0;
  return [score, hits];
}

function scoreDefinition(req: OutputRequiresEvidence, intel: ContentIntelligence): [number, string] {
  const [score, hits] = evaluateEvidence(req, intel);
  const reason = hits.length > 0
    ? `fits: ${hits.join("; ")}`
    : `missing: ${Object.entries(req)
        .map(([k, v]) => `${k.replace(/^min/, "")} ≥${v}`)
        .join(", ")}`;
  return [score, reason];
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