// Tool: generation. Wraps the base app's generateOutput (Gemini with an
// OpenRouter quota fallback) and persists each draft into the EXISTING outputs
// table — so agentic drafts show up in /library and /repurpose/[id] with zero
// new viewer UI (the design doc's §17 reuse principle).

import { createServiceClient } from "@/lib/supabase/server";
import { generateOutput } from "@/lib/ai/generate";
import { buildSystemPrompt } from "@/lib/ai/prompts";
import { getUserPrompts } from "@/lib/prompts";
import { getUserBrandVoice, getRecentSignals } from "@/lib/agent/memory";
import { log } from "@/lib/logger";
import type { AgentTool, ToolContext, ToolResult, OutputFormat } from "@/types/agent";

export interface GenerationInput {
  sourceId: string;
  format: OutputFormat;
  transcript: string;
  // The plan angle this draft serves (keeps generation deterministic per
  // approved angle instead of re-planning).
  angleTitle?: string;
  angleDescription?: string;
  // Bounded revision pass (execute/automate only) — appended to the prompt.
  revisionInstruction?: string;
  // Output to overwrite (revision pass only).
  outputId?: string;
}

export interface GenerationOutput {
  format: OutputFormat;
  content: string;
  outputId: string;
  revised: boolean;
  inputTokens: number;
  outputTokens: number;
}

export const generationTool: AgentTool = {
  name: "generation",
  kind: "generation",
  label: "Generate draft",
  requires: ["assist", "execute", "automate"],
  describe: () => "Deterministic per-angle draft generation into the outputs table.",
  async run(ctx: ToolContext, input: unknown): Promise<ToolResult> {
    const g = (input ?? {}) as GenerationInput;
    if (!g.sourceId || !g.format || !g.transcript) {
      return { ok: false, data: null, error: "sourceId, format and transcript required" };
    }

    // Resolve prompt map (custom overrides + brand voice) exactly like the base
    // worker does, then layer the angle's working title on top so the draft is
    // recognisably about THIS angle, not a generic repurpose.
    const promptMap = await getUserPrompts(ctx.userId).catch(() => ({}));
    const brand = await getUserBrandVoice(ctx.userId);
    const base = buildSystemPrompt(g.format, promptMap);

    const angleBlock = g.angleTitle ? `\n\nWorking angle to serve: "${g.angleTitle}"${g.angleDescription ? ` — ${g.angleDescription}` : ""}` : "";
    const revisionBlock = g.revisionInstruction
      ? `\n\nPrevious draft was flagged. Revise accordingly (one pass only):\n${g.revisionInstruction}`
      : "";
    const voiceBlock =
      brand.tone || brand.forbiddenPhrases.length || brand.examples.length
        ? `\n\nBrand voice — apply these guidelines to the whole draft:\n- Tone: ${brand.tone || "match the transcript's register"}${brand.forbiddenPhrases.length ? `\n- Forbidden: ${brand.forbiddenPhrases.join(", ")}` : ""}${brand.examples.length ? `\n- Examples to mirror:\n${brand.examples.map((e) => `  - ${e}`).join("\n")}` : ""}`
        : "";

    // P4: Wire recent edit signals so the generation leans toward what the user
    // tends to keep. Bounded (max 5), typed, deterministic — no LLM call.
    let editContextBlock = "";
    try {
      const editSignals = await getRecentSignals(ctx.userId, "edit", 5);
      if (editSignals.length > 0) {
        const summaries = editSignals.map((s) => `  - ${s.whatChanged}`).join("\n");
        editContextBlock = `\n\nRecent user edits to previous drafts (learn what they keep vs rewrite):\n${summaries}`;
      }
    } catch {
      // Memory unavailable — skip the context block gracefully.
    }

    const systemPrompt = base + angleBlock + revisionBlock + voiceBlock + editContextBlock;

    const genResult = await generateOutput(g.format, g.transcript, systemPrompt);
    const content = genResult.content;
    const inputTokens = genResult.inputTokens;
    const outputTokens = genResult.outputTokens;

    const service = createServiceClient();

    if (g.outputId) {
      // Revision pass — overwrite the flagged draft in place.
      const { error } = await service
        .from("outputs")
        .update({ content, updated_at: new Date().toISOString() })
        .eq("id", g.outputId)
        .eq("user_id", ctx.userId);
      if (error) return { ok: false, data: null, error: error.message };
      const out: GenerationOutput = { format: g.format, content, outputId: g.outputId, revised: true, inputTokens, outputTokens };
      log.info("agent.generation_revised", { run_id: ctx.runId, format: g.format, output_id: g.outputId, input_tokens: inputTokens, output_tokens: outputTokens });
      return { ok: true, data: out };
    }

    const { data, error } = await service
      .from("outputs")
      .insert({
        source_id: g.sourceId,
        user_id: ctx.userId,
        format: g.format,
        content
      })
      .select("id")
      .single();
    if (error) return { ok: false, data: null, error: error.message };

    const out: GenerationOutput = { format: g.format, content, outputId: data.id, revised: false, inputTokens, outputTokens };
    log.info("agent.generation_ok", { run_id: ctx.runId, format: g.format, output_id: data.id, input_tokens: inputTokens, output_tokens: outputTokens });
    return { ok: true, data: out };
  }
};