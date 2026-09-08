// Phase 2: failure semantics — human failReason, no raw stacks.

import { describe, expect, it } from "vitest";
import {
  buildFailReason,
  ingestionFailure,
  isIngestionFailure,
  toFailReason,
  truncate
} from "@/lib/ingestion/failure";

describe("ingestionFailure", () => {
  it("carries the failed lifecycle stage and composes reason + why + next step", () => {
    const f = ingestionFailure("Could not ingest this PDF.", {
      why: "The file is password locked.",
      nextStep: "Upload an unlocked copy."
    });
    expect(f.stage).toBe("failed");
    expect(isIngestionFailure(f)).toBe(true);
    expect(f.message).toContain("Could not ingest this PDF.");
    expect(f.message).toContain("password locked");
    expect(f.message).toContain("Upload an unlocked copy");
    expect(f.nextStep).toBe("Upload an unlocked copy.");
  });

  it("defaults to a terse message when only the reason is given", () => {
    const f = ingestionFailure("Nope.");
    expect(f.message).toBe("Nope.");
    expect(f.why).toBeNull();
  });
});

describe("toFailReason", () => {
  it("passes IngestionFailure messages through", () => {
    expect(toFailReason(ingestionFailure("human message"))).toBe("human message");
  });

  it("never leaks a stack trace for a plain Error", () => {
    const err = new Error("boom");
    err.stack = "Error: boom\n    at badCode (secret/path/file.ts:1:1)";
    const reason = toFailReason(err);
    expect(reason).toContain("boom");
    expect(reason).not.toContain("secret/path");
    expect(reason).not.toContain("at badCode");
  });

  it("truncates an over-long message with an ellipsis", () => {
    expect(toFailReason(new Error("x".repeat(500))).length).toBeLessThanOrEqual(301);
  });

  it("classifies non-Error throws instead of echoing them raw", () => {
    expect(toFailReason(undefined)).toContain("An unexpected error occurred");
    expect(toFailReason(42)).toContain("An unexpected error occurred");
    expect(toFailReason("plain string")).toBe("plain string");
  });
});

describe("buildFailReason / truncate", () => {
  it("joins only the clauses present", () => {
    expect(buildFailReason("A", undefined, "C")).toBe("A C");
    expect(buildFailReason("A")).toBe("A");
  });

  it("truncate normalizes whitespace", () => {
    expect(truncate("a   b\nc", 20)).toBe("a b c");
  });
});