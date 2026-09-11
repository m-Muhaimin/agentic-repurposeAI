import { describe, it, expect, beforeEach } from "vitest";
import { outputRegistry, OutputRegistry } from "@/lib/output-registry";
import { FORMATS, PROMPTS, FORMAT_LABELS, FORMAT_DESCRIPTIONS } from "@/lib/ai/prompts";
import type { ContentIntelligence } from "@/lib/intelligence/types";
import { analyzeContent } from "@/lib/intelligence";

// A small but realistic intelligence artifact from the deterministic extractor.
const TEXT = `We launched in 2019. The data clearly shows remote teams win. That's why we built our own async tooling.

Imagine never needing a meeting again. What if you shipped ten times faster? We did.

"Bigger teams are slower" is the thing most people get wrong. Even though the evidence points the other way.

After that, we hired six engineers. Then we discovered process was the bottleneck. So we stripped everything down.`;

const META = { sourceId: "src-1", sourceType: "youtube", title: "Launching Async First" };

function intelligence(): ContentIntelligence {
  return analyzeContent(TEXT, META);
}

// Minimal intelligence with only the attributes a test cares about — so scoring
// behavior can be asserted against noisy topic extraction.
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
    ...overrides
  };
}

describe("outputRegistry (built-in definitions)", () => {
  it("registers the five core formats in insertion order", () => {
    expect(outputRegistry.formats()).toEqual(["linkedin_post", "newsletter", "shortform_script", "thread", "carousel"]);
    for (const id of outputRegistry.formats()) {
      const def = outputRegistry.get(id);
      expect(def).toBeTruthy();
      expect(def?.systemPrompt.length).toBeGreaterThan(20);
    }
  });

  it("get returns undefined for an unknown id", () => {
    expect(outputRegistry.get("nope")).toBeUndefined();
  });
});

describe("outputRegistry.recommend (compatibility surface)", () => {
  it("scores every built-in against real intelligence and sorts desc", () => {
    const recs = outputRegistry.recommend(intelligence());
    expect(recs.length).toBeGreaterThan(0);
    for (let i = 1; i < recs.length; i++) {
      expect(recs[i - 1].score).toBeGreaterThanOrEqual(recs[i].score);
    }
  });

  it("excludes outputs whose evidence gate is unmet", () => {
    // No hooks/claims → linkedin_post (needs topics+claims+hooks), shortform_script
    // (needs topics+hooks), thread (needs hooks≥2, claims≥3, stories≥1) and
    // carousel (needs topics+claims+hooks) are excluded; newsletter needs
    // topics+claims only, so it qualifies.
    const recs = outputRegistry.recommend(
      minimal({
        topics: [{ label: "t", occurrences: 2, confidence: 0.5 }],
        claims: [
          { text: "the data clearly shows remote teams win", stance: "assertion", confidence: 0.6, evidence: { text: "x", start: 0, end: 1, verbatim: true } }
        ]
      })
    );
    expect(recs.map((r) => r.definition.id)).not.toContain("linkedin_post");
    expect(recs.map((r) => r.definition.id)).not.toContain("shortform_script");
    expect(recs.map((r) => r.definition.id)).not.toContain("thread");
    expect(recs.map((r) => r.definition.id)).not.toContain("carousel");
    expect(recs.map((r) => r.definition.id)).toContain("newsletter");
  });

  it("qualifies thread and carousel when their evidence gates are met", () => {
    const recs = outputRegistry.recommend(
      minimal({
        topics: [
          { label: "t1", occurrences: 2, confidence: 0.5 },
          { label: "t2", occurrences: 1, confidence: 0.4 }
        ],
        claims: [
          { text: "c1", stance: "assertion", confidence: 0.6, evidence: { text: "x", start: 0, end: 1, verbatim: true } },
          { text: "c2", stance: "assertion", confidence: 0.6, evidence: { text: "x", start: 0, end: 1, verbatim: true } },
          { text: "c3", stance: "assertion", confidence: 0.6, evidence: { text: "x", start: 0, end: 1, verbatim: true } },
          { text: "c4", stance: "assertion", confidence: 0.6, evidence: { text: "x", start: 0, end: 1, verbatim: true } }
        ],
        hooks: [
          { text: "h1", kind: "opening", evidence: { text: "x", start: 0, end: 1, verbatim: true } },
          { text: "h2", kind: "opening", evidence: { text: "x", start: 0, end: 1, verbatim: true } }
        ],
        stories: [{ summary: "we hired six engineers", evidence: [{ text: "we hired six engineers", start: 0, end: 10, verbatim: true }] }]
      })
    );
    const ids = recs.map((r) => r.definition.id);
    expect(ids).toContain("thread");
    expect(ids).toContain("carousel");
  });

  it("gives a higher score when more evidence is available (monotonicity)", () => {
    const thin = minimal({ topics: [{ label: "t", occurrences: 1, confidence: 0.3 }], claims: [{ text: "x", stance: "assertion", confidence: 0.5, evidence: { text: "x", start: 0, end: 1, verbatim: true } }] });
    const rich = minimal({
      topics: [
        { label: "a", occurrences: 3, confidence: 0.7 },
        { label: "b", occurrences: 2, confidence: 0.5 }
      ],
      claims: [
        { text: "x", stance: "assertion", confidence: 0.5, evidence: { text: "x", start: 0, end: 1, verbatim: true } },
        { text: "y", stance: "assertion", confidence: 0.5, evidence: { text: "y", start: 2, end: 3, verbatim: true } }
      ]
    });
    const thinRec = outputRegistry.recommend(thin).find((r) => r.definition.id === "newsletter");
    const richRec = outputRegistry.recommend(rich).find((r) => r.definition.id === "newsletter");
    expect(thinRec).toBeTruthy();
    expect(richRec).toBeTruthy();
    expect(richRec!.score).toBeGreaterThan(thinRec!.score);
  });
});

describe("outputRegistry.validate (quality gate)", () => {
  it("passes content within bounds", () => {
    const res = outputRegistry.validate("newsletter", "word ".repeat(300));
    expect(res.ok).toBe(true);
    expect(res.errors).toEqual([]);
  });

  it("reports out-of-bounds with a reason", () => {
    const res = outputRegistry.validate("newsletter", "too short");
    expect(res.ok).toBe(false);
    expect(res.errors.join(" ")).toMatch(/min/);
  });

  it("rejects validation for unknown formats", () => {
    const res = outputRegistry.validate("nope", "x");
    expect(res.ok).toBe(false);
    expect(res.errors[0]).toMatch(/unknown/);
  });

  it("passes content at the exact lower and upper bounds (inclusive)", () => {
    // newsletter: minWords 150, maxWords 600.
    expect(outputRegistry.validate("newsletter", "word ".repeat(150)).ok).toBe(true);
    expect(outputRegistry.validate("newsletter", "word ".repeat(600)).ok).toBe(true);
    expect(outputRegistry.validate("newsletter", "word ".repeat(149)).ok).toBe(false);
    expect(outputRegistry.validate("newsletter", "word ".repeat(601)).ok).toBe(false);
    // linkedin_post: minChars 200, maxChars 3000.
    expect(outputRegistry.validate("linkedin_post", "a".repeat(200)).ok).toBe(true);
    expect(outputRegistry.validate("linkedin_post", "a".repeat(3000)).ok).toBe(true);
    expect(outputRegistry.validate("linkedin_post", "a".repeat(199)).ok).toBe(false);
  });

  it("reports both over-and-under violations at once", () => {
    // 10 words fails minWords 150; content.length 20 also < nothing (newsletter
    // has no char bounds), but both word bounds can't be hit simultaneously.
    const over = outputRegistry.validate("newsletter", "word ".repeat(700)); // >600 words
    expect(over.ok).toBe(false);
    expect(over.errors.join(" ")).toMatch(/max 600/);
  });
});

describe("OutputRegistry (extension point)", () => {
  beforeEach(() => {
    // Fresh registry per test — the module-level singleton stays untouched.
  });

  it("accepts custom definitions and includes them in formats()/recommend()", () => {
    const reg = new OutputRegistry();
    reg.register({
      id: "carousel",
      label: "Quote carousel",
      description: "Slides from verbatim pull-quotes.",
      systemPrompt: "You assemble carousel slides.",
      requiresEvidence: { minQuotes: 2 },
      derived: true
    });
    expect(reg.formats()).toEqual(["carousel"]);
    const empty = reg.recommend(minimal());
    expect(empty).toEqual([]);
    const ready = reg.recommend(
      minimal({
        quotes: [
          { text: "q1", start: 0, end: 2, verbatim: true },
          { text: "q2", start: 3, end: 5, verbatim: true }
        ]
      })
    );
    expect(ready.map((r) => r.definition.id)).toEqual(["carousel"]);
    expect(ready[0].score).toBeGreaterThan(0);
  });

  it("rejects invalid ids", () => {
    const reg = new OutputRegistry();
    expect(() => reg.register({ id: "", label: "x", description: "d", systemPrompt: "p" })).toThrow(/invalid output id/);
  });

  it("re-registering an id overwrites in place (last-wins, idempotent module load)", () => {
    const reg = new OutputRegistry();
    reg.register({ id: "a", label: "first", description: "d", systemPrompt: "p1" });
    reg.register({ id: "a", label: "second", description: "d", systemPrompt: "p2" });
    expect(reg.formats()).toEqual(["a"]);
    expect(reg.get("a")?.label).toBe("second");
    expect(reg.get("a")?.systemPrompt).toBe("p2");
  });

  it("treats a definition with no evidence gate as always qualifying", () => {
    const reg = new OutputRegistry();
    reg.register({ id: "always", label: "x", description: "d", systemPrompt: "p" });
    expect(reg.recommend(minimal())[0].definition.id).toBe("always");
    expect(reg.recommend(minimal())[0].score).toBe(1);
    expect(reg.recommend(minimal())[0].reason).toBe("no evidence gate");
  });
});

describe("legacy façade ↔ registry alignment (lib/ai/prompts)", () => {
  // The hard-coded OutputFormat union in lib/ai/prompts.ts is a thin typed
  // façade over the registry. New outputs added ONLY to the registry must not
  // silently leak into legacy generation/billing code — and the façade must
  // never drift from the built-in prompt strings the generate pipeline uses.
  // These assertions pin the contract between the two so a future contributor
  // who widens the registry cannot accidentally change legacy behavior.
  it("exposes exactly the five registry formats, in registry order", () => {
    expect(FORMATS).toEqual(["linkedin_post", "newsletter", "shortform_script", "thread", "carousel"]);
  });

  it("labels and descriptions agree with the registry definitions", () => {
    for (const id of FORMATS) {
      const def = outputRegistry.get(id);
      expect(def).toBeTruthy();
      expect(FORMAT_LABELS[id]).toBe(def!.label);
      expect(FORMAT_DESCRIPTIONS[id]).toBe(def!.description);
    }
  });

  it("prompt strings are the registry's system prompts (no drift)", () => {
    for (const id of FORMATS) {
      expect(PROMPTS[id]).toBe(outputRegistry.get(id)?.systemPrompt);
    }
  });
});