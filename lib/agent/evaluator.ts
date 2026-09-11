// Agentic V1 evaluator: a DETERMINISTIC rubric with NO LLM judge call. Keeping
// evaluation cheap and predictable is a hard V1 constraint (the roadmap's
// "don't make each box a separate LLM call by default"). Each draft is scored
// 0..1 across length, format-shape, and factual grounding against the
// transcript. Weak outputs are FLAGGED for review; auto-revision is bounded to
// one pass and only in execute/automate modes.

import type { EvaluationResult, ReviewFlag, OutputFormat } from "@/types/agent";

// How much weight each check carries into the final score.
const WEIGHTS = {
  length: 0.4,
  format_shape: 0.3,
  grounding: 0.3
} as const;

export interface LengthSpec {
  min: number;
  max: number;
  // A soft band where we warn but don't fail (e.g. 10% over the cap).
  tolerance: number;
}

// Per-format expectations mirroring the base prompts in lib/ai/prompts.ts.
export const LENGTH_SPECS: Record<OutputFormat, LengthSpec> = {
  linkedin_post: { min: 600, max: 1400, tolerance: 0.15 },
  newsletter: { min: 180, max: 500, tolerance: 0.15 },
  shortform_script: { min: 150, max: 700, tolerance: 0.2 },
  thread: { min: 400, max: 8000, tolerance: 0.2 },
  carousel: { min: 400, max: 8000, tolerance: 0.2 }
};

// Format-shape heuristics: a draft gets partial credit when it has the rough
// skeleton the format promises (headers for linkedin, takeaway lines, etc.).
function formatShapeScore(format: OutputFormat, content: string): { score: number; note: string } {
  switch (format) {
    case "linkedin_post":
      if (/\n{2}/.test(content) || /^[A-Z][^.!?]{20,}[.!?]/.test(content.trim())) {
        return { score: 1, note: "Multi-paragraph structure present." };
      }
      if (content.length < 250) return { score: 0.2, note: "Too thin to check structure." };
      return { score: 0.6, note: "Single block — may read as a wall of text." };
    case "newsletter":
      if (/^#{1,3}\s/m.test(content) || /takeaway|key point/i.test(content.slice(0, 200))) {
        return { score: 1, note: "Section heading / takeaway present." };
      }
      return { score: 0.6, note: "No explicit heading — structural flag for review." };
    case "shortform_script":
      // Timestamped beats (HOOK/SETUP/PAYOFF/CTA) are the format's promise.
      const beats = (content.match(/\b(hook|setup|payoff|cta)\b/gi) ?? []).length;
      if (beats >= 3) return { score: 1, note: `${beats} timed beats found.` };
      if (beats === 0) return { score: 0.2, note: "No HOOK/SETUP/PAYOFF/CTA beats." };
      return { score: 0.6, note: `${beats}/4 beats — partial skeleton.` };
    case "thread":
      // Numbered posts ("1/7", "2/7", "Thread (2/N):") are the format's promise.
      const postMarkers = (content.match(/(?:^|\n)\s*\d+\s*\/\s*\d+/g) ?? []).length;
      if (postMarkers >= 2) return { score: 1, note: `${postMarkers} numbered post markers found.` };
      if (postMarkers === 1) return { score: 0.6, note: `${postMarkers} numbered post marker — partial skeleton.` };
      return { score: 0.2, note: "No 1/N post numbering — reads like one long post, not a thread." };
    case "carousel":
      // Slide separators (Slide 1, "---", or "##") are the format's promise.
      const slides = (content.match(/^\s*(?:slide\s*\d+|---+|##+)\s*$/gim) ?? []).length;
      if (slides >= 3) return { score: 1, note: `${slides} slide separators found.` };
      if (slides === 0) return { score: 0.2, note: "No slide separators — reads like a single wall of text." };
      return { score: 0.6, note: `${slides} slide separators — partial skeleton.` };
  }
}

// Grounding: does the draft draw on the transcript rather than invent copy?
// Cheap signals: verbatim pull-quotes survive (a sign the model quoted the
// source), and we penalise drafts that are mostly boilerplate that couldn't
// have come from the source.
function groundingScore(content: string, transcript: string): { score: number; note: string } {
  const t = transcript.slice(0, 22000).toLowerCase();
  // Look for 10+ char verbatim fragments of the draft inside the transcript.
  const spans = content.match(/[A-Za-z][\w'’ -]{9,}/g) ?? [];
  const hits = spans.filter((s) => t.includes(s.toLowerCase())).length;
  const hitRate = spans.length ? hits / spans.length : 0;

  const hasSource = t.length > 200;
  if (!hasSource) return { score: 0.8, note: "Transcript too short to ground-check." };

  if (hitRate > 0.25) return { score: 1, note: "Evidence of quoting the source." };
  if (hitRate > 0.05) return { score: 0.7, note: "Some overlap with the transcript." };
  return { score: 0.3, note: "Little verbatim grounding found — review for hallucination." };
}

function lengthScore(format: OutputFormat, content: string): { score: number; note: string } {
  const spec = LENGTH_SPECS[format];
  const len = content.length;
  if (len >= spec.min && len <= spec.max) {
    return { score: 1, note: `${len} chars — within ${spec.min}-${spec.max}.` };
  }
  const overBy = len > spec.max ? (len - spec.max) / spec.max : 0;
  const underBy = len < spec.min ? (spec.min - len) / spec.min : 0;
  const over = Math.max(overBy, overBy > 0 ? overBy - spec.tolerance : 0, 0);
  const under = underBy > spec.tolerance ? underBy - spec.tolerance : 0;
  const deficit = Math.max(over, under);
  const score = Math.max(0.2, 1 - deficit * 2.5);
  return { score, note: `${len} chars (spec ${spec.min}-${spec.max}).` };
}

export function evaluateDraft(
  format: OutputFormat,
  content: string,
  transcript: string
): EvaluationResult {
  const len = lengthScore(format, content);
  const shape = formatShapeScore(format, content);
  const ground = groundingScore(content, transcript);

  const scores = { length: len.score, format_shape: shape.score, grounding: ground.score };
  const score =
    scores.length * WEIGHTS.length + scores.format_shape * WEIGHTS.format_shape + scores.grounding * WEIGHTS.grounding;

  // A flag is a FAILED check, not a merely-warned one — "flag weak outputs for
  // review" rather than auto-revise-everything.
  const flags: ReviewFlag[] = [];
  const failAt = 0.45;
  if (len.score < failAt) flags.push("length");
  if (shape.score < failAt) flags.push("format_shape");
  if (ground.score < failAt) flags.push("grounding");

  const notes = [len.note, shape.note, ground.note];
  if (flags.length === 0) flags.push("ok");

  return {
    score: Math.round(score * 100) / 100,
    flags,
    weak: flags.some((f) => f !== "ok"),
    notes
  };
}

// Bounded revision contract: flag wording + one targeted instruction, never a
// full rewrite loop. The generation tool applies exactly one revision when the
// run's mode allows it; a second weak result stops there and stays flagged.
export function revisionInstruction(flags: ReviewFlag[]): string {
  const map: Record<ReviewFlag, string> = {
    length: "Tighten or expand the draft to hit the format's length spec.",
    format_shape: "Restructure into the format's expected shape (short paragraphs / heading / timed beats).",
    grounding: "Ground every claim in the transcript — cut anything that isn't supported, quote or paraphrase direct lines.",
    ok: ""
  };
  return flags.filter((f) => f !== "ok").map((f) => map[f]).join(" ");
}