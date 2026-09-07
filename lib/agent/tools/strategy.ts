// Stage 4 strategy tool — a read-only heuristic SEED, not a real performance-
// learning loop. It derives the next-week content strategy from what already
// exists (output counts per format, edit-signal density) and persists a
// strategy doc into v4_content_strategies for the agent UI. No analytics
// pipeline, no lookback tuning yet.

import { createServiceClient } from "@/lib/supabase/server";
import { getUserBrandVoice, getAgentPreferences } from "@/lib/agent/memory";
import { log } from "@/lib/logger";
import type { AgentTool, ToolContext, ToolResult } from "@/types/agent";

export interface StrategyInput {
  // Number of days of history to consider (heuristic seed only).
  lookbackDays?: number;
}

export interface StrategyOutput {
  strategyId: string;
  body: string;
}

export const strategyTool: AgentTool = {
  name: "strategy",
  kind: "strategy",
  label: "Content strategy",
  requires: ["automate"],
  describe: () => "Read-only heuristic strategy seed (Stage 4): derives next-week guidance from outputs.",
  async run(ctx: ToolContext, input: unknown): Promise<ToolResult> {
    const { lookbackDays = 7 } = (input ?? {}) as StrategyInput;
    const service = createServiceClient();

    const [prefs, brand] = await Promise.all([
      getAgentPreferences(ctx.userId).catch(() => null),
      getUserBrandVoice(ctx.userId)
    ]);

    // What has been produced in the lookback window?
    const since = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString();
    const { data: outputs, error } = await service
      .from("outputs")
      .select("format")
      .eq("user_id", ctx.userId)
      .gte("created_at", since);
    if (error) return { ok: false, data: null, error: error.message };

    const byFormat = new Map<string, number>();
    for (const o of outputs ?? []) byFormat.set(o.format, (byFormat.get(o.format) ?? 0) + 1);
    const total = outputs?.length ?? 0;

    const signalCount = prefs?.editSignals.length ?? 0;
    const recommendations: string[] = [];

    if (byFormat.size === 0) {
      recommendations.push("No outputs yet this window — run the agent on strong sources before planning.");
    } else {
      const sorted = [...byFormat.entries()].sort((a, b) => b[1] - a[1]);
      recommendations.push(
        `${sorted[0][0]} is your most prolific format — double down on it next week.`
      );
    }

    if (signalCount >= 3) {
      recommendations.push(
        `You made ${signalCount} manual edits — review v4_agent_preferences to fold them into the brand voice.`
      );
    }

    if (brand.tone) {
      recommendations.push(`Keep the "${brand.tone}" tone setting locked for a consistent feed.`);
    }

    const body = [
      total === 0
        ? "No recent output history to plan around yet."
        : `Heuristic seed based on ${total} outputs across ${byFormat.size} format(s) in the last ${lookbackDays} days.`,
      ...recommendations
    ].join("\n\n");

    const { data, error: insertError } = await service
      .from("v4_content_strategies")
      .insert({
        user_id: ctx.userId,
        title: `Weekly strategy — ${new Date().toISOString().slice(0, 10)}`,
        body,
        source: "heuristic"
      })
      .select("id")
      .single();

    if (insertError) return { ok: false, data: null, error: insertError.message };

    log.info("agent.strategy_seeded", { run_id: ctx.runId, user_id: ctx.userId, outputs: total });

    const out: StrategyOutput = {
      strategyId: data.id,
      body
    };
    return { ok: true, data: out };
  }
};