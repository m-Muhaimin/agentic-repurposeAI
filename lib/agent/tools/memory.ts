// Tool: brand/memory. Reads the Stage 2 brand voice profile and signals. The
// write-side (recordEditSignal / profile updates) is gated behind the confirm
// loop in /api/agent/preferences — never automatic.

import { getAgentPreferences, recordEditSignal } from "@/lib/agent/memory";
import type { AgentTool, ToolContext, ToolResult, EditSignal } from "@/types/agent";

export interface MemoryInput {
  action: "read" | "record" | "suggest";
  signal?: EditSignal;
}

export const memoryTool: AgentTool = {
  name: "memory",
  kind: "planning",
  label: "Brand & memory",
  requires: ["assist", "execute", "automate"],
  describe: () => "Reads brand voice and edit signals for the current user.",
  async run(ctx: ToolContext, input: unknown): Promise<ToolResult> {
    const { action, signal } = (input ?? {}) as MemoryInput;

    if (action === "record") {
      if (!signal?.outputId) return { ok: false, data: null, error: "signal.outputId required" };
      await recordEditSignal(ctx.userId, signal);
      return { ok: true, data: { recorded: true } };
    }

    const prefs = await getAgentPreferences(ctx.userId);
    return {
      ok: true,
      data: prefs
        ? {
            autoMode: prefs.autoMode,
            brand: prefs.brand,
            brandSamples: prefs.brandSamples,
            signalCount: prefs.editSignals.length
          }
        : null
    };
  }
};