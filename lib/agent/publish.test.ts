// P10 + Stage 4 BYOB: Tests for the publish-queue approval state machine +
// gating. The CRITICAL guarantee: no action auto-advances a job, and without a
// connected channel a job can never reach `published`.
//
// publishingChannelsConnected is now DB-backed and async (buffer_connections
// row exists ⇔ connected). The pure state machine stays pure: callers pass the
// resolved boolean in.

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
  it("is false when no service client / user id is given", async () => {
    // Fail closed in every degenerate call — never assume connected.
    expect(await publishingChannelsConnected("", {} as never)).toBe(false);
    expect(await publishingChannelsConnected("user-1", {} as never)).toBe(false);
  });

  it("is true when a buffer_connections row exists for the user", async () => {
    const service = {
      from: () => ({
        select: () => ({
          eq: () => ({ neq: () => ({ maybeSingle: async () => ({ data: { id: "conn-1" }, error: null }) }) })
        })
      })
    } as never;
    expect(await publishingChannelsConnected("user-1", service)).toBe(true);
  });

  it("is false when no buffer_connections row exists (disconnected)", async () => {
    const service = {
      from: () => ({
        select: () => ({
          eq: () => ({ neq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) })
        })
      })
    } as never;
    expect(await publishingChannelsConnected("user-1", service)).toBe(false);
  });

  it("is false when the query errors (fail closed)", async () => {
    const service = {
      from: () => ({
        select: () => ({
          eq: () => ({ neq: () => ({ maybeSingle: async () => ({ data: null, error: new Error("boom") }) }) })
        })
      })
    } as never;
    expect(await publishingChannelsConnected("user-1", service)).toBe(false);
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
    expect(nextPublishStatus("scheduled", { type: "approve_send" }, true)).toBe("published");
  });

  it("cancel withdraws draft/scheduled but not terminal jobs", () => {
    expect(nextPublishStatus("draft", { type: "cancel" })).toBe("cancelled");
    expect(nextPublishStatus("scheduled", { type: "cancel" })).toBe("cancelled");
    expect(nextPublishStatus("published", { type: "cancel" })).toBe("published");
  });

  it("nothing auto-advances: every transition requires an explicit action", () => {
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

  it("published is unreachable with the disconnected gate", () => {
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

  it("canRequestSend defaults to false (no channel) and requires connected", () => {
    expect(canRequestSend("scheduled")).toBe(false);
    expect(canRequestSend("scheduled", false)).toBe(false);
    expect(canRequestSend("scheduled", true)).toBe(true);
    expect(canRequestSend("draft", true)).toBe(false);
    expect(canRequestSend("published", true)).toBe(false);
  });

  it("publishBlockReason explains why send is blocked (no fake success)", () => {
    expect(publishBlockReason("scheduled")).toContain("Connect a Buffer");
    expect(publishBlockReason("published")).toContain("published");
    expect(publishBlockReason("cancelled")).toContain("cancelled");
    expect(publishBlockReason("draft")).toBeNull();
    // Connected + pending => no block reason.
    expect(publishBlockReason("scheduled", true)).toBeNull();
  });

  it("NOT_CONNECTED_MESSAGE is truthful", () => {
    expect(NOT_CONNECTED_MESSAGE).toContain("Connect a Buffer");
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