// The tool registry. Every tool the agent can call is enumerated here so the
// orchestrator can (a) filter by the run's mode, (b) persist a description in
// the run's step timeline, and (c) fail loudly when a mode tries something it
// isn't allowed to (see lib/agent/permissions.ts).

import type { AgentTool, AgentStepKind, AgentMode } from "@/types/agent";
import { toolAllowedForMode } from "@/lib/agent/permissions";
import { sourceTool } from "./source";
import { intelligenceTool } from "./intelligence";
import { memoryTool } from "./memory";
import { generationTool } from "./generation";
import { reviewTool } from "./review";
import { distributionTool } from "./distribution";
import { strategyTool } from "./strategy";

export const TOOLS: AgentTool[] = [
  sourceTool,
  intelligenceTool,
  memoryTool,
  generationTool,
  reviewTool,
  distributionTool,
  strategyTool
];

const BY_NAME = new Map<string, AgentTool>(TOOLS.map((t) => [t.name, t]));
const BY_KIND = new Map<AgentStepKind, AgentTool[]>();
for (const tool of TOOLS) {
  BY_KIND.set(tool.kind, [...(BY_KIND.get(tool.kind) ?? []), tool]);
}

export function getTool(name: string): AgentTool | undefined {
  return BY_NAME.get(name);
}

export function toolsForMode(mode: AgentMode): AgentTool[] {
  return TOOLS.filter((t) => toolAllowedForMode([t.kind], mode));
}

export function toolByKind(kind: AgentStepKind): AgentTool | undefined {
  return BY_KIND.get(kind)?.[0];
}