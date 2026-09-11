// Phase 3: domain event builders. Each builder must produce the exact
// NotificationInput described in the locked contract — asserted by inspecting
// the mocked createNotification's recorded args (never a live DB).

import { describe, expect, it, vi, beforeEach } from "vitest";
import type { NotificationInput, NotificationRecord } from "./types";
import { NOTIFICATION_TYPES } from "./types";

const { createNotificationMock } = vi.hoisted(() => ({ createNotificationMock: vi.fn() }));
vi.mock("./create", () => ({ createNotification: createNotificationMock }));

import {
  notifyAgentRunChanged,
  notifySourceChanged,
  notifyContentGenerated,
  notifyPublishChanged,
  notifyUsageLimit,
  notifyBillingEvent
} from "./events";
import { areInAppNotificationsEnabled, notificationTypeLabel } from "./preferences";

const RECORD = {
  id: "n1",
  userId: "u1",
  type: "agent.started",
  title: "t",
  body: "b",
  severity: "info",
  entityType: null,
  entityId: null,
  actionUrl: null,
  metadata: null,
  dedupeKey: null,
  expiresAt: null,
  readAt: null,
  createdAt: "2026-09-12T00:00:00.000Z"
} as NotificationRecord;

function lastInput(): NotificationInput {
  return createNotificationMock.mock.calls.at(-1)?.[0] as NotificationInput;
}

beforeEach(() => {
  createNotificationMock.mockReset();
  createNotificationMock.mockResolvedValue(RECORD);
});

describe("notifyAgentRunChanged", () => {
  const cases: Array<[status: string, type: string, severity: string, title: string, body: string]> = [
    ["planning", "agent.started", "info", "Agent started", "VervAI is analyzing your source and preparing recommendations."],
    ["executing", "agent.started", "info", "Agent started", "VervAI is analyzing your source and preparing recommendations."],
    ["awaiting_approval", "agent.awaiting_approval", "info", "Your plan is ready", "VervAI has prepared recommendations for your review."],
    ["done", "agent.completed", "success", "Agent run completed", "Your recommended content plan is ready to review."],
    ["failed", "agent.failed", "error", "Agent run failed", "VervAI couldn't complete this run. Review the run status and try again."],
    ["cancelled", "agent.paused", "warning", "Agent run stopped", "Your agent run was stopped before it finished."]
  ];

  it.each(cases)("maps status %s → %s (%s)", async (status, type, severity, title, body) => {
    const record = await notifyAgentRunChanged("u1", { id: "run1", status });
    expect(record).toEqual(RECORD);
    expect(lastInput()).toEqual({
      userId: "u1",
      type,
      title,
      body,
      severity,
      entityType: "agent_run",
      entityId: "run1",
      actionUrl: "/agent?run=run1",
      dedupeKey: `agent.${type}:agent_run:u1:run1`
    });
  });

  it("emits no notification for an unknown/non-notifiable status", async () => {
    expect(await notifyAgentRunChanged("u1", { id: "run1", status: "evaluating" })).toBeNull();
    expect(await notifyAgentRunChanged("u1", { id: "run1", status: "created" })).toBeNull();
    expect(createNotificationMock).not.toHaveBeenCalled();
  });

  it("honors an explicit actionUrl override", async () => {
    await notifyAgentRunChanged("u1", { id: "run1", status: "done" }, { actionUrl: "/custom" });
    expect(lastInput().actionUrl).toBe("/custom");
  });

  it("scopes the dedupe key per user — two users, same run id → distinct keys", async () => {
    await notifyAgentRunChanged("u1", { id: "run1", status: "done" });
    await notifyAgentRunChanged("u2", { id: "run1", status: "done" });
    const keys = createNotificationMock.mock.calls.map((c) => (c[0] as NotificationInput).dedupeKey);
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe("agent.agent.completed:agent_run:u1:run1");
    expect(keys[1]).toBe("agent.agent.completed:agent_run:u2:run1");
    expect(keys[0]).not.toBe(keys[1]);
  });
});

describe("notifySourceChanged", () => {
  const cases: Array<[event: "processing" | "ready" | "failed", type: string, severity: string, title: string, body: string, actionUrl: string]> = [
    ["processing", "source.processing", "info", "Your source is processing", "VervAI is turning your source into usable content.", "/agent"],
    ["ready", "source.ready", "success", "Your source is ready", "Your source has been processed and is ready for VervAI.", "/agent"],
    ["failed", "source.failed", "error", "Source processing failed", "VervAI couldn't process this source. Check the source status and try again.", "/library"]
  ];

  it.each(cases)("maps event %s → %s (%s)", async (event, type, severity, title, body, actionUrl) => {
    await notifySourceChanged("u1", { id: "s1" }, event);
    expect(lastInput()).toEqual({
      userId: "u1",
      type,
      title,
      body,
      severity,
      entityType: "source",
      entityId: "s1",
      actionUrl,
      dedupeKey: `${event}:source:u1:s1`
    });
  });

  it("honors an explicit actionUrl override", async () => {
    await notifySourceChanged("u1", { id: "s1" }, "failed", { actionUrl: "/repurpose/s1" });
    expect(lastInput().actionUrl).toBe("/repurpose/s1");
  });

  it("scopes the dedupe key per user — two users, same source id → distinct keys", async () => {
    await notifySourceChanged("u1", { id: "s1" }, "ready");
    await notifySourceChanged("u2", { id: "s1" }, "ready");
    const keys = createNotificationMock.mock.calls.map((c) => (c[0] as NotificationInput).dedupeKey);
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe("ready:source:u1:s1");
    expect(keys[1]).toBe("ready:source:u2:s1");
    expect(keys[0]).not.toBe(keys[1]);
  });
});

describe("notifyContentGenerated", () => {
  it("emits content.generated with the output-id editor URL", async () => {
    await notifyContentGenerated("u1", { id: "o1" });
    expect(lastInput()).toEqual({
      userId: "u1",
      type: "content.generated",
      title: "Your draft is ready",
      body: "VervAI finished a new draft for you.",
      severity: "success",
      entityType: "output",
      entityId: "o1",
      actionUrl: "/repurpose/o1", // /repurpose/[id] resolves an OUTPUT by params.id
      dedupeKey: undefined
    });
  });

  it("honors an explicit actionUrl override", async () => {
    await notifyContentGenerated("u1", { id: "o1" }, { actionUrl: "/custom" });
    expect(lastInput().actionUrl).toBe("/custom");
  });
});

describe("notifyPublishChanged", () => {
  const cases: Array<[event: "scheduled" | "started" | "published" | "failed", type: string, severity: string, title: string, body: string]> = [
    ["scheduled", "publish.scheduled", "info", "Post scheduled", "Your content is scheduled for publishing."],
    ["started", "publish.started", "info", "Publishing started", "VervAI is publishing your content."],
    ["published", "publish.published", "success", "Published successfully", "Your content was published successfully."],
    ["failed", "publish.failed", "error", "Publishing failed", "We couldn't publish this content. Check the publishing connection and try again."]
  ];

  it.each(cases)("maps event %s → %s (%s)", async (event, type, severity, title, body) => {
    await notifyPublishChanged("u1", { id: "j1" }, event);
    expect(lastInput()).toEqual({
      userId: "u1",
      type,
      title,
      body,
      severity,
      entityType: "distribution_job",
      entityId: "j1",
      actionUrl: "/publish",
      metadata: null,
      dedupeKey: `publish.${event}:distribution_job:u1:j1`
    });
  });

  it("carries the target channel in metadata when provided", async () => {
    await notifyPublishChanged("u1", { id: "j1" }, "published", { channel: "linkedin" });
    expect(lastInput().metadata).toEqual({ channel: "linkedin" });
  });

  it("scopes the dedupe key per user — two users, same job id → distinct keys", async () => {
    await notifyPublishChanged("u1", { id: "j1" }, "published");
    await notifyPublishChanged("u2", { id: "j1" }, "published");
    const keys = createNotificationMock.mock.calls.map((c) => (c[0] as NotificationInput).dedupeKey);
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe("publish.published:distribution_job:u1:j1");
    expect(keys[1]).toBe("publish.published:distribution_job:u2:j1");
    expect(keys[0]).not.toBe(keys[1]);
  });
});

describe("notifyUsageLimit", () => {
  it("emits usage.limit_near (warning) at exactly 80%", async () => {
    await notifyUsageLimit("u1", { percent: 80, limit: 10, used: 8, windowLabel: "2026-09" });
    expect(lastInput()).toEqual({
      userId: "u1",
      type: "usage.limit_near",
      title: "You've used most of your monthly usage",
      body: "You've used 80% of your monthly usage limit.",
      severity: "warning",
      entityType: "usage",
      entityId: "2026-09",
      metadata: { percent: 80, limit: 10, used: 8 },
      dedupeKey: "usage.limit_near:usage:u1:2026-09"
    });
  });

  it("emits usage.limit_reached (error) at or above 100%", async () => {
    await notifyUsageLimit("u1", { percent: 100, limit: 10, used: 10, windowLabel: "2026-09" });
    expect(lastInput()).toMatchObject({
      type: "usage.limit_reached",
      title: "Your monthly usage limit has been reached",
      body: "You can't create more content until your limit resets.",
      severity: "error",
      dedupeKey: "usage.limit_reached:usage:u1:2026-09"
    });
  });

  it("scopes the dedupe key per user — two users, same window → distinct keys", async () => {
    await notifyUsageLimit("u1", { percent: 80, limit: 10, used: 8, windowLabel: "2026-09" });
    await notifyUsageLimit("u2", { percent: 80, limit: 10, used: 8, windowLabel: "2026-09" });
    const keys = createNotificationMock.mock.calls.map((c) => (c[0] as NotificationInput).dedupeKey);
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe("usage.limit_near:usage:u1:2026-09");
    expect(keys[1]).toBe("usage.limit_near:usage:u2:2026-09");
    expect(keys[0]).not.toBe(keys[1]);
  });

  it("re-emits the same key for the same user + window (dedupe preserved)", async () => {
    await notifyUsageLimit("u1", { percent: 100, limit: 10, used: 10, windowLabel: "2026-09" });
    await notifyUsageLimit("u1", { percent: 100, limit: 10, used: 10, windowLabel: "2026-09" });
    const keys = createNotificationMock.mock.calls.map((c) => (c[0] as NotificationInput).dedupeKey);
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe("usage.limit_reached:usage:u1:2026-09");
    expect(keys[1]).toBe(keys[0]);
  });

  it("emits nothing below 80%", async () => {
    expect(await notifyUsageLimit("u1", { percent: 79, limit: 10, used: 7, windowLabel: "2026-09" })).toBeNull();
    expect(createNotificationMock).not.toHaveBeenCalled();
  });
});

describe("notifyBillingEvent", () => {
  it("emits subscription.updated (info) with no dedupe key", async () => {
    await notifyBillingEvent("u1", "subscription.updated");
    expect(lastInput()).toEqual({
      userId: "u1",
      type: "subscription.updated",
      title: "Plan updated",
      body: "Your subscription plan was updated.",
      severity: "info",
      entityType: "billing",
      actionUrl: "/settings",
      metadata: null,
      dedupeKey: undefined // every plan change is its own event
    });
  });

  it("emits payment.failed (error)", async () => {
    await notifyBillingEvent("u1", "payment.failed");
    expect(lastInput()).toMatchObject({
      type: "payment.failed",
      title: "Payment failed",
      severity: "error"
    });
  });

  it("carries the plan label in metadata when provided", async () => {
    await notifyBillingEvent("u1", "subscription.updated", { planLabel: "Pro" });
    expect(lastInput().metadata).toEqual({ plan: "Pro" });
  });
});

describe("preferences", () => {
  it("areInAppNotificationsEnabled is always true (no preferences table yet)", async () => {
    expect(await areInAppNotificationsEnabled("u1", "agent.started")).toBe(true);
  });

  it("notificationTypeLabel returns human labels and falls back to the raw type", () => {
    expect(notificationTypeLabel("agent.completed")).toBe("Agent run completed");
    expect(notificationTypeLabel("publish.published")).toBe("Published successfully");
    expect(notificationTypeLabel("source.failed")).toBe("Source processing failed");
    expect(notificationTypeLabel("unknown.type" as never)).toBe("unknown.type");
  });

  it("maps every taxonomy type to a non-empty label", () => {
    // Spot-check coverage of the full taxonomy list stays in sync.
    for (const type of NOTIFICATION_TYPES) {
      expect(notificationTypeLabel(type).length).toBeGreaterThan(0);
    }
  });
});