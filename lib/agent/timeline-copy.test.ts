// Unit tests for the humanized run narrative — pure mapping, no DOM.

import { describe, expect, it } from "vitest";
import { humanizeTimeline } from "@/lib/agent/timeline-copy";

function step(kind: string, status = "done") {
  return { kind, status };
}

describe("humanizeTimeline", () => {
  it("narrates create → awaiting_approval as analysis done, angles found, review pending-accept", () => {
    const steps = [
      step("planning"),
      step("generation", "skipped")
    ];
    const lines = humanizeTimeline(steps, {
      status: "awaiting_approval",
      totalIdeas: 6,
      approvedIdeas: 6
    });

    expect(lines.map((l) => l.id)).toEqual(["analyze", "angles", "review", "draft", "quality", "publish"]);
    expect(lines[0]).toMatchObject({ text: "Understood your source and brand context", state: "done" });
    expect(lines[1]).toMatchObject({ text: "Found 6 strong angles", state: "done" });
    expect(lines[2]).toMatchObject({ text: "Ready for your review — keep or skip each angle", state: "active" });
    expect(lines[3]).toMatchObject({ text: "Writing drafts", state: "pending" });
  });

  it("narrates a completed run with kept counts and drafted pieces", () => {
    const steps = [
      step("planning"),
      step("generation"),
      step("generation"),
      step("review"),
      step("distribution")
    ];
    const lines = humanizeTimeline(steps, {
      status: "done",
      totalIdeas: 6,
      approvedIdeas: 4
    });

    const txt = lines.map((l) => l.text);
    expect(txt).toContain("You kept 4 of 6 angles");
    expect(txt).toContain("Drafted 2 pieces");
    expect(txt).toContain("Quality review complete");
    expect(txt).toContain("Sent to your publishing queue");
    expect(txt).toContain("Ready — drafts are saved in your library");
    expect(lines[lines.length - 1]).toMatchObject({ id: "done", state: "done" });
  });

  it("skips the done banner on cancelled runs but keeps the narrative", () => {
    const lines = humanizeTimeline([], {
      status: "cancelled",
      totalIdeas: 3,
      approvedIdeas: 0
    });
    const txt = lines.map((l) => l.text);
    expect(txt).toContain("Review closed — completed work is kept");
    expect(txt.some((t) => t.startsWith("You kept"))).toBe(false);
    expect(lines.some((l) => l.id === "done" && l.state === "done")).toBe(false);
  });

  it("uses the running headline on failed runs", () => {
    const lines = humanizeTimeline([step("planning"), step("generation", "running")], {
      status: "failed",
      totalIdeas: 2,
      approvedIdeas: 2
    });
    const txt = lines.map((l) => l.text);
    expect(txt.some((t) => t.includes("Stopped early"))).toBe(true);
  });

  it("pluralizes counts correctly", () => {
    const one = humanizeTimeline([step("planning")], {
      status: "done",
      totalIdeas: 1,
      approvedIdeas: 1
    });
    expect(one.map((l) => l.text)).toContain("Found 1 strong angle");
  });
});