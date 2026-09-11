// P5 strategy agent — pure candidate building and ranking. This is the
// "what should I publish next?" engine that answers WITHOUT requiring the
// user to pick a source first. All data arrives via StrategyInput (no I/O),
// so the function is unit-testable without Supabase. The route layer
// (app/api/agent/strategy/next) does the DB reads, calls buildCandidates,
// adds one LLM rationale, and persists a snapshot.
//
// The output is directly consumable by the existing runs POST contract:
// `recommended.sourceId` + suggested mode → POST /api/agent/runs.

import type { EditSignal, OutputFormat, IdeaEvaluation } from "@/types/agent";

// ── Input types (the shape the route layer assembles from DB reads) ────────

export interface StrategySource {
  id: string;
  title: string;
  hasTranscript: boolean;
}

export interface StrategyIdea {
  sourceId: string;
  runId: string;
  title: string;
  suggestedFormats: OutputFormat[];
  score: number | null;
  evaluation: IdeaEvaluation | null;
}

export interface StrategyInput {
  sources: StrategySource[];
  ideas: StrategyIdea[];
  signals: EditSignal[];
  recentFormats: OutputFormat[];
  budget: {
    jobsLimit: number | null;
    jobsUsed: number;
    agent: { maxSteps: number; maxCostUnits: number; maxRuntimeSeconds: number };
  };
}

// ── Candidate scoring ──────────────────────────────────────────────────────

export interface Candidate {
  sourceId: string;
  sourceTitle: string;
  score: number;
  angleTitle: string | null;
  formats: OutputFormat[];
  reasons: string[];
}

export type ExclusionCode = "NO_READY_TRANSCRIPT" | "BUDGET_CEILING";

export interface Exclusion {
  sourceId: string;
  sourceTitle: string;
  code: ExclusionCode;
  detail: string;
}

export interface BudgetHeadroom {
  jobsLimit: number | null;
  jobsUsed: number;
  jobsRemaining: number | null;
  atLimit: boolean;
  perRunAgent: { maxSteps: number; maxCostUnits: number; maxRuntimeSeconds: number };
}

export interface StrategyRecommendation extends Candidate {
  headroom: BudgetHeadroom;
}

export interface StrategyResult {
  recommended: StrategyRecommendation | null;
  ranked: Candidate[];
  exclusions: Exclusion[];
  headroom: BudgetHeadroom;
}

// ── Pure helpers ───────────────────────────────────────────────────────────

const NEUTRAL_SCORE = 0.5;
const REJECT_PENALTY = 0.35;
const FRESH_SOURCE_BOOST = 0.05;
const UNDER_PRODUCED_BONUS = 0.08;

// Compute how much monthly budget is left for new runs.
export function computeBudgetHeadroom(budget: StrategyInput["budget"]): BudgetHeadroom {
  const jobsRemaining = budget.jobsLimit === null
    ? null
    : Math.max(0, budget.jobsLimit - budget.jobsUsed);
  const atLimit = budget.jobsLimit !== null && budget.jobsUsed >= budget.jobsLimit;
  return {
    jobsLimit: budget.jobsLimit,
    jobsUsed: budget.jobsUsed,
    jobsRemaining,
    atLimit,
    perRunAgent: { ...budget.agent }
  };
}

// Count how many times a source's angles appear in rejected angle signals.
function rejectCount(sourceId: string, ideas: StrategyIdea[], signals: EditSignal[]): number {
  const titles = new Set(ideas.filter((i) => i.sourceId === sourceId).map((i) => i.title));
  return signals.filter(
    (s) => s.kind === "angle_decision" && s.whatChanged === "rejected" && titles.has(s.outputId)
  ).length;
}

// Format-frequency map from recent outputs. Higher count = more produced.
function formatFrequency(recentFormats: OutputFormat[]): Map<OutputFormat, number> {
  const freq = new Map<OutputFormat, number>();
  for (const f of recentFormats) freq.set(f, (freq.get(f) ?? 0) + 1);
  return freq;
}

// Does this source have at least one format that was under-produced recently?
function hasUnderProducedFormat(
  suggested: OutputFormat[],
  freq: Map<OutputFormat, number>
): boolean {
  if (suggested.length === 0) return false;
  const avg = suggested.reduce((sum, f) => sum + (freq.get(f) ?? 0), 0) / suggested.length;
  return avg < 1; // produced 0 times in the recent window
}

// ── Core: buildCandidates (the V1→V2 gate) ────────────────────────────────
//
// Pure function. No I/O. Same inputs → same output, always.
// A source becomes a candidate ONLY if:
//   1. It has a ready transcript (hasTranscript = true)
//   2. The monthly job budget is not exhausted
// Every candidate gets an objective score; the highest-scoring is recommended.

export function buildCandidates(input: StrategyInput): StrategyResult {
  const headroom = computeBudgetHeadroom(input.budget);
  const freq = formatFrequency(input.recentFormats);
  const ranked: Candidate[] = [];
  const exclusions: Exclusion[] = [];

  for (const source of input.sources) {
    // Gate 1: transcript must exist.
    if (!source.hasTranscript) {
      exclusions.push({
        sourceId: source.id,
        sourceTitle: source.title,
        code: "NO_READY_TRANSCRIPT",
        detail: "Source has no ready transcript — finish transcription or repurpose first."
      });
      continue;
    }

    // Gate 2: monthly budget.
    if (headroom.atLimit) {
      exclusions.push({
        sourceId: source.id,
        sourceTitle: source.title,
        code: "BUDGET_CEILING",
        detail: `Monthly job budget exhausted (${headroom.jobsUsed}/${headroom.jobsLimit}). Resets next month.`
      });
      continue;
    }

    // Score this source from its best attached idea.
    const sourceIdeas = input.ideas.filter((i) => i.sourceId === source.id);
    const bestIdea = sourceIdeas.length
      ? sourceIdeas.reduce((best, cur) => {
          const s = cur.score ?? 0;
          return s > (best.score ?? 0) ? cur : best;
        })
      : null;

    let score = NEUTRAL_SCORE;
    const reasons: string[] = [];

    if (bestIdea && bestIdea.score != null) {
      score = bestIdea.score;
      reasons.push(`Best idea "${bestIdea.title}" scored ${bestIdea.score} (objective rubric).`);
    } else {
      reasons.push("No scored ideas yet — ranked at neutral baseline; planner will derive angles.");
    }

    // Fresh-source boost: a source with no ideas at all and no rejected
    // angles gets a small bump — it's a clean slate the planner can work with.
    if (sourceIdeas.length === 0 && rejectCount(source.id, input.ideas, input.signals) === 0) {
      score = Math.min(1, score + FRESH_SOURCE_BOOST);
      reasons.push("Fresh source (no history) — clean slate boost.");
    }

    // Rejected-angle penalty: the user explicitly rejected angles from this
    // source before, so it's less likely to be the best next move.
    const rejects = rejectCount(source.id, input.ideas, input.signals);
    if (rejects > 0) {
      score = Math.max(0, score - REJECT_PENALTY);
      reasons.push(`${rejects} angle(s) previously rejected — penalised.`);
    }

    // Format diversity bonus: prefer sources whose suggested formats are
    // under-produced in recent outputs, so the creator's library stays varied.
    const suggested = bestIdea?.suggestedFormats ?? [];
    if (hasUnderProducedFormat(suggested, freq)) {
      score = Math.min(1, score + UNDER_PRODUCED_BONUS);
      reasons.push("Suggested format is under-produced recently — diversity bonus.");
    }

    ranked.push({
      sourceId: source.id,
      sourceTitle: source.title,
      score: Math.round(score * 100) / 100,
      angleTitle: bestIdea?.title ?? null,
      formats: suggested.length ? suggested : ["linkedin_post", "newsletter", "shortform_script", "thread", "carousel"],
      reasons
    });
  }

  // Stable descending sort; equal scores preserve input order.
  ranked.sort((a, b) => b.score - a.score);

  const recommended: StrategyRecommendation | null = ranked.length
    ? { ...ranked[0], headroom }
    : null;

  return { recommended, ranked, exclusions, headroom };
}

// ── Adapter: map DB rows to StrategyIdea (used by the route layer) ─────────

export function toStrategyIdea(
  row: { run_id: string; title: string; suggested_formats: unknown; evaluation: unknown },
  sourceByRun: Record<string, string>
): StrategyIdea | null {
  const sourceId = sourceByRun[row.run_id];
  if (!sourceId) return null;
  const eval_ = (row.evaluation ?? null) as IdeaEvaluation | null;
  const formats = Array.isArray(row.suggested_formats)
    ? (row.suggested_formats as OutputFormat[])
    : [];
  return {
    sourceId,
    runId: row.run_id,
    title: row.title,
    suggestedFormats: formats,
    score: eval_?.score ?? null,
    evaluation: eval_
  };
}
