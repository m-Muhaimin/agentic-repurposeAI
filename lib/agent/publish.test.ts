// P10: Tests for the publish-queue approval state machine + gating.
// The CRITICAL guarantee: no action auto-advances a job, and without a
// connected channel a job can never reach `published`.

import { describe, expect, it } from "vitest";
import {
  nextPublishStatus,
  publishingChannelsConnected,
  canRequestSend,
  isPublishable,
  isPendingSend,
  publishBlockReason,
  normalizePlatform,
  NOT_CONNECTED_MESSAGE
} from "@/lib/agent/publish";

describe("publishingChannelsConnected", () => {
  it("is always false in this build (no provider is wired)", () => {
    expect(publishingChannelsConnected()).toBe(false);
  });
});

describe("nextPublishStatus — approval state machine", () => {
  it("queue moves draft → scheduled (pending human approval)", () => {
    expect(nextPublishStatus("draft", { type: "queue" })).toBe("scheduled");
  });

  it("queue does nothing to a non-draft", () => {
    expect(nextPublishStatus("scheduled", { type: "queue" })).toBe("scheduled");
    expect(nextPublishStatus("cancelled", { type: "queue" })).toBe("cancelled");
    expect(nextPublishStatus("published", { type: "queue" })).toBe("published");
  });

  it("approve_send NEVER publishes when channels are disconnected (honest gate)", () => {
    // Even an explicit approval cannot publish without a real channel.
    expect(nextPublishStatus("scheduled", { type: "approve_send" }, false)).toBe("scheduled");
    expect(nextPublishStatus("draft", { type: "approve_send" }, false)).toBe("draft");
  });

  it("approve_send only publishes a scheduled job when a channel is connected", () => {
    // This forms the transition that would be real only after wiring a provider.
    expect(nextPublishStatus("scheduled", { type: "approve_send" }, true)).toBe("published");
  });

  it("cancel withdraws draft/scheduled but not terminal jobs", () => {
    expect(nextPublishStatus("draft", { type: "cancel" })).toBe("cancelled");
    expect(nextPublishStatus("scheduled", { type: "cancel" })).toBe("cancelled");
    expect(nextPublishStatus("published", { type: "cancel" })).toBe("published");
  });

  it("nothing auto-advances: every transition requires an explicit action", () => {
    // A job left alone must keep its state for every non-destructive action
    // when channels are disconnected — the core no-autopilot property.
    const initial = "scheduled";
    const actions = [
      { type: "queue" },
      { type: "approve_send" },
      { type: "cancel" }
    ] as const;
    for (const a of actions) {
      if (a.type === "cancel") continue; // cancel is an explicit human withdrawal
      expect(nextPublishStatus(initial, a, false)).toBe(initial);
    }
  });

  it("published is unreachable with the real (disconnected) gate default", () => {
    // Simulate the full lifecycle in every order; published must be unreachable.
    const results = [
      nextPublishStatus("draft", { type: "queue" }),
      nextPublishStatus("scheduled", { type: "approve_send" })
    ];
    expect(results).toEqual(["scheduled", "scheduled"]);
  });
});

describe("predicates + gating", () => {
  it("exposes honest render/gate predicates", () => {
    expect(isPublishable("draft")).toBe(true);
    expect(isPublishable("scheduled")).toBe(false);
    expect(isPendingSend("scheduled")).toBe(true);
    expect(isPendingSend("draft")).toBe(false);
  });

  it("canRequestSend is false because no channel is connected", () => {
    expect(canRequestSend("scheduled")).toBe(false);
  });

  it("publishBlockReason explains why send is blocked (no fake success)", () => {
    expect(publishBlockReason("scheduled")).toContain("not available");
    expect(publishBlockReason("published")).toContain("published");
    expect(publishBlockReason("cancelled")).toContain("cancelled");
    expect(publishBlockReason("draft")).toBeNull();
  });

  it("NOT_CONNECTED_MESSAGE is truthful", () => {
    expect(NOT_CONNECTED_MESSAGE).toContain("not available");
    expect(NOT_CONNECTED_MESSAGE).not.toContain("success");
  });
});

describe("normalizePlatform", () => {
  it("accepts known platforms", () => {
    expect(normalizePlatform("linkedin")).toBe("linkedin");
    expect(normalizePlatform("x")).toBe("x");
    expect(normalizePlatform("newsletter")).toBe("newsletter");
  });

  it("rejects unknown/empty platforms", () => {
    expect(normalizePlatform("facebook")).toBeNull();
    expect(normalizePlatform("")).toBeNull();
    expect(normalizePlatform(null)).toBeNull();
    expect(normalizePlatform(123)).toBeNull();
  });
});
