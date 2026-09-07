// P5 strategy agent — the pure, deterministic core of "what should I publish
// next?" The V1→V2 crossing gate: V1 forced a user to pick a source first; V2
// derives candidates server-side from the user's OWN data with NO source
// preselected. Everything here is pure and DB-free so the gate is unit-testable:
//
//   buildCandidates(sources, ideas, signals, budget) → { recommended, ranked, exclusions }
//
// The reasoning is deterministic + explainable (no LLM judge, no fake
// precision). Ranking reuses the P3 `IdeaEvaluation.score` that the
// orchestrator already persists on every approved idea. A single LLM-assisted
// rationale call (see app/api/agent/strategy/next) is advisory only — it can
// never override the deterministic decision below.

import type { EditSignal, OutputFormat } from "@/types/agent";
import type { IdeaEvaluation } from "@/lib/agent/idea-scoring";

// ── Input shapes (what the route assembles from the user's own data) ─────────

export interface StrategySource {
  id: string;
  title: string;
  hasTranscript: boolean; // a source is "ready to run" iff it has a transcript
}

export interface StrategyIdea {
  // Which source this idea belongs to (resolved from its run's source).
  sourceId: string;
  runId: string;
  title: string;
  suggestedFormats: OutputFormat[];
  // The P3 objective score persisted on v4_content_ideas.evaluation; null when
  // the idea has no scored evaluation.
  score: number | null;
  evaluation: IdeaEvaluation | null;
}

export interface StrategyBudget {
  // Monthly job cap (plan.limits.maxJobsPerMonth); null = unlimited.
  jobsLimit: number | null;
  // Jobs already consumed this UTC month (the P2 metering read).
  jobsUsed: number;
  // Per-run agent budget snapshot (plan.limits.agent) that an actual run would
  // be created under — surfaced as headroom in the rationale.
  agent: { maxSteps: number; maxCostUnits: number; maxRuntimeSeconds: number };
}

export interface StrategyInput {
  sources: StrategySource[];
  ideas: StrategyIdea[];
  signals: EditSignal[];
  // Formats the user has actually produced recently (from recent outputs).
  recentFormats: OutputFormat[];
  budget: StrategyBudget;
}

// ── Output shapes ────────────────────────────────────────────────────────────

export interface StrategyCandidate {
  sourceId: string;
  sourceTitle: string;
  // The single best (highest P3-scored) angle for this source, if any.
  angleId: string | null;
  angleTitle: string | null;
  angleScore: number | null;
  formats: OutputFormat[];
  mode: "assist"; // "publish next" hands off to the existing runs POST with this
  score: number; // 0..1 deterministic, rounded to 2dp — not fabricated
  reasons: string[];
  hasReadyTranscript: boolean;
}

export interface StrategyExclusion {
  sourceId: string;
  sourceTitle: string;
  code: "NO_READY_TRANSCRIPT" | "BUDGET_CEILING" | "NO_USABLE_ANGLES";
  whyNot: string;
}

export interface BudgetHeadroom {
  jobsLimit: number | null;
  jobsUsed: number;
  jobsRemaining: number | null;
  atLimit: boolean;
  perRunAgent: { maxSteps: number; maxCostUnits: number; maxRuntimeSeconds: number };
}

export interface StrategyResult {
  recommended: StrategyCandidate | null;
  ranked: StrategyCandidate[];
  exclusions: StrategyExclusion[];
  headroom: BudgetHeadroom;
}

const FORMATS: readonly OutputFormat[] = ["linkedin_post", "newsletter", "shortform_script"];

function isOutputFormat(v: unknown): v is OutputFormat {
  return typeof v === "string" && (FORMATS as string[]).includes(v);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// A ready source needs a transcript (the agent works from one). Matches the
// runs POST contract's "transcript must exist" gate.
function isReady(src: StrategySource): boolean {
  return Boolean(src.hasTranscript);
}

// Budget headroom math — pure so it is unit-testable without Supabase.
export function computeBudgetHeadroom(budget: StrategyBudget): BudgetHeadroom {
  const remaining = budget.jobsLimit === null ? null : Math.max(0, budget.jobsLimit - budget.jobsUsed);
  const atLimit = budget.jobsLimit !== null && budget.jobsUsed >= budget.jobsLimit;
  return {
    jobsLimit: budget.jobsLimit,
    jobsUsed: budget.jobsUsed,
    jobsRemaining: remaining,
    atLimit,
    perRunAgent: { ...budget.agent }
  };
}

// Ground a candidate's score in the P3 idea score and the user's actual
// behaviour (which formats they keep producing, which angles they keep/reject).
// Deterministic and bounded — nothing loops, no clairvoyance.
function scoreCandidate(
  src: StrategySource,
  idea: StrategyIdea | null,
  recentFormats: OutputFormat[],
  signals: EditSignal[]
): { score: number; reasons: string[] } {
  const reasons: string[] = [];

  // 1) Objective idea quality (P3). A fresh source with no scored idea degrades
  //    to a neutral 0.5 (the planner will still derive angles on the run).
  const ideaScore = idea?.score ?? 0.5;
  if (idea) {
    reasons.push(`Best angle "${idea.title}" scores ${round2(ideaScore)} (P3).`);
  } else {
    reasons.push("No scored angles yet — the planner will derive them on the run.");
  }

  // 2) Format freshness: prefer formats the user has NOT just produced (less
  //    likely to feel repetitive). Averaged over the candidate's formats; a
  //    fresh source with no formats gets the neutral 0.5.
  let formatScore = 0.5;
  const formats = idea?.suggestedFormats ?? [];
  if (formats.length > 0) {
    const produced = new Set(recentFormats);
    let sum = 0;
    for (const f of formats) sum += produced.has(f) ? 0.5 : 1.0;
    formatScore = sum / formats.length;
    reasons.push(`Prefers ${formats.length > 1 ? "under-produced" : "a fresh"} format${formats.length > 1 ? "s" : ""} ${formats.join(", ")}.`);
  } else {
    reasons.push("No suggested formats yet — all three are available.");
  }

  // 3) Angle-decision signals: the user kept or rejected this exact angle.
  //    Rejection is strong user intent, so it demotes sharply but stays bounded.
  let signalAdj = 0;
  if (idea) {
    const decisions = signals.filter((s) => s.kind === "angle_decision" && s.outputId === idea.title);
    for (const d of decisions) {
      if (d.whatChanged === "approved") signalAdj += 0.05;
      if (d.whatChanged === "rejected") signalAdj -= 0.25;
    }
    if (signalAdj !== 0) {
      reasons.push(`User ${signalAdj > 0 ? "kept" : "rejected"} this angle before (${signalAdj > 0 ? "+" : "-"}${Math.abs(signalAdj)}).`);
    }
  }

  // 4) Edit signals on recently produced drafts lean toward what the user keeps
  //    editing. A lighter, flat reward signals a preference the strategy leans on
  //    without fabricating precision.
  const editSignals = signals.filter((s) => s.kind === "edit").length;
  if (editSignals >= 2) {
    signalAdj += 0.03;
    reasons.push(`${editSignals} recent edit signals — leaning toward what you keep.`);
  }

  const score = round2(Math.max(0, Math.min(1, 0.7 * ideaScore + 0.3 * formatScore + signalAdj)));
  reasons.push(`Overall priority ${score}.`);
  return { score, reasons };
}

// The core V1→V2 gate: derive candidates + why-nots with NO source preselected.
export function buildCandidates(input: StrategyInput): StrategyResult {
  const headroom = computeBudgetHeadroom(input.budget);
  const sources = input.sources ?? [];
  const ready: StrategySource[] = [];
  const exclusions: StrategyExclusion[] = [];

  for (const src of sources) {
    if (isReady(src)) {
      ready.push(src);
    } else {
      exclusions.push({
        sourceId: src.id,
        sourceTitle: src.title || "Untitled source",
        code: "NO_READY_TRANSCRIPT",
        whyNot: "No ready transcript — repurpose or finish transcription first."
      });
    }
  }

  // Budget ceiling: nothing is runnable if the monthly job budget is exhausted.
  if (headroom.atLimit) {
    for (const src of ready) {
      exclusions.push({
        sourceId: src.id,
        sourceTitle: src.title || "Untitled source",
        code: "BUDGET_CEILING",
        whyNot: "Monthly job budget reached — resets at the start of next month."
      });
    }
    return { recommended: null, ranked: [], exclusions, headroom };
  }

  // Group ideas by source; pick each source's best (highest P3 score).
  const bySource = new Map<string, StrategyIdea[]>();
  for (const idea of input.ideas ?? []) {
    bySource.set(idea.sourceId, [...(bySource.get(idea.sourceId) ?? []), idea]);
  }

  const ranked: StrategyCandidate[] = [];
  for (const src of ready) {
    const ideas = (bySource.get(src.id) ?? []).filter((i) => i.score != null);
    let best: StrategyIdea | null = null;
    if (ideas.length > 0) {
      best = [...ideas].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];
    }
    const { score, reasons } = scoreCandidate(src, best, input.recentFormats ?? [], input.signals ?? []);
    ranked.push({
      sourceId: src.id,
      sourceTitle: src.title || "Untitled source",
      angleId: best ? best.runId + ":" + best.title : null,
      angleTitle: best?.title ?? null,
      angleScore: best?.score ?? null,
      formats: (best?.suggestedFormats ?? []).filter(isOutputFormat),
      mode: "assist",
      score,
      reasons,
      hasReadyTranscript: true
    });
  }

  ranked.sort((a, b) => b.score - a.score);

  // Any ready source with ideas that are all reject-flagged or unscored is
  // still runnable (fresh angles) — but if it has ideas and ALL are rejected,
  // flag a why-not so the user understands why it isn't higher.
  for (const src of ready) {
    const ideas = bySource.get(src.id) ?? [];
    if (ideas.length > 0) {
      const allRejected = ideas.every((i) =>
        (input.signals ?? []).some((s) => s.kind === "angle_decision" && s.outputId === i.title && s.whatChanged === "rejected")
      );
      if (allRejected) {
        exclusions.push({
          sourceId: src.id,
          sourceTitle: src.title || "Untitled source",
          code: "NO_USABLE_ANGLES",
          whyNot: "All previously proposed angles for this source were rejected."
        });
      }
    }
  }

  return { recommended: ranked[0] ?? null, ranked, exclusions, headroom };
}

// Small convenience used by tests + route: map a raw idea row to StrategyIdea.
export function toStrategyIdea(row: {
  run_id: string;
  title: string;
  suggested_formats: unknown;
  evaluation: unknown;
}, sourceByRun: Record<string, string>): StrategyIdea {
  const evalObj = (row.evaluation ?? null) as IdeaEvaluation | null;
  const formats = Array.isArray(row.suggested_formats)
    ? (row.suggested_formats as unknown[]).filter(isOutputFormat)
    : [];
  return {
    sourceId: sourceByRun[row.run_id] || "",
    runId: row.run_id,
    title: row.title,
    suggestedFormats: formats.slice(0, 3),
    score: evalObj && typeof evalObj.score === "number" ? round2(evalObj.score) : null,
    evaluation: evalObj
  };
}

export { isOutputFormat, FORMATS };
