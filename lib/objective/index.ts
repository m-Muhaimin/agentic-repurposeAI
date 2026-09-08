// Objective-first framework: what the creator is trying to accomplish.
//
// An Objective is the strategic lens through which VervAI evaluates content
// and recommends outputs. It is the missing middle layer between raw content
// intelligence and output selection — without it, every piece of content
// looks equally repurposable into every format.
//
// Usage:
//   1. Creator sets or selects an objective (per source, per session, or global).
//   2. Content is analyzed into ContentIntelligence (already exists).
//   3. Intelligence + Objective → ranked, explained output recommendations.

export type ObjectiveId =
  | "grow_linkedin"
  | "grow_email"
  | "get_reach"
  | "clarify_ideas"
  | "drive_action"
  | "entertain"
  | "inform"
  | "build_thinkership";

export interface Objective {
  id: ObjectiveId;
  label: string;
  description: string;
  /** What the creator is ultimately trying to achieve. */
  intent: string;
  /** What "success" looks like for this objective. */
  successSignal: string;
}

/** All registered objectives. Ordered by how commonly a creator picks them. */
export const OBJECTIVES: readonly Objective[] = [
  {
    id: "grow_linkedin",
    label: "Grow my LinkedIn audience",
    description: "Turn insights into posts that earn profile visits and follows.",
    intent: "Grow a professional audience on LinkedIn",
    successSignal: "Profile visits, follower growth, engagement from target audience",
  },
  {
    id: "grow_email",
    label: "Build my email audience",
    description: "Create newsletter sections and lead content that grow a list.",
    intent: "Grow a owned email list",
    successSignal: "New subscribers, open rates, forwards",
  },
  {
    id: "get_reach",
    label: "Get more reach",
    description: "Create content designed to travel beyond your current audience.",
    intent: "Expand how many people see your work",
    successSignal: "Shares, new audience segments, cross-platform discovery",
  },
  {
    id: "clarify_ideas",
    label: "Clarify my ideas",
    description: "Use creation as a thinking tool — force clear articulation.",
    intent: "Sharpen thinking by writing",
    successSignal: "Clarity of expression, reproducibility of the idea",
  },
  {
    id: "drive_action",
    label: "Drive action",
    description: "Create content that moves people to do something specific.",
    intent: "Persuade or mobilize",
    successSignal: "Clicks, sign-ups, responses, purchases, RSVPs",
  },
  {
    id: "entertain",
    label: "Entertain",
    description: "Make people laugh, gasp, or share because it's fun.",
    intent: "Create entertaining content",
    successSignal: "Laughter, reactions, repeat viewership, emotional response",
  },
  {
    id: "inform",
    label: "Inform",
    description: "Deliver useful, accurate information people can act on.",
    intent: "Educate or inform",
    successSignal: "People report learning something, saves, references",
  },
  {
    id: "build_thinkership",
    label: "Build thinkership",
    description: "Establish yourself as a thinker — ideas, frameworks, perspectives.",
    intent: "Build intellectual authority",
    successSignal: "Citations, debate, recognition as a thinker, inbound ideas",
  },
];

/** Look up an objective by ID. */
export function objectiveById(id: ObjectiveId): Objective {
  return OBJECTIVES.find((o) => o.id === id) ?? OBJECTIVES[0];
}

/** Human-friendly label for an objective ID — safe for UI display. */
export function objectiveLabel(id: ObjectiveId): string {
  return objectiveById(id).label;
}
