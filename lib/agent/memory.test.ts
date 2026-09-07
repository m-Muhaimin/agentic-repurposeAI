// Unit tests for the P3 memory signal flow — the pure append/cap logic and the
// confidence-gated suggestion aggregation. These run without network/Supabase.

import { describe, expect, it } from "vitest";
import { appendSignal, suggestFromSignals } from "@/lib/agent/memory";
import type { EditSignal } from "@/types/agent";

const base = (over: Partial<EditSignal>): EditSignal => ({
  kind: "edit",
  outputId: "o1",
  whatChanged: "tightened the hook",
  at: "2026-09-07T00:00:00.000Z",
  ...over
});

describe("appendSignal", () => {
  it("appends and caps to the newest signals (default cap 12)", () => {
    const start = Array.from({ length: 12 }, (_, i) => base({ outputId: `o${i}` }));
    const next = appendSignal(start, base({ outputId: "last" }));
    expect(next).toHaveLength(12);
    expect(next[11].outputId).toBe("last");
    expect(next[0].outputId).toBe("o1");
  });

  it("returns single element for an empty history", () => {
    expect(appendSignal([], base({ outputId: "first" }))).toHaveLength(1);
  });

  it("preserves signal kind", () => {
    const next = appendSignal([], base({ kind: "angle_decision", outputId: "Why consistency", whatChanged: "approved" }));
    expect(next[0].kind).toBe("angle_decision");
  });
});

describe("suggestFromSignals", () => {
  it("returns nothing before two signals exist", () => {
    expect(suggestFromSignals([base({})])).toEqual([]);
  });

  it("suggests a tone refinement when one output was edited repeatedly", () => {
    const signals = [
      base({ outputId: "o1", whatChanged: "softened the opening" }),
      base({ outputId: "o1", whatChanged: "softened the opening again" })
    ];
    const suggestions = suggestFromSignals(signals, 0.6);
    expect(suggestions.some((s) => s.type === "tone")).toBe(true);
    expect(suggestions[0].confidence).toBeGreaterThan(0.6);
  });

  it("does not surface a suggestion below the confidence gate", () => {
    const signals = [
      base({ outputId: "o1", whatChanged: "a" }),
      base({ outputId: "o2", whatChanged: "b" })
    ];
    expect(suggestFromSignals(signals, 0.6)).toEqual([]);
  });
});
