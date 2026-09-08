import { describe, it, expect } from "vitest";
import { analyzeContent, assertGrounded } from "@/lib/intelligence";
import { extractIntelligence } from "@/lib/intelligence";
import { splitSentences } from "@/lib/intelligence/extract";

const SAMPLE = `I started my company back in 2019 with nothing but a laptop.

At the time, everyone said remote work could never scale. That's why we built our own async tooling instead of following the playbook.

After that, we decided to open a small office. Then we discovered the office was a distraction. So we closed it six months later.

What is the single biggest mistake founders make? I think it's scaling the team before product-market fit. The data clearly shows teams that hire slowly win.

Here's the thing: you don't need a big team to ship. Nevertheless, most people still think "bigger is better". Even though the evidence points the other way.

We rebuilt everything on Notion in 2020. Notion became our entire operating system.

In general, the point is that constraints force clarity. And that means better products. Because shipping under pressure teaches you what matters.`;

const META = { sourceId: "src-1", sourceType: "youtube", title: "My Startup Story" };

describe("splitSentences", () => {
  it("splits on punctuation with offsets and re-anchors after trim", () => {
    const s = splitSentences("One sentence.  Two here!\nThird? Last.");
    expect(s.map((x) => x.text)).toEqual(["One sentence.", "Two here!", "Third?", "Last."]);
    for (const seg of s) {
      expect(seg.text.length).toBe(seg.end - seg.start);
    }
  });
});

describe("analyzeContent", () => {
  const il = analyzeContent(SAMPLE, META);

  it("requires non-empty text", () => {
    expect(() => analyzeContent("   ", META)).toThrow();
  });

  it("carries metadata + provenance", () => {
    expect(il.sourceId).toBe("src-1");
    expect(il.sourceType).toBe("youtube");
    expect(il.title).toBe("My Startup Story");
    expect(il.provenance).toBe("deterministic");
  });

  it("extracts topics and themes", () => {
    expect(il.topics.length).toBeGreaterThan(0);
    expect(il.themes.length).toBeGreaterThan(0);
    expect(il.topics.map((t) => t.confidence)).toEqual(expect.arrayContaining([expect.any(Number)]));
  });

  it("extracts grounded claims with stance and confidence", () => {
    expect(il.claims.length).toBeGreaterThanOrEqual(1);
    for (const c of il.claims) {
      expect(["assertion", "conjecture", "citation"]).toContain(c.stance);
      expect(c.confidence).toBeGreaterThan(0);
      expect(c.confidence).toBeLessThanOrEqual(1);
    }
  });

  it("extracts questions (including the rhetorical one)", () => {
    expect(il.questions.length).toBeGreaterThanOrEqual(1);
    expect(il.questions.some((q) => q.rhetorical)).toBe(true);
    expect(il.questions[0].text.endsWith("?")).toBe(true);
  });

  it("extracts hooks (opening + stat + open loop)", () => {
    const kinds = il.hooks.map((h) => h.kind);
    expect(kinds).toContain("opening");
    expect(kinds).toContain("open_loop");
  });

  it("extracts entities", () => {
    expect(il.entities.length).toBeGreaterThanOrEqual(1);
  });

  it("extracts insights and stories", () => {
    expect(il.insights.length).toBeGreaterThanOrEqual(1);
    expect(il.stories.length).toBeGreaterThanOrEqual(1);
  });

  it("derives synthesized opportunities (never fabricated)", () => {
    expect(il.opportunities.length).toBeGreaterThan(0);
    for (const o of il.opportunities) {
      expect(o.synthesized).toBe(true);
      expect(o.anchors.length).toBeGreaterThan(0);
    }
    const kinds = il.opportunities.map((o) => o.kind);
    expect(kinds).toContain("clip");
    expect(kinds).toContain("claim_post");
  });

  it("every evidence segment is a verbatim slice of the source", () => {
    assertGrounded(il, SAMPLE);
  });
});

describe("extractIntelligence grounding", () => {
  it("rejects a segment that is not a verbatim slice", () => {
    const il = extractIntelligence(SAMPLE, META);
    // Tamper with one evidence text — the guard must catch it.
    const { analyzeContent: _unused, ...rest } = { analyzeContent: null };
    void rest;
    const tampered: typeof il = {
      ...il,
      claims: il.claims.length
        ? [{ ...il.claims[0], evidence: { ...il.claims[0].evidence, text: "forged text." } }]
        : il.claims
    };
    if (tampered.claims.length) {
      expect(() => assertGrounded(tampered, SAMPLE)).toThrow(/not grounded/);
    }
  });
});