// Unit tests for P2 error classification. The orchestrator leans on this to
// decide transient-vs-permanent: transient runs stay re-claimable, permanent
// ones fail fast.

import { describe, expect, it } from "vitest";
import { classifyError, describeError, isTransientError, MAX_PHASE_ATTEMPTS } from "@/lib/agent/errors";

describe("isTransientError", () => {
  it("classifies provider overload states as transient", () => {
    for (const msg of [
      "429 Too Many Requests",
      "RESOURCE_EXHAUSTED: Quota exceeded for metric",
      "503 Service Unavailable: The model is overloaded",
      "rate limit exceeded",
      "fetch failed",
      "socket hang up",
      "read ECONNRESET",
      "request timed out after 30000ms",
      "EAI_AGAIN: name resolution failed"
    ]) {
      expect(isTransientError(new Error(msg)), msg).toBe(true);
    }
  });

  it("classifies TypeError/FetchEvent aborts as transient", () => {
    expect(isTransientError(new TypeError("fetch failed"))).toBe(true);
  });

  it("classifies permanent problems as non-transient", () => {
    for (const msg of [
      "Planner returned 0 angles (need 1-7).",
      'relation "public.v4_agent_runs" does not exist',
      "new row violates row-level security policy",
      "permission denied for table v4_content_ideas",
      "column formats of relation jobs does not exist",
      "No post was scheduled or published (capability stub).",
      "NotImplementedError: distribution is gated off",
      "sourceId, format and transcript required"
    ]) {
      expect(isTransientError(new Error(msg)), msg).toBe(false);
    }
  });

  it("classifyError agrees", () => {
    expect(classifyError(new Error("429 quota exceeded"))).toBe("transient");
    expect(classifyError(new Error("column does not exist"))).toBe("permanent");
  });

  it("describeError hides raw transient text but keeps permanent detail", () => {
    expect(describeError(new Error("429 Too Many Requests"))).toMatch(/transient/i);
    expect(describeError(new Error("sourceId required"))).toMatch(/sourceId required/);
  });
});

describe("MAX_PHASE_ATTEMPTS", () => {
  it("bounds retries per phase so resumption cannot loop forever", () => {
    expect(MAX_PHASE_ATTEMPTS).toBeGreaterThanOrEqual(1);
    expect(MAX_PHASE_ATTEMPTS).toBeLessThanOrEqual(8);
  });
});