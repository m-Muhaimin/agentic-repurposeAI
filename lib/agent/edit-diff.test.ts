// Unit tests for the P4 edit-diff pure logic. Runs without network/Supabase.

import { describe, expect, it } from "vitest";
import { computeEditDiff, type EditSeverity } from "@/lib/agent/edit-diff";

describe("computeEditDiff", () => {
  it("returns unchanged for identical content", () => {
    const result = computeEditDiff("hello world", "hello world");
    expect(result.severity).toBe("unchanged");
    expect(result.tokensAdded).toBe(0);
    expect(result.tokensRemoved).toBe(0);
  });

  it("detects light polish (small token changes)", () => {
    const original = "The quick brown fox jumps over the lazy dog in the park today";
    const edited = "The quick brown fox leaps over the lazy dog in the park today";
    const result = computeEditDiff(original, edited);
    expect(result.severity).toBe("light_polish");
    expect(result.tokensAdded).toBeGreaterThanOrEqual(1);
    expect(result.tokensRemoved).toBeGreaterThanOrEqual(1);
  });

  it("detects moderate edit", () => {
    const original = "a b c d e f g h i j k l m n o p";
    const edited = "a b c X Y Z h i j k l m n o p q r";
    const result = computeEditDiff(original, edited);
    expect(["moderate_edit", "heavy_rewrite"]).toContain(result.severity);
    expect(result.tokensAdded).toBeGreaterThan(0);
    expect(result.tokensRemoved).toBeGreaterThan(0);
  });

  it("detects heavy rewrite", () => {
    const original = "alpha bravo charlie delta echo foxtrot golf hotel india juliet kilo lima";
    const edited = "one two three four five six seven eight nine ten eleven twelve thirteen";
    const result = computeEditDiff(original, edited);
    expect(result.severity).toBe("heavy_rewrite");
    expect(result.tokensAdded).toBeGreaterThan(0);
    expect(result.tokensRemoved).toBeGreaterThan(0);
  });

  it("handles empty original (all additions)", () => {
    const result = computeEditDiff("", "new content here");
    expect(result.severity).toBe("heavy_rewrite");
    expect(result.tokensAdded).toBe(3);
    expect(result.tokensRemoved).toBe(0);
  });

  it("handles empty edited (all deletions)", () => {
    const result = computeEditDiff("original content here", "");
    expect(result.severity).toBe("heavy_rewrite");
    expect(result.tokensAdded).toBe(0);
    expect(result.tokensRemoved).toBe(3);
  });

  it("description is a human-readable string", () => {
    const result = computeEditDiff("a b c", "a x c");
    expect(typeof result.description).toBe("string");
    expect(result.description.length).toBeGreaterThan(0);
  });
});
