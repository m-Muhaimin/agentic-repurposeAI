// Stage 3/4 distribution tool — an honest STRUCTURED STUB. The capability is
// deliberately gated off until a real scheduling/publishing surface exists. A
// run that somehow reaches distribution (via `automate` mode today) gets a
// deliberate, descriptive failure — never a silent no-op pretending to publish.

import type { AgentTool, ToolContext, ToolResult, DistributionPlatform } from "@/types/agent";

const KNOWN_PLATFORMS: DistributionPlatform[] = [
  "linkedin",
  "x",
  "newsletter",
  "youtube_shorts",
  "tiktok",
  "instagram"
];

class NotImplementedError extends Error {
  constructor(platform: DistributionPlatform) {
    super(`Distribution to ${platform} is not implemented yet (Stages 3-4). No post was scheduled or published.`);
    this.name = "NotImplementedError";
  }
}

export interface DistributionInput {
  platform: DistributionPlatform;
  outputId: string;
  scheduledAt?: string;
}

export const distributionTool: AgentTool = {
  name: "distribution",
  kind: "distribution",
  label: "Schedule / publish",
  requires: ["automate"],
  describe: () => "Structured stub for Stage 3-4 scheduling+publishing (deliberately not wired up).",
  async run(_ctx: ToolContext, input: unknown): Promise<ToolResult> {
    const { platform, outputId } = (input ?? {}) as DistributionInput;

    if (!KNOWN_PLATFORMS.includes(platform)) {
      return { ok: false, data: null, error: `Unknown platform: ${String(platform)}` };
    }
    if (!outputId) return { ok: false, data: null, error: "outputId required" };

    // Deliberately throw — the roadmap marks V3 schedule/publish as not real.
    return { ok: false, data: null, error: new NotImplementedError(platform).message };
  }
};