// automate-mode scheduling: pure target planning from drafts + the user's
// Buffer channels. Deterministic + explicit — a draft with no serviceable
// channel is reported as skipped, never silently dropped or fabricated.

import { describe, expect, it } from "vitest";
import { OUTPUT_FORMAT_TO_PLATFORM, planScheduleTargets } from "@/lib/agent/schedule";
import type { BufferChannelMCP } from "@/lib/buffer/mcp";

const channels: BufferChannelMCP[] = [
  { id: "ch-li", name: "Company", service: "linkedin", type: null, connectionStatus: "connected" },
  { id: "ch-x", name: "Comms", service: "twitter", type: null, connectionStatus: "connected" }
];

const outputs = [
  { id: "o1", format: "linkedin_post", content: "A post." },
  { id: "o2", format: "shortform_script", content: "A script." },
  { id: "o3", format: "newsletter", content: "Email copy." },
  { id: "o4", format: "shortform_script", content: "" },
  { id: "o5", format: "linkedin_post", content: "Orphan draft." }
];

describe("OUTPUT_FORMAT_TO_PLATFORM", () => {
  it("maps delivered formats to Buffer platforms honestly (newsletter has none)", () => {
    expect(OUTPUT_FORMAT_TO_PLATFORM.linkedin_post).toBe("linkedin");
    expect(OUTPUT_FORMAT_TO_PLATFORM.shortform_script).toBe("x");
    expect(OUTPUT_FORMAT_TO_PLATFORM.thread).toBe("x");
    expect(OUTPUT_FORMAT_TO_PLATFORM.carousel).toBe("linkedin");
    expect(OUTPUT_FORMAT_TO_PLATFORM.newsletter).toBeUndefined();
  });
});

describe("planScheduleTargets", () => {
  it("schedules only drafts with a serviceable channel, skipping the rest with reasons", () => {
    const { targets, skipped } = planScheduleTargets(outputs, channels);

    // o1 -> linkedin, o2 -> x (via twitter service). o5 has no x channel to
    // spare but its platform is linkedin which exists... wait: o5 links to
    // the linkedin channel already consumed? No — we don't dedupe channels,
    // so o5 also targets ch-li (Buffer allows multiple queue items per channel).
    expect(targets).toHaveLength(3);
    expect(targets.map((t) => t.outputId)).toEqual(["o1", "o2", "o5"]);
    expect(targets[0]).toMatchObject({ outputId: "o1", platform: "linkedin", channelId: "ch-li" });
    expect(targets[1]).toMatchObject({ outputId: "o2", platform: "x", channelId: "ch-x" });

    // o3 (newsletter) and o4 (empty draft) are reported, not fabricated.
    const reasons = Object.fromEntries(skipped.map((s) => [s.outputId, s.reason]));
    expect(reasons.o3).toMatch(/newsletter has no Buffer channel/i);
    expect(reasons.o4).toMatch(/empty/i);
  });

  it("skips a draft when its platform has no matching connected channel", () => {
    const { targets, skipped } = planScheduleTargets(
      [{ id: "o9", format: "shortform_script", content: "script" }],
      [channels[0]]
    );
    expect(targets).toHaveLength(0);
    expect(skipped[0].reason).toMatch(/no connected x channel/i);
  });

  it("calls the same Buffer service mapping as the manual publish path", async () => {
    const { platformToBufferService } = await import("@/lib/buffer/client");
    expect(platformToBufferService("linkedin")).toBe("linkedin");
    expect(platformToBufferService("x")).toBe("twitter");
    expect(platformToBufferService("newsletter")).toBeNull();
    expect(platformToBufferService("youtube_shorts")).toBe("youtube");
  });
});