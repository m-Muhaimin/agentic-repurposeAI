import { describe, it, expect, afterEach } from "vitest";
import { isOrchestratorV1Enabled } from "./flag";

const FLAG = "VERVAI_ORCHESTRATOR_V1";
const previous = process.env[FLAG];

afterEach(() => {
  if (previous === undefined) delete process.env[FLAG];
  else process.env[FLAG] = previous;
});

describe("isOrchestratorV1Enabled", () => {
  it("returns false when the env var is unset", () => {
    delete process.env[FLAG];
    expect(isOrchestratorV1Enabled()).toBe(false);
  });

  it("returns true only for the exact value '1'", () => {
    process.env[FLAG] = "1";
    expect(isOrchestratorV1Enabled()).toBe(true);
  });

  it("returns false for any other value ('true', '0', '')", () => {
    process.env[FLAG] = "true";
    expect(isOrchestratorV1Enabled()).toBe(false);
    process.env[FLAG] = "0";
    expect(isOrchestratorV1Enabled()).toBe(false);
    process.env[FLAG] = "";
    expect(isOrchestratorV1Enabled()).toBe(false);
  });
});