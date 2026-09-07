// Plans & entitlements configuration. Pure module (no Node/Supabase imports) so
// both server routes and client components can read limits from one place.
// Pricing is CONFIG here — the app never hard-codes a limit or a price, and new
// tiers slot in without touching the routes that enforce them.
//
// Only `isPublic` plans are shown in any UI. The paid (creator/pro/studio)
// tiers exist so enforcement code paths are exercised and future launch is a
// config flip, but their price stays out of the marketing site until launch.

export type PlanId = "beta" | "creator" | "pro" | "studio";
export type OutputFormat = "linkedin_post" | "newsletter" | "shortform_script";

export const OUTPUT_FORMATS: readonly OutputFormat[] = [
  "linkedin_post",
  "newsletter",
  "shortform_script"
];

export function isOutputFormat(value: unknown): value is OutputFormat {
  return (OUTPUT_FORMATS as readonly unknown[]).includes(value);
}

export interface PlanLimits {
  // Reserve-counted: one per /api/repurpose enqueue. null = unlimited.
  maxJobsPerMonth: number | null;
  // Longest accepted recording, minutes. Enforced server-side after ingestion
  // via TranscriptDocument.durationSeconds (the actual media duration).
  maxInputMinutes: number;
  // Formats generated per job, and therefore the max the enqueue API accepts.
  maxOutputsPerJob: number;
  // Regeneration calls per output row.
  maxRegenerationsPerJob: number;
  // Agentic run budgets (P2). Snapshotted onto each v4_agent_runs row at
  // creation and enforced by the orchestrator — a hit parks the run with any
  // completed drafts kept. Values are config so tiers slot in without touching
  // the guards.
  agent: {
    // Max durable step rows (tool calls) budgeted for one run. Excel helps:
    // each angle × format costs 2 (generate + review), up to 4 with a revision
    // pass. This ceiling is what makes "no unbounded agent loops" enforceable.
    maxSteps: number;
    // Max accumulated cost-units per run (planning token counts are real; the
    // generation estimate is coarse — see orchestrator).
    maxCostUnits: number;
    // Max wall-clock runtime an execution phase may take, seconds. Guards
    // against a run that says executing without progressing.
    maxRuntimeSeconds: number;
  };
}

export interface Plan {
  id: PlanId;
  name: string;
  tagline: string;
  // What users see; paid tiers keep prices internal until launch.
  displayPrice: string;
  monthPriceUsd: number | null;
  isPublic: boolean;
  available: boolean;
  limits: PlanLimits;
  includes: string[];
}

export const PLANS: Record<PlanId, Plan> = {
  beta: {
    id: "beta",
    name: "Beta",
    tagline: "Free while we validate — enough to see if repurposing works for your content.",
    displayPrice: "Free",
    monthPriceUsd: 0,
    isPublic: true,
    available: true,
    limits: {
      maxJobsPerMonth: 5,
      maxInputMinutes: 30,
      maxOutputsPerJob: 3,
      maxRegenerationsPerJob: 2,
      agent: {
        maxSteps: 50,
        maxCostUnits: 2500,
        maxRuntimeSeconds: 1800
      }
    },
    includes: [
      "5 repurpose jobs / month",
      "Up to 30 minutes per recording",
      "3 outputs per job (LinkedIn, newsletter, short-form)",
      "Brand Voice + repurpose prompts",
      "Connect one YouTube channel",
      "Uploads, direct transcripts & captions",
      "Content Library, copy & export"
    ]
  },
  creator: {
    id: "creator",
    name: "Creator",
    tagline: "For solo creators publishing weekly.",
    displayPrice: "$19/mo",
    monthPriceUsd: 19,
    isPublic: true,
    available: true,
    limits: {
      maxJobsPerMonth: 20,
      maxInputMinutes: 60,
      maxOutputsPerJob: 5,
      maxRegenerationsPerJob: 5,
      agent: {
        maxSteps: 60,
        maxCostUnits: 5000,
        maxRuntimeSeconds: 2700
      }
    },
    includes: [
      "Everything in Beta",
      "20 jobs / month",
      "Up to 1 hour per recording",
      "Priority rendering",
      "Email support"
    ]
  },
  pro: {
    id: "pro",
    name: "Pro",
    tagline: "For teams and multi-format channels.",
    displayPrice: "$49/mo",
    monthPriceUsd: 49,
    isPublic: true,
    available: true,
    limits: {
      maxJobsPerMonth: 75,
      maxInputMinutes: 180,
      maxOutputsPerJob: 6,
      maxRegenerationsPerJob: 10,
      agent: {
        maxSteps: 80,
        maxCostUnits: 10000,
        maxRuntimeSeconds: 3600
      }
    },
    includes: [
      "Everything in Creator",
      "75 jobs / month",
      "Up to 3 hours per recording",
      "Team sharing",
      "Analytics",
      "Priority support"
    ]
  },
  studio: {
    id: "studio",
    name: "Studio",
    tagline: "For agencies and production teams.",
    displayPrice: "$99/mo",
    monthPriceUsd: 99,
    isPublic: true,
    available: true,
    limits: {
      maxJobsPerMonth: null,
      maxInputMinutes: 600,
      maxOutputsPerJob: 10,
      maxRegenerationsPerJob: 25,
      agent: {
        maxSteps: 100,
        maxCostUnits: 20000,
        maxRuntimeSeconds: 5400
      }
    },
    includes: [
      "Everything in Pro",
      "Unlimited jobs",
      "Up to 10 hours per recording",
      "3 team seats",
      "API/export access",
      "Dedicated support"
    ]
  }
};

export const BETA_PLAN: Plan = PLANS.beta;

export function getPlan(id: string | null | undefined): Plan {
  if (id && id in PLANS) return PLANS[id as PlanId];
  return BETA_PLAN;
}

// Every public-facing plan (product UI, marketing) derives from this list so
// the site never accidentally renders an unpublished tier.
export function getPublicPlans(): Plan[] {
  return Object.values(PLANS).filter((p) => p.isPublic);
}

// The agentic run budget snapshot, taken server-side at run creation so an
// in-flight run is never re-budgeted by a later plan change. The orchestrator
// reads the snapshotted columns on the run row, not this module.
export function agentBudgetFor(plan: Plan): PlanLimits["agent"] {
  return { ...plan.limits.agent };
}
