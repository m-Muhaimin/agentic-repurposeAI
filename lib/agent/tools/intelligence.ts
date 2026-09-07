// Tool: intelligence (planner). The single differentiated planning LLM call —
// transcript → structured Content Plan. Brand voice from Stage 2 memory is
// layered into the prompt so angles land in the creator's voice.

import { planContent } from "@/lib/agent/planner";
import { getUserBrandVoice } from "@/lib/agent/memory";
import type { AgentTool, ToolContext, ToolResult, ContentPlan } from "@/types/agent";

export interface IntelligenceInput {
  transcript: string;
}

export interface IntelligenceOutput {
  plan: ContentPlan;
  inputTokens: number;
  outputTokens: number;
}

export const intelligenceTool: AgentTool = {
  name: "intelligence",
  kind: "planning",
  label: "Plan content angles",
  requires: ["assist", "execute", "automate"],
  describe: () => "One Gemini call that converts a transcript into a structured content plan.",
  async run(ctx: ToolContext, input: unknown): Promise<ToolResult> {
    const { transcript } = (input ?? {}) as IntelligenceInput;
    if (!transcript?.trim()) return { ok: false, data: null, error: "transcript required" };

    const brand = await getUserBrandVoice(ctx.userId);
    const { plan, inputTokens, outputTokens } = await planContent(transcript, brand);

    const out: IntelligenceOutput = { plan, inputTokens, outputTokens };
    return { ok: true, data: out };
  }
};