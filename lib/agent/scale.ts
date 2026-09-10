// P13: Scale affordances — a READ-ONLY summary of the permission model and a
// structural statement of exactly which autopilot doors exist. Pure logic,
// no I/O. It derives from `lib/agent/permissions.ts` (the single source of
// capability truth) rather than duplicating it, and it surfaces honest labels
// used by the observe/scale read-only panel.
//
// Data-aware honesty: the caller supplies whether the Buffer MCP connector is
// configured (per-user API key). With it, `automate` mode really can schedule
// approved drafts into the user's Buffer queue (create_post addToQueue — they
// land in the user's Queue for review in Buffer, never auto-published). Without
// it, scheduling is honestly reported as unavailable.

import { CAPABILITIES, DEFAULT_MODE, type CapabilitySet } from "@/lib/agent/permissions";
import type { AgentMode } from "@/types/agent";

export interface ModeScaleSummary {
  mode: AgentMode;
  canDistribute: boolean;
  canStrategize: boolean;
  canAutoRevise: boolean;
  // Every mode except `automate` parks the plan at awaiting_approval for an
  // explicit human decision. `automate` auto-approves the angles (requirements
  // answered on the user's behalf) — that IS the mode's contract.
  requiresHumanApproval: boolean;
  // Only `automate` + a configured Buffer API key can schedule (MCP connector).
  canSchedule: boolean;
}

// One honest row per mode, derived from the capability map.
export function modeScaleSummary(mode: AgentMode, mcpEnabled = false): ModeScaleSummary {
  const caps: CapabilitySet = CAPABILITIES[mode];
  return {
    mode,
    canDistribute: caps.distribute,
    canStrategize: caps.strategize,
    canAutoRevise: caps.revise,
    requiresHumanApproval: mode !== "automate",
    canSchedule: mode === "automate" && mcpEnabled
  };
}

export interface ScaleSurface {
  modes: ModeScaleSummary[];
  defaultMode: AgentMode;
  // Does an autopilot door exist? True when the Buffer MCP connector is keyed:
  // `automate` can then place posts into the user's real Buffer queue without a
  // per-draft human click. The Queue is still human-owned in Buffer, so that is
  // the honest extent of the door.
  autopilotDoorExists: boolean;
  // When the connector is keyed, scheduling is real (not draft-only).
  scheduleIsDraftOnly: boolean;
  note: string;
}

export function buildScaleSurface(hasMcpApiKey = false): ScaleSurface {
  const modes = (["assist", "execute", "automate"] as AgentMode[]).map((m) => modeScaleSummary(m, hasMcpApiKey));
  return {
    modes,
    defaultMode: DEFAULT_MODE,
    autopilotDoorExists: hasMcpApiKey,
    scheduleIsDraftOnly: !hasMcpApiKey,
    note: hasMcpApiKey
      ? "The Buffer API key is set: automate mode can schedule approved drafts into your Buffer queue via the MCP connector. " +
        "Posts sit in your Queue in Buffer for you to review — VervAI never publishes unattended. Manual 'Send now' from the publish queue still requires a connected Buffer account."
      : "Add a Buffer API key (publish.buffer.com/settings/api) to let automate mode schedule drafts into your Buffer queue. " +
        "Without it, schedule affordances are draft-only and manual publishing requires a connected Buffer account."
  };
}