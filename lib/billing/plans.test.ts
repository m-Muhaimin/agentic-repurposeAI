// Unit tests for the billing plans config — pure module, no Supabase/network.

import { describe, expect, it } from "vitest";
import { BETA_PLAN, PLANS, getPlan, getPublicPlans, isOutputFormat } from "@/lib/billing/plans";

describe("plans config", () => {
  it("beta is the free public tier", () => {
    const publicPlans = getPublicPlans();
    expect(publicPlans.map((p) => p.id)).toEqual(["beta", "creator", "pro", "studio"]);
    expect(publicPlans.every((p) => p.available)).toBe(true);
    expect(Object.values(PLANS).filter((p) => p.available).map((p) => p.id)).toEqual(["beta", "creator", "pro", "studio"]);
  });

  it("beta caps jobs, input length, outputs and regenerations", () => {
    expect(BETA_PLAN.limits.maxJobsPerMonth).toBe(5);
    expect(BETA_PLAN.limits.maxInputMinutes).toBe(30);
    expect(BETA_PLAN.limits.maxOutputsPerJob).toBe(3);
    expect(BETA_PLAN.limits.maxRegenerationsPerJob).toBe(2);
  });

  it("paid tiers are public and priced for launch", () => {
    for (const id of ["creator", "pro", "studio"] as const) {
      expect(PLANS[id].isPublic).toBe(true);
      expect(PLANS[id].available).toBe(true);
      expect(PLANS[id].monthPriceUsd).toBeGreaterThan(0);
    }
  });

  it("getPlan falls back to beta for unknown ids", () => {
    expect(getPlan(null).id).toBe("beta");
    expect(getPlan("enterprise").id).toBe("beta");
    expect(getPlan("creator").id).toBe("creator");
  });

  it("isOutputFormat is the single format vocabulary", () => {
    expect(isOutputFormat("linkedin_post")).toBe(true);
    expect(isOutputFormat("shortform_script")).toBe(true);
    expect(isOutputFormat("thread")).toBe(true);
    expect(isOutputFormat("carousel")).toBe(true);
    expect(isOutputFormat("tiktok")).toBe(false);
    expect(isOutputFormat(undefined)).toBe(false);
  });
});