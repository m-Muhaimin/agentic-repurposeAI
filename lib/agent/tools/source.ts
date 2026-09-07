// Tool: source. Resolves a run's durable transcript input. Writes nothing —
// reads the canonical transcript (transcripts table, falling back to the
// denormalised sources.transcript) and returns it to the intelligence step.

import { createServiceClient } from "@/lib/supabase/server";
import type { AgentTool, ToolContext, ToolResult } from "@/types/agent";

export interface SourceInput {
  sourceId: string;
}

export interface SourceOutput {
  sourceId: string;
  title: string;
  transcript: string;
  durationSeconds: number | null;
}

export const sourceTool: AgentTool = {
  name: "source",
  kind: "source",
  label: "Load source transcript",
  requires: ["assist", "execute", "automate"],
  describe: () => "Resolves the source's canonical transcript for the run.",
  async run(ctx: ToolContext, input: unknown): Promise<ToolResult> {
    const { sourceId } = (input ?? {}) as SourceInput;
    if (!sourceId) return { ok: false, data: null, error: "sourceId required" };

    const service = createServiceClient();

    const { data: source, error } = await service
      .from("sources")
      .select("id, title, transcript, duration_seconds, user_id")
      .eq("id", sourceId)
      .eq("user_id", ctx.userId)
      .maybeSingle();

    if (error || !source) {
      return { ok: false, data: null, error: error?.message ?? "Source not found" };
    }

    // Canonical transcript (one per source) wins; denormalised column is the
    // fallback for DBs where the transcripts migration hasn't run.
    let transcript = source.transcript ?? "";
    try {
      const { data: row } = await service
        .from("transcripts")
        .select("content")
        .eq("source_id", sourceId)
        .eq("user_id", ctx.userId)
        .maybeSingle();
      if (row?.content) transcript = row.content;
    } catch {
      // Keep sources.transcript fallback.
    }

    if (!transcript.trim()) {
      return { ok: false, data: null, error: "No transcript available for this source yet." };
    }

    const out: SourceOutput = {
      sourceId,
      title: source.title,
      transcript,
      durationSeconds: source.duration_seconds
    };
    return { ok: true, data: out };
  }
};