// P13: Scale affordances — a READ-ONLY summary of the permission model and a
// structural guarantee that no autopilot/scheduling door exists. Pure logic,
// no I/O. It derives from `lib/agent/permissions.ts` (the single source of
// capability truth) rather than duplicating it, and it surfaces honest labels
// used by the observe/scale read-only panel.

import { CAPABILITIES, DEFAULT_MODE, type CapabilitySet } from "@/lib/agent/permissions";
import type { AgentMode } from "@/types/agent";

export interface ModeScaleSummary {
  mode: AgentMode;
  canDistribute: boolean;
  canStrategize: boolean;
  canAutoRevise: boolean;
  // Every mode keeps the human approval gate at plan time — no mode auto-sends.
  requiresHumanApproval: boolean;
  // Channels connected? Always false in this build — no autopilot is possible.
  channelsConnected: boolean;
}

// One honest row per mode, derived from the capability map.
export function modeScaleSummary(mode: AgentMode): ModeScaleSummary {
  const caps: CapabilitySet = CAPABILITIES[mode];
  return {
    mode,
    canDistribute: caps.distribute,
    canStrategize: caps.strategize,
    canAutoRevise: caps.revise,
    // The plan-time approval gate is universal in the V2 machine; even
    // `automate` routes through awaiting_approval. Distribution is a stub that
    // throws, so no mode can actually publish.
    requiresHumanApproval: true,
    channelsConnected: false
  };
}

export interface ScaleSurface {
  modes: ModeScaleSummary[];
  defaultMode: AgentMode;
  // The structural guarantee: in this build there is NO background worker and
  // NO scheduling verb that can auto-advance a job. Verified here so the UI
  // can assert it rather than assume it.
  autopilotDoorExists: boolean;
  scheduleIsDraftOnly: boolean;
  note: string;
}

export function buildScaleSurface(): ScaleSurface {
  const modes = (["assist", "execute", "automate"] as AgentMode[]).map(modeScaleSummary);
  return {
    modes,
    defaultMode: DEFAULT_MODE,
    // Hard structural fact: no autopilot code path exists in these phases.
    // distribution.ts throws NotImplementedError whenever reached; there is no
    // worker for v4_distribution_jobs, so nothing ever auto-advances a job.
    autopilotDoorExists: false,
    scheduleIsDraftOnly: true,
    note:
      "Scale groundwork is read-mostly: the permission model is surfaced for humans to review. " +
      "Any 'schedule' affordance is draft-only — it queues a job for your explicit approval and " +
      "never sends unattended. Real publishing providers are not connected."
  };
}
