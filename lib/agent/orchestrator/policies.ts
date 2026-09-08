// VervAI Orchestrator v1 — policies / permissions.
//
// A slim policy layer on top of types/agent.ts + lib/agent/permissions.ts
// capability sets. It does NOT replace game rules: the agent worker still
// checks real permissions before each tool call. This module only maps a tool
// to a risk class and makes the *orchestration-level* authority decision
// (which risk classes a mode may take autonomously). Gating stays consistent
// with the existing permission model and the hard rule that ALL publishing is
// human-approved.

import type { OrchestrationMode, ToolRisk } from "./types";

// risk class → which modes may act without further human approval.
const AUTONOMOUS_RISK: Record<ToolRisk, ReadonlySet<OrchestrationMode>> = {
  read: new Set(["manual", "assisted", "agent"]),
  write: new Set(["assisted", "agent"]),
  consequential: new Set([]) // NONE — publishing is always human-approved in v1
};

export function riskForTool(toolName: string): ToolRisk {
  const c = toolName.toLowerCase();
  if (/publish|schedule|distribute|send|email.*blast|announce/i.test(c)) {
    return "consequential";
  }
  if (/generate|create|write|insert|update|delete|upsert|save|store/i.test(c)) {
    return "write";
  }
  return "read";
}

/**
 * May `mode` act on a tool of `risk` autonomously (i.e. without an extra human
 * gate)? Consequential actions are NEVER autonomous. Used by the executor to
 * decide whether a step needs human approval before the runtime runs it.
 */
export function mayActAutonomously(mode: OrchestrationMode, risk: ToolRisk): boolean {
  return AUTONOMOUS_RISK[risk].has(mode);
}

/**
 * True when this step type requires a human approval gate under `mode` in v1.
 * Generate is approved in assisted mode (the recommended default); publish is
 * always approved; read/analyze actions in manual mode are not.
 */
export function stepRequiresApproval(
  mode: OrchestrationMode,
  stepType: string
): boolean {
  if (stepType === "publish" || stepType === "schedule") return true;
  if (stepType === "generate") return mode === "assisted";
  if (stepType === "analyze" || stepType === "recommend") return mode === "manual";
  return false;
}
