// Unit tests for agent permission matrices — the invariant that a run's mode
// is decided once and tools can never escalate beyond it.

import { describe, expect, it } from "vitest";
import {
  CAPABILITIES,
  DEFAULT_MODE,
  allowedStepKinds,
  toolAllowedForMode
} from "@/lib/agent/permissions";

describe("permission matrices", () => {
  it("assist never auto-revises and never distributes/strategizes", () => {
    expect(CAPABILITIES.assist.revise).toBe(false);
    expect(CAPABILITIES.assist.distribute).toBe(false);
    expect(CAPABILITIES.assist.strategize).toBe(false);
    expect(CAPABILITIES.assist.plan).toBe(true);
    expect(CAPABILITIES.assist.generate).toBe(true);
  });

  it("execute adds exactly one bounded revision, still no distribution/strategy", () => {
    expect(CAPABILITIES.execute.revise).toBe(true);
    expect(CAPABILITIES.execute.distribute).toBe(false);
    expect(CAPABILITIES.execute.strategize).toBe(false);
  });

  it("automate is the only mode exposing distribute/strategize", () => {
    expect(CAPABILITIES.automate.distribute).toBe(true);
    expect(CAPABILITIES.automate.strategize).toBe(true);
    for (const mode of ["assist", "execute"] as const) {
      expect(CAPABILITIES[mode].distribute).toBe(false);
    }
  });

  it("default mode is the safe human-in-the-loop fallback", () => {
    expect(DEFAULT_MODE).toBe("assist");
  });

  it("a distribution tool kind is only allowed in automate", () => {
    expect(toolAllowedForMode(["distribution"], "assist")).toBe(false);
    expect(toolAllowedForMode(["distribution"], "execute")).toBe(false);
    expect(toolAllowedForMode(["distribution"], "automate")).toBe(true);
  });

  it("strategy steps are gated the same way", () => {
    expect(allowedStepKinds("automate").has("strategy")).toBe(true);
    expect(allowedStepKinds("execute").has("strategy")).toBe(false);
    expect(allowedStepKinds("assist").has("strategy")).toBe(false);
  });

  it("planning + generation are available from assist up", () => {
    const assist = allowedStepKinds("assist");
    expect(assist.has("planning")).toBe(true);
    expect(assist.has("generation")).toBe(true);
    expect(assist.has("distribution")).toBe(false);
  });
});