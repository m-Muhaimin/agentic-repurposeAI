// P3 idea scoring: a DETERMINISTIC, objective rubric for ranking candidate
// content angles — the feedstock the P5 strategy agent will build on. No LLM
// judge, no fake precision: every dimension is a cheap, explainable signal
// against the transcript and the sibling ideas, and the result is stored on the
// `v4_content_ideas.evaluation` jsonb column at ingest time.
//
// The draft evaluator (evaluator.ts) scores a *generated draft*; this scores a
// *proposed angle* before anything is generated, so the approval surface can
// rank candidates and surface weaknesses server-side.

import type { ContentIdea } from "@/types/agent";

export interface IdeaEvaluation {
  score: number; // 0..1 weighted, rounded to 2dp — objective, never fabricated
  grounding: number; // how much of the angle traces back to the transcript (0..1)
  distinctness: number; // how different this angle is from its siblings (0..1)
  specificity: number; // how concrete / hook-worthy the working title is (0..1)
  flags: IdeaWeakness[]; // which dimensions fell below the flag threshold
  weakness: string | null; // human note on the weakest dimension
  notes: string[];
}

// Which dimension is weak enough to flag. Mirrors the evaluator's "flag weak
// outputs, don't auto-revise" grammar — a low dimension is surfaced, never
// silently rounded away.
export type IdeaWeakness = "grounding" | "distinctness" | "specificity";

const WEIGHTS = { grounding: 0.4, distinctness: 0.3, specificity: 0.3 } as const;
const FLAG_AT = 0.45;

// The transcript is the only admissible source of truth for grounding. Words
// that carry real meaning (not stopwords) count; pull-quotes should be verbatim.
const STOPWORDS = new Set(
  "a an the and or of to in on for with about at by from into over under is are was were be been being have has had do does did will would can could should this that these those it its".split(
    " "
  )
);

function meaningfulTokens(text: string): string[] {
  return (text.toLowerCase().match(/[a-zà-ÿ0-9'-]+/g) ?? []).filter((w) => !STOPWORDS.has(w) && w.length > 2);
}

// How well the angle is grounded in the transcript: verbatim pull-quotes,
// meaningful words in the title/description/rationale that appear in the
// transcript, and the fraction of the angle that is traceable rather than
// invented. A short transcript degrades gracefully (the draft evaluator does
// the same).
function groundingScore(idea: ContentIdea, transcript: string): { score: number; note: string } {
  const t = transcript.toLowerCase().slice(0, 22000);
  const hasSource = t.length > 200;
  if (!hasSource) return { score: 0.8, note: "Transcript too short to ground-check." };

  // Verbatim quotes are the strongest grounding signal — they must appear in
  // the source to be credible hooks.
  const quotes = (idea.quotes ?? []).map((q) => q.trim().toLowerCase()).filter((q) => q.length > 0);
  const quotedHits = quotes.filter((q) => t.includes(q.slice(0, 40))).length;
  const quoteRate = quotes.length ? quotedHits / quotes.length : 0;

  // The angle's own words (title + rationale) should trace to the source.
  const own = meaningfulTokens(`${idea.title} ${idea.rationale ?? ""} ${idea.description ?? ""}`);
  const ownHits = own.filter((w) => t.includes(w)).length;
  const ownRate = own.length ? ownHits / own.length : 0;

  const score = Math.max(0, Math.min(1, 0.55 * quoteRate + 0.45 * ownRate));
  if (score >= 0.7) return { score: round2(score), note: "Idea traces closely to the source." };
  if (score >= 0.4) return { score: round2(score), note: "Partially grounded — check invented claims." };
  return { score: round2(score), note: "Weakly grounded — re-check against the transcript." };
}

// Distinctness: how different this angle's working title is from the OTHER
// angles in the same plan. The planner prompt asks for "genuinely distinct
// angles", so a candidate that re-worded a sibling is penalised. Cheap
// bigram-overlap, no embeddings. `others` must already exclude the idea itself.
function distinctnessScore(idea: ContentIdea, others: ContentIdea[]): { score: number; note: string } {
  if (!others || others.length === 0) {
    return { score: 1, note: "Single angle — nothing to distinguish against." };
  }
  const mine = new Set(meaningfulTokens(idea.title));
  if (mine.size === 0) return { score: 0.2, note: "Title has no meaningful words to assess." };

  let maxOverlap = 0;
  for (const sib of others) {
    const theirs = new Set(meaningfulTokens(sib.title));
    let shared = 0;
    for (const w of mine) if (theirs.has(w)) shared += 1;
    maxOverlap = Math.max(maxOverlap, shared / Math.max(mine.size, theirs.size));
  }

  const score = round2(1 - maxOverlap);
  if (score >= 0.7) return { score, note: "Distinct working title." };
  if (score >= 0.4) return { score, note: "Some overlap with a sibling angle." };
  return { score, note: "May repeat a sibling angle — consider a different hook." };
}

// Specificity / hook-worthiness: concrete, unusual titles beat generic ones.
// Cheap proxies the planner prompt itself values: numbers, percentages, years,
// and specific nouns ('business', 'routine') rather than vague 'the future'.
const CONCRETE = /\d|percent|%|vs\.?|against|how to|why|not|\$|eur|usd/i;
const GENERIC = /\b(future|key|thing|stuff|journey|insight|thought|great|amazing|ultimate|topic|idea|guide|tips|things)\b/i;

function specificityScore(title: string): { score: number; note: string } {
  if (!title || !title.trim()) return { score: 0, note: "No working title." };
  let score = 0.5;
  if (CONCRETE.test(title)) score += 0.3;
  if (GENERIC.test(title)) score -= 0.3;
  if (title.split(/\s+/).length >= 5) score += 0.1;
  score = Math.max(0, Math.min(1, score));
  const rounded = round2(score);
  if (rounded >= 0.7) return { score: rounded, note: "Concrete, hook-worthy title." };
  if (rounded >= 0.4) return { score: rounded, note: "Specific enough, but could be hook-ier." };
  return { score: rounded, note: "Generic title — sharpen the hook." };
}

// Score one angle against its transcript and sibling angles. Pure — no I/O —
// so it is unit-testable without Supabase.
export function scoreAngle(
  idea: ContentIdea,
  transcript: string,
  siblings: ContentIdea[] = []
): IdeaEvaluation {
  const ground = groundingScore(idea, transcript);
  const distinct = distinctnessScore(
    idea,
    siblings.filter((s) => s !== idea)
  );
  const specific = specificityScore(idea.title);

  const score = round2(
    ground.score * WEIGHTS.grounding + distinct.score * WEIGHTS.distinctness + specific.score * WEIGHTS.specificity
  );

  const flags: IdeaWeakness[] = [];
  if (ground.score < FLAG_AT) flags.push("grounding");
  if (distinct.score < FLAG_AT) flags.push("distinctness");
  if (specific.score < FLAG_AT) flags.push("specificity");

  const weakness =
    flags.length === 0
      ? null
      : flags[0] === "grounding"
        ? "This angle may not be supported by the transcript."
        : flags[0] === "distinctness"
          ? "This angle overlaps a sibling — differentiate it."
          : "This title reads generically — sharpen the hook.";

  return {
    score,
    grounding: ground.score,
    distinctness: distinct.score,
    specificity: specific.score,
    flags,
    weakness,
    notes: [ground.note, distinct.note, specific.note]
  };
}

// Rank a full plan's angles by objective score, descending. Pure — this is what
// the strategy agent (P5) will feed on: a stable, reproducible ordering.
export function rankAngles(
  angles: ContentIdea[],
  transcript: string
): Array<{ idea: ContentIdea; evaluation: IdeaEvaluation }> {
  if (!angles || angles.length === 0) return [];
  const scored = angles.map((idea) => ({
    idea,
    evaluation: scoreAngle(idea, transcript, angles)
  }));
  return scored.sort((a, b) => b.evaluation.score - a.evaluation.score);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
