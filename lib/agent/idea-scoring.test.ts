// Unit tests for the P3 idea-scoring rubric — the deterministic, objective
// layer that ranks candidate angles before anything is generated. Pure module,
// no network/Supabase access, mirroring the evaluator.test.ts style.

import { describe, expect, it } from "vitest";
import { scoreAngle, rankAngles } from "@/lib/agent/idea-scoring";
import type { ContentIdea } from "@/types/agent";

const TRANSCRIPT = `The most underrated thing in content creation is consistency. Most people quit
after three weeks because they chase a viral hit instead of a habit. I found
that publishing on a fixed schedule — even when something underperforms — is
what actually compounds. When I started, I did one short-form clip a day for
ninety days straight. Nothing went viral until week seven. But the catalogue
of clips meant every new work could reference old ones, and the algorithm
finally knew what I was about.`;

const wellGrounded: ContentIdea = {
  title: "Why consistency compounds — the 90-day clip habit",
  description: "Publishing daily for ninety days",
  suggestedFormats: ["linkedin_post"],
  quotes: ["Nothing went viral until week seven", "consistency"],
  rationale: "The transcript's core thesis is about consistency compounding."
};

const sibling: ContentIdea = {
  title: "How a fixed schedule beats chasing virality",
  description: "A habit over a hit",
  suggestedFormats: ["newsletter"],
  quotes: [],
  rationale: "Publishing on a fixed schedule, even underperforming."
};

describe("scoreAngle", () => {
  it("scores a well-grounded, distinct, specific angle highly", () => {
    const e = scoreAngle(wellGrounded, TRANSCRIPT, [sibling]);
    expect(e.score).toBeGreaterThan(0.6);
    expect(e.weakness).toBeNull();
    expect(e.flags).toEqual([]);
  });

  it("rounds scores to 2dp (no fake precision)", () => {
    const e = scoreAngle(wellGrounded, TRANSCRIPT, [sibling]);
    expect(e.score * 100).toBe(Math.round(e.score * 100));
    for (const dim of [e.grounding, e.distinctness, e.specificity]) {
      expect(dim * 100).toBe(Math.round(dim * 100));
    }
  });

  it("flags an angle with no grounding in the transcript", () => {
    const invented: ContentIdea = {
      title: "Quantum trading desks",
      description: "Buy now",
      suggestedFormats: ["newsletter"],
      quotes: ["buy now"],
      rationale: "The future of trading"
    };
    const e = scoreAngle(invented, TRANSCRIPT, []);
    expect(e.flags).toContain("grounding");
    expect(e.weakness).toContain("transcript");
  });

  it("flags a generic, vague title for specificity", () => {
    const generic: ContentIdea = {
      title: "The future of great ideas",
      description: "A journey",
      suggestedFormats: ["linkedin_post"],
      quotes: [],
      rationale: "Great thoughts"
    };
    const e = scoreAngle(generic, TRANSCRIPT, [sibling]);
    expect(e.flags).toContain("specificity");
  });

  it("penalises an angle that re-words a sibling (low distinctness)", () => {
    const dup: ContentIdea = {
      title: "Why consistency compounds — the 90-day clip habit",
      description: "Daily clips",
      suggestedFormats: ["linkedin_post"],
      quotes: [],
      rationale: "Same thesis"
    };
    const e = scoreAngle(dup, TRANSCRIPT, [wellGrounded]);
    expect(e.distinctness).toBeLessThan(0.5);
  });

  it("gives a single angle full distinctness (nothing to distinguish against)", () => {
    const e = scoreAngle(wellGrounded, TRANSCRIPT, []);
    expect(e.distinctness).toBe(1);
  });
});

describe("rankAngles", () => {
  it("returns a stable ordering by score, descending", () => {
    const weak: ContentIdea = {
      title: "Quantum trading desks for everyone",
      description: "Buy now",
      suggestedFormats: ["newsletter"],
      quotes: ["buy now"],
      rationale: "The future of everything"
    };
    const ranked = rankAngles([weak, wellGrounded, sibling], TRANSCRIPT);
    expect(ranked.length).toBe(3);
    expect(ranked[0].idea.title).toBe(wellGrounded.title);
    expect(ranked[2].idea.title).toBe(weak.title);
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i - 1].evaluation.score).toBeGreaterThanOrEqual(ranked[i].evaluation.score);
    }
  });

  it("returns an empty array for no angles", () => {
    expect(rankAngles([], TRANSCRIPT)).toEqual([]);
  });
});
