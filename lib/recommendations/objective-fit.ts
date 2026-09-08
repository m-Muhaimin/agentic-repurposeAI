// Phase 6: Deterministic objective-fit mapping.
// Maps each objective to an output-fit rating per registered output ID.
// No LLM. Numeric values: strong=0.9, good=0.6, possible=0.3, not_recommended=0.

import type { Objective, ObjectiveFit } from "./types";

type FitRating = "strong" | "good" | "possible" | "not_recommended";

const FIT_VALUE: Record<FitRating, number> = {
  strong: 0.9,
  good: 0.6,
  possible: 0.3,
  not_recommended: 0,
};

// Every objective carries a mapping of outputId → { fit, reason }.
// The output IDs here are the canonical ones registered in the Output Registry
// (lib/output-registry/definitions.ts: linkedin_post, newsletter, shortform_script).
// If a new output is added, add its row here too — this is intentionally explicit
// rather than auto-derived, so each objective's rationale is written by hand.

const MAP: Record<Objective["kind"], Record<string, { fit: FitRating; reason: string }>> = {
  grow_linkedin: {
    linkedin_post: {
      fit: "strong",
      reason: "Built for LinkedIn's algorithm and your profile",
    },
    shortform_script: {
      fit: "good",
      reason: "Short clips drive profile visits",
    },
    newsletter: {
      fit: "possible",
      reason: "Email list helps, but indirect for LinkedIn growth",
    },
  },

  grow_email: {
    newsletter: {
      fit: "strong",
      reason: "Your newsletter is your email list engine",
    },
    linkedin_post: {
      fit: "good",
      reason: "Profile traffic converts to subscribers",
    },
    shortform_script: {
      fit: "possible",
      reason: "Indirect — drives awareness, not subscribers directly",
    },
  },

  get_reach: {
    shortform_script: {
      fit: "strong",
      reason: "Short-form reaches new audiences fastest",
    },
    linkedin_post: {
      fit: "strong",
      reason: "LinkedIn's algorithm rewards consistent posting",
    },
    newsletter: {
      fit: "possible",
      reason: "Reach is limited to your list",
    },
  },

  clarify_ideas: {
    newsletter: {
      fit: "strong",
      reason: "Longer format lets you develop ideas fully",
    },
    linkedin_post: {
      fit: "good",
      reason: "Forces clarity in short form",
    },
    shortform_script: {
      fit: "possible",
      reason: "Too compressed for deep clarification",
    },
  },

  drive_action: {
    linkedin_post: {
      fit: "strong",
      reason: "Call-to-action posts drive profile engagement",
    },
    newsletter: {
      fit: "strong",
      reason: "Direct line to people who want to act",
    },
    shortform_script: {
      fit: "good",
      reason: "Hook + payoff can drive profile visits",
    },
  },
};

// ── public API ────────────────────────────────────────────────────────────────

/**
 * Returns the objective-fit rating for a given objective and output ID.
 * Returns `not_recommended` with a generic reason for unknown output IDs
 * (graceful degradation, not a crash).
 */
export function objectiveFitForObjective(
  objective: Objective,
  outputId: string
): ObjectiveFit {
  const mapping = MAP[objective.kind];
  if (!mapping) {
    // Unknown objective kind — treat everything as not recommended.
    return {
      outputId,
      fit: "not_recommended",
      reason: "Objective not recognized",
    };
  }

  const entry = mapping[outputId];
  if (!entry) {
    return {
      outputId,
      fit: "not_recommended",
      reason: `No fit mapping for this output`,
    };
  }

  return {
    outputId,
    fit: entry.fit,
    reason: entry.reason,
  };
}

/**
 * Numeric objective-fit value (0..1) for a given objective and output ID.
 */
export function objectiveFitValue(objective: Objective, outputId: string): number {
  return FIT_VALUE[objectiveFitForObjective(objective, outputId).fit];
}
