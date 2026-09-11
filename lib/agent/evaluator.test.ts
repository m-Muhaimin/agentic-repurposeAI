// Unit tests for the deterministic agent evaluator — the rubric that V1 uses
// instead of an LLM judge. These run without any network/Supabase access.

import { describe, expect, it } from "vitest";
import { evaluateDraft, LENGTH_SPECS, revisionInstruction } from "@/lib/agent/evaluator";

const TRANSCRIPT = `The most underrated thing in content creation is consistency. Most people quit
after three weeks because they chase a viral hit instead of a habit. I found
that publishing on a fixed schedule — even when something underperforms — is
what actually compounds. When I started, I did one short-form clip a day for
ninety days straight. Nothing went viral until week seven. But the catalogue
of clips meant every new work could reference old ones, and the algorithm
finally knew what I was about.`;

describe("evaluateDraft", () => {
  it("scores a well-formed, well-grounded draft highly", () => {
    const draft = `Consistency beats virality, every time.\n\nThe most underrated thing in content creation is consistency. Most people quit after three weeks because they chase a viral hit instead of a habit. I found that publishing on a fixed schedule, even when something underperforms, is what actually compounds.\n\nWhen I started, I did one short-form clip a day for ninety days straight. Nothing went viral until week seven. But the catalogue of clips meant every new work could reference old ones, and the algorithm finally knew what I was about.\n\nThe takeaway: don't optimize for the single hit. Optimize for the habit, and let the catalogue do the compounding.`;
    const result = evaluateDraft("linkedin_post", draft, TRANSCRIPT);
    expect(result.weak).toBe(false);
    expect(result.score).toBeGreaterThan(0.6);
    expect(result.flags).toContain("ok");
  });

  it("flags an over-tight draft for length", () => {
    const result = evaluateDraft("linkedin_post", "Too short.", TRANSCRIPT);
    expect(result.flags).toContain("length");
    expect(result.weak).toBe(true);
  });

  it("flags a draft with no grounding in the transcript", () => {
    const invented = "Quantum trading desks are the future of everything. Buy now. ".repeat(30);
    const result = evaluateDraft("newsletter", invented, TRANSCRIPT);
    expect(result.flags).toContain("grounding");
    expect(result.weak).toBe(true);
  });

  it("flags shortform scripts missing HOOK/SETUP/PAYOFF/CTA beats", () => {
    const flat = "Here is some content. It has no beats at all.".repeat(12);
    const result = evaluateDraft("shortform_script", flat, TRANSCRIPT);
    expect(result.flags).toContain("format_shape");
  });

  it("flags threads missing numbered post markers (1/N)", () => {
    const flat = "One long block of text with no numbering whatsoever.".repeat(30);
    const result = evaluateDraft("thread", flat, TRANSCRIPT);
    expect(result.flags).toContain("format_shape");
  });

  it("passes threads with numbered post markers", () => {
    const thread = "1/3 Consistency beats virality.\n\n2/3 The habit compounds.\n\n3/3 Number the takeaways.";
    const result = evaluateDraft("thread", thread, TRANSCRIPT);
    expect(result.flags).not.toContain("format_shape");
  });

  it("flags carousels missing slide separators", () => {
    const flat = "A wall of text that never marks slides at all.".repeat(30);
    const result = evaluateDraft("carousel", flat, TRANSCRIPT);
    expect(result.flags).toContain("format_shape");
  });

  it("passes carousels with slide separators", () => {
    const carousel = "Slide 1\nWhat consistency does\n\n---\nSlide 2\nThe compounding effect\n\n---\nSlide 3\nThe CTA";
    const result = evaluateDraft("carousel", carousel, TRANSCRIPT);
    expect(result.flags).not.toContain("format_shape");
  });

  it("scoring weights match the documented rubric", () => {
    // length 0.4 / format_shape 0.3 / grounding 0.3
    expect(Object.keys(LENGTH_SPECS).sort()).toEqual(
      ["linkedin_post", "newsletter", "shortform_script", "thread", "carousel"].sort()
    );
  });
});

describe("revisionInstruction", () => {
  it("produces one targeted instruction per flag", () => {
    const instruction = revisionInstruction(["length", "grounding"]);
    expect(instruction).toContain("length spec");
    expect(instruction).toContain("Ground every claim");
  });

  it("returns empty for an ok draft", () => {
    expect(revisionInstruction(["ok"])).toBe("");
  });
});