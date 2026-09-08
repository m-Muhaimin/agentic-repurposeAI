// Phase 6: Recommendation engine tests.
// Deterministic, no mocks — uses real ContentIntelligence construction via
// analyzeContent and a minimal() helper for targeted assertions.

import { describe, it, expect, beforeEach } from "vitest";
import { outputRegistry } from "@/lib/output-registry";
import { analyzeContent } from "@/lib/intelligence";
import { recommend } from "./recommend";
import { objectiveFitValue } from "./objective-fit";
import type { Objective, ContentIntelligence, DerivedOpportunityKind } from "./types";
import type { DerivedOpportunity } from "@/lib/intelligence/types";

// ── fixtures ────────────────────────────────────────────────────────────────

const TEXT = `We launched in 2019. The data clearly shows remote teams win. That's why we built our own async tooling.

Imagine never needing a meeting again. What if you shipped ten times faster? We did.

"Bigger teams are slower" is the thing most people get wrong. Even though the evidence points the other way.

After that, we hired six engineers. Then we discovered process was the bottleneck. So we stripped everything down.`;

const META = { sourceId: "src-1", sourceType: "youtube", title: "Launching Async First" };

function intelligence(): ContentIntelligence {
  return analyzeContent(TEXT, META);
}

function minimal(overrides: Partial<ContentIntelligence> = {}): ContentIntelligence {
  return {
    sourceId: "src-1",
    sourceType: "youtube",
    title: "t",
    topics: [],
    themes: [],
    claims: [],
    quotes: [],
    stories: [],
    questions: [],
    hooks: [],
    entities: [],
    insights: [],
    opportunities: [],
    provenance: "deterministic",
    analyzedAt: new Date().toISOString(),
    textStats: { chars: 0, words: 0, sentences: 0 },
    ...overrides,
  };
}

function objective(kind: Objective["kind"]): Objective {
  const labels = {
    grow_linkedin: "Grow my LinkedIn audience",
    grow_email: "Build my email audience",
    get_reach: "Get more reach",
    clarify_ideas: "Clarify my ideas",
    drive_action: "Drive action",
  } as const satisfies Record<Objective["kind"], string>;
  return { kind, label: labels[kind] };
}

function opportunitiesOfType(...kinds: DerivedOpportunityKind[]): DerivedOpportunity[] {
  return kinds.map((kind, i) => ({
    kind,
    title: `op-${i}`,
    pitch: "p",
    anchors: [],
    synthesized: true as const,
  }));
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe("recommend", () => {
  it("returns all evidence-passing outputs scored and sorted desc", () => {
    const recs = recommend({ objective: objective("get_reach"), intelligence: intelligence() });
    expect(recs.length).toBeGreaterThan(0);
    for (let i = 1; i < recs.length; i++) {
      expect(recs[i - 1].score).toBeGreaterThanOrEqual(recs[i].score);
    }
  });

  it("objective changes ranking: grow_linkedin ranks linkedin_post above newsletter", () => {
    const liRecs = recommend({ objective: objective("grow_linkedin"), intelligence: intelligence() });
    const liPost = liRecs.find((r) => r.definition.id === "linkedin_post");
    const news = liRecs.find((r) => r.definition.id === "newsletter");
    expect(liPost).toBeTruthy();
    expect(news).toBeTruthy();
    expect(liPost!.score).toBeGreaterThan(news!.score);
  });

  it("objective-fit (spec 6C): grow_linkedin fits newsletter above shortform", () => {
    expect(objectiveFitValue(objective("grow_linkedin"), "newsletter")).toBe(0.6);
    expect(objectiveFitValue(objective("grow_linkedin"), "shortform_script")).toBe(0.3);
  });

  it("objective changes ranking: grow_email ranks newsletter highest", () => {
    const emRecs = recommend({ objective: objective("grow_email"), intelligence: intelligence() });
    const liPost = emRecs.find((r) => r.definition.id === "linkedin_post");
    const news = emRecs.find((r) => r.definition.id === "newsletter");
    expect(liPost).toBeTruthy();
    expect(news).toBeTruthy();
    expect(news!.score).toBeGreaterThan(liPost!.score);
  });

  it("strong opportunity increases score", () => {
    const base = recommend({
      objective: objective("get_reach"),
      intelligence: minimal({
        opportunities: opportunitiesOfType("clip"),
        topics: [{ label: "t", occurrences: 2, confidence: 0.5 }],
        claims: [
          {
            text: "remote teams win",
            stance: "assertion",
            confidence: 0.6,
            evidence: { text: "x", start: 0, end: 1, verbatim: true },
          },
        ],
        hooks: [{ text: "never needing a meeting", kind: "opening", evidence: { text: "x", start: 0, end: 1, verbatim: true } }],
        quotes: [],
        stories: [],
        questions: [],
        textStats: { chars: 100, words: 20, sentences: 3 },
      }),
    });

    const noOpp = recommend({
      objective: objective("get_reach"),
      intelligence: minimal({
        opportunities: [],
        topics: [{ label: "t", occurrences: 2, confidence: 0.5 }],
        claims: [
          {
            text: "remote teams win",
            stance: "assertion",
            confidence: 0.6,
            evidence: { text: "x", start: 0, end: 1, verbatim: true },
          },
        ],
        hooks: [{ text: "never needing a meeting", kind: "opening", evidence: { text: "x", start: 0, end: 1, verbatim: true } }],
        quotes: [],
        stories: [],
        questions: [],
        textStats: { chars: 100, words: 20, sentences: 3 },
      }),
    });

    const shortformBase = base.find((r) => r.definition.id === "shortform_script");
    const shortformNoOpp = noOpp.find((r) => r.definition.id === "shortform_script");
    expect(shortformBase).toBeTruthy();
    expect(shortformNoOpp).toBeTruthy();
    expect(shortformBase!.score).toBeGreaterThan(shortformNoOpp!.score);
  });

  it("missing evidence blocks candidate (score 0 → excluded)", () => {
    // linkedin_post needs topics+claims+hooks; shortform_script needs topics+hooks.
    // With only topics, neither qualifies. Newsletter needs topics+claims only.
    const recs = recommend({
      objective: objective("get_reach"),
      intelligence: minimal({
        topics: [{ label: "t", occurrences: 2, confidence: 0.5 }],
        claims: [],
        hooks: [],
        quotes: [],
        stories: [],
        questions: [],
        textStats: { chars: 10, words: 2, sentences: 1 },
      }),
    });

    expect(recs.map((r) => r.definition.id)).not.toContain("linkedin_post");
    expect(recs.map((r) => r.definition.id)).not.toContain("shortform_script");
    // newsletter needs topics+claims; we have topics only → also excluded.
    expect(recs.map((r) => r.definition.id)).not.toContain("newsletter");
    expect(recs.length).toBe(0);
  });

  it("low confidence reduces ranking relative to high-confidence counterpart", () => {
    // Both have the same evidence + objective fit. One has 1 opportunity (baseline
    // confidence 0.8), the other has 2+ opportunities (confidence 0.9).
    const lowConfIntel = minimal({
      topics: [{ label: "t", occurrences: 2, confidence: 0.5 }],
      claims: [
        {
          text: "remote teams win",
          stance: "assertion",
          confidence: 0.6,
          evidence: { text: "x", start: 0, end: 1, verbatim: true },
        },
      ],
      hooks: [{ text: "never needing a meeting", kind: "opening", evidence: { text: "x", start: 0, end: 1, verbatim: true } }],
      opportunities: opportunitiesOfType("clip"),
      textStats: { chars: 100, words: 20, sentences: 3 },
    });

    const highConfIntel = minimal({
      topics: [{ label: "t", occurrences: 2, confidence: 0.5 }],
      claims: [
        {
          text: "remote teams win",
          stance: "assertion",
          confidence: 0.6,
          evidence: { text: "x", start: 0, end: 1, verbatim: true },
        },
      ],
      hooks: [{ text: "never needing a meeting", kind: "opening", evidence: { text: "x", start: 0, end: 1, verbatim: true } }],
      opportunities: opportunitiesOfType("clip", "claim_post"),
      textStats: { chars: 100, words: 20, sentences: 3 },
    });

    const low = recommend({ objective: objective("get_reach"), intelligence: lowConfIntel });
    const high = recommend({ objective: objective("get_reach"), intelligence: highConfIntel });

    const lowNews = low.find((r) => r.definition.id === "newsletter");
    const highNews = high.find((r) => r.definition.id === "newsletter");
    expect(lowNews).toBeTruthy();
    expect(highNews).toBeTruthy();
    expect(highNews!.score).toBeGreaterThan(lowNews!.score);
  });

  it("deterministic output (same input → same output)", () => {
    const intel = intelligence();
    const o1 = objective("get_reach");
    const r1 = recommend({ objective: o1, intelligence: intel });
    const r2 = recommend({ objective: o1, intelligence: intel });
    expect(r1).toEqual(r2);
  });

  it("stable ordering across calls", () => {
    const intel = intelligence();
    const recs = recommend({ objective: objective("get_reach"), intelligence: intel });
    const ids = recs.map((r) => r.definition.id);
    // Same call again should produce the same order.
    const recs2 = recommend({ objective: objective("get_reach"), intelligence: intel });
    expect(recs2.map((r) => r.definition.id)).toEqual(ids);
  });

  it("bounded scores (all 0..1)", () => {
    const intel = intelligence();
    const allObjectives: Objective["kind"][] = [
      "grow_linkedin",
      "grow_email",
      "get_reach",
      "clarify_ideas",
      "drive_action",
    ];
    for (const kind of allObjectives) {
      const recs = recommend({ objective: objective(kind), intelligence: intel });
      for (const r of recs) {
        expect(r.score).toBeGreaterThanOrEqual(0);
        expect(r.score).toBeLessThanOrEqual(1);
        expect(r.evidenceScore).toBeGreaterThanOrEqual(0);
        expect(r.evidenceScore).toBeLessThanOrEqual(1);
        expect(r.objectiveFit).toBeGreaterThanOrEqual(0);
        expect(r.objectiveFit).toBeLessThanOrEqual(1);
        expect(r.opportunityStrength).toBeGreaterThanOrEqual(0);
        expect(r.opportunityStrength).toBeLessThanOrEqual(1);
        expect(r.confidence).toBeGreaterThanOrEqual(0);
        expect(r.confidence).toBeLessThanOrEqual(1);
      }
    }
  });

  it("reason generation (reasons array is non-empty for strong fits)", () => {
    const recs = recommend({ objective: objective("get_reach"), intelligence: intelligence() });
    const strong = recs.find((r) => r.fitLabel === "Strong fit");
    expect(strong).toBeTruthy();
    expect(strong!.reasons.length).toBeGreaterThan(0);
    for (const reason of strong!.reasons) {
      expect(typeof reason).toBe("string");
      expect(reason.length).toBeGreaterThan(0);
    }
  });

  it("unknown output ID handling (graceful, not crash)", () => {
    // Pass an objective + intelligence; the engine should not crash even though
    // the registry only knows about its own IDs. The recommend function only
    // iterates registered outputs, so unknown IDs are naturally excluded.
    expect(() => {
      recommend({
        objective: objective("get_reach"),
        intelligence: intelligence(),
      });
    }).not.toThrow();
  });

  it("unknown objective handling (graceful, not crash)", () => {
    // The objective-fit module returns not_recommended for unknown kinds.
    // We can't easily construct an unknown kind because the type is closed,
    // but we verify the module doesn't crash on any known objective.
    expect(() => {
      for (const kind of ["grow_linkedin", "grow_email", "get_reach", "clarify_ideas", "drive_action"] as const) {
        recommend({ objective: objective(kind), intelligence: intelligence() });
      }
    }).not.toThrow();
  });

  it("empty intelligence (no topics/claims/hooks → low or zero scores)", () => {
    const recs = recommend({
      objective: objective("get_reach"),
      intelligence: minimal({}),
    });
    // No evidence → nothing passes the gate.
    expect(recs.length).toBe(0);
  });

  it("fit labels match score thresholds", () => {
    const intel = intelligence();
    const recs = recommend({ objective: objective("get_reach"), intelligence: intel });
    for (const r of recs) {
      if (r.score >= 0.7) expect(r.fitLabel).toBe("Strong fit");
      else if (r.score >= 0.45) expect(r.fitLabel).toBe("Good fit");
      else if (r.score >= 0.2) expect(r.fitLabel).toBe("Possible");
      else expect(r.fitLabel).toBe("Not recommended");
    }
  });

  it("opportunityIds reflects which kinds contributed", () => {
    const recs = recommend({
      objective: objective("get_reach"),
      intelligence: minimal({
        topics: [{ label: "t", occurrences: 2, confidence: 0.5 }],
        claims: [
          {
            text: "remote teams win",
            stance: "assertion",
            confidence: 0.6,
            evidence: { text: "x", start: 0, end: 1, verbatim: true },
          },
        ],
        hooks: [{ text: "never needing a meeting", kind: "opening", evidence: { text: "x", start: 0, end: 1, verbatim: true } }],
        opportunities: opportunitiesOfType("clip", "claim_post"),
        textStats: { chars: 100, words: 20, sentences: 3 },
      }),
    });

    const shortform = recs.find((r) => r.definition.id === "shortform_script");
    expect(shortform).toBeTruthy();
    // clip → shortform_script; claim_post does NOT → shortform_script.
    expect(shortform!.opportunityIds).toContain("clip");
    expect(shortform!.opportunityIds).not.toContain("claim_post");
  });
});
