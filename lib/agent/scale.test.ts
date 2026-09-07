// P13: Tests for the scale / permission surface — read-mostly, no autopilot door.

import { describe, expect, it } from "vitest";
import { buildScaleSurface, modeScaleSummary } from "@/lib/agent/scale";

describe("modeScaleSummary", () => {
  it("labels every mode as requiring human approval (no mode auto-sends)", () => {
    for (const mode of ["assist", "execute", "automate"] as const) {
      expect(modeScaleSummary(mode).requiresHumanApproval).toBe(true);
    }
  });

  it("surfaces the capability truth without a connected channel", () => {
    expect(modeScaleSummary("assist").canDistribute).toBe(false);
    expect(modeScaleSummary("execute").canDistribute).toBe(false);
    expect(modeScaleSummary("automate").canDistribute).toBe(true); // capability exposed, but...
    expect(modeScaleSummary("automate").channelsConnected).toBe(false); // ...no channel to send to
  });
});

describe("buildScaleSurface", () => {
  it("confirms structurally that no autopilot door exists", () => {
    const s = buildScaleSurface();
    expect(s.autopilotDoorExists).toBe(false);
    expect(s.scheduleIsDraftOnly).toBe(true);
    expect(s.defaultMode).toBe("assist");
    expect(s.modes).toHaveLength(3);
  });

  it("contains an honest note (no claim of real publishing)", () => {
    const s = buildScaleSurface();
    expect(s.note).toContain("draft-only");
    expect(s.note).not.toContain("success");
  });
});
