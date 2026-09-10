// P13: Tests for the scale / permission surface — read-mostly, honest doors.

import { describe, expect, it } from "vitest";
import { buildScaleSurface, modeScaleSummary } from "@/lib/agent/scale";

describe("modeScaleSummary", () => {
  it("keeps the human approval gate for assist + execute, auto-approves in automate", () => {
    expect(modeScaleSummary("assist").requiresHumanApproval).toBe(true);
    expect(modeScaleSummary("execute").requiresHumanApproval).toBe(true);
    expect(modeScaleSummary("automate").requiresHumanApproval).toBe(false);
  });

  it("exposes schedule only for automate with the Buffer API key configured", () => {
    expect(modeScaleSummary("assist", true).canSchedule).toBe(false);
    expect(modeScaleSummary("execute", true).canSchedule).toBe(false);
    expect(modeScaleSummary("automate", false).canSchedule).toBe(false);
    expect(modeScaleSummary("automate", true).canSchedule).toBe(true);
  });

  it("surfaces the capability truth", () => {
    expect(modeScaleSummary("assist").canDistribute).toBe(false);
    expect(modeScaleSummary("execute").canDistribute).toBe(false);
    expect(modeScaleSummary("automate").canDistribute).toBe(true);
  });
});

describe("buildScaleSurface", () => {
  it("reports no autopilot door and draft-only schedules without the API key", () => {
    const s = buildScaleSurface(false);
    expect(s.autopilotDoorExists).toBe(false);
    expect(s.scheduleIsDraftOnly).toBe(true);
    expect(s.defaultMode).toBe("assist");
    expect(s.modes).toHaveLength(3);
    expect(s.note).toContain("API key");
  });

  it("reports the door + non-draft schedules when the API key is configured", () => {
    const s = buildScaleSurface(true);
    expect(s.autopilotDoorExists).toBe(true);
    expect(s.scheduleIsDraftOnly).toBe(false);
    expect(s.modes.find((m) => m.mode === "automate")?.canSchedule).toBe(true);
    expect(s.note).not.toContain("draft-only");
  });
});