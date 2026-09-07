// Tool: review. Deterministic evaluation + bounded single-revision payload.
// This tool NEVER loops: it scores a draft with the rubric, and if the draft is
// weak it produces exactly ONE revision instruction for the generation tool to
// apply. A second weak result stays flagged — no infinite revise loop.

import { evaluateDraft, revisionInstruction } from "@/lib/agent/evaluator";
import { CAPABILITIES } from "@/lib/agent/permissions";
import { log } from "@/lib/logger";
import type { AgentTool, ToolContext, ToolResult, OutputFormat } from "@/types/agent";

export interface ReviewInput {
  format: OutputFormat;
  content: string;
  transcript: string;
  // Set when this is already a revision (bounded to one pass).
  isRevision?: boolean;
}

export interface ReviewOutput {
  evaluation: {
    score: number;
    flags: string[];
    weak: boolean;
    notes: string[];
  };
  revisionInstruction: string; // empty when the draft is fine or already revised
  canRevise: boolean;
}

export const reviewTool: AgentTool = {
  name: "review",
  kind: "review",
  label: "Evaluate draft",
  requires: ["assist", "execute", "automate"],
  describe: () => "Rubric evaluation + one bounded revision instruction for weak drafts.",
  async run(ctx: ToolContext, input: unknown): Promise<ToolResult> {
    const { format, content, transcript, isRevision } = (input ?? {}) as ReviewInput;
    if (!format || !content || !transcript) {
      return { ok: false, data: null, error: "format, content and transcript required" };
    }

    const evaluation = evaluateDraft(format, content, transcript);
    const canRevise = CAPABILITIES[ctx.mode].revise && !isRevision && evaluation.weak;

    const out: ReviewOutput = {
      evaluation: {
        score: evaluation.score,
        flags: evaluation.flags,
        weak: evaluation.weak,
        notes: evaluation.notes
      },
      revisionInstruction: canRevise ? revisionInstruction(evaluation.flags) : "",
      canRevise
    };

    log.info("agent.review", {
      run_id: ctx.runId,
      format,
      score: evaluation.score,
      weak: evaluation.weak,
      revises: canRevise
    });

    return { ok: true, data: out };
  }
};