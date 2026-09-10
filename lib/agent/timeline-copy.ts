// Humanized run narrative (P0): collapse the technical step list into a few
// outcome-bearing lines ("You kept 4 of 6 angles", "Drafted 4 pieces"), while
// the full activity chain stays available behind a disclosure in the UI.

import type { RunStatus } from "@/types/agent";

export type HumanStageState = "done" | "active" | "pending";

export interface HumanStage {
  id: "analyze" | "angles" | "review" | "draft" | "quality" | "publish" | "done";
  text: string;
  state: HumanStageState;
}

export interface TimelineStepInput {
  kind: string;
  status: string;
}

export interface TimelineOpts {
  status: RunStatus;
  totalIdeas: number;
  approvedIdeas: number;
  // Run mode — used to phrase the review/approval lines honestly for automate.
  mode?: "assist" | "execute" | "automate";
}

function anyDone(steps: TimelineStepInput[], kind: string) {
  return steps.some((s) => s.kind === kind && s.status === "done");
}

function anyActive(steps: TimelineStepInput[], kind: string) {
  return steps.some((s) => s.kind === kind && s.status !== "done" && s.status !== "skipped" && s.status !== "failed");
}

export function humanizeTimeline(steps: TimelineStepInput[], opts: TimelineOpts): HumanStage[] {
  const lines: HumanStage[] = [];

  const progress = opts.status === "created" ? "created" : "planning";
  const analyzed =
    progress !== "created" ||
    anyDone(steps, "source") ||
    anyDone(steps, "planning");

  lines.push({
    id: "analyze",
    text: analyzed ? "Understood your source and brand context" : "Analyzing your source",
    state: analyzed ? "done" : "active"
  });

  const angles = opts.status !== "created" && opts.status !== "planning";
  lines.push({
    id: "angles",
    text: angles
      ? `Found ${opts.totalIdeas} strong angle${opts.totalIdeas === 1 ? "" : "s"}`
      : "Finding the strongest angles",
    state: angles ? "done" : "active"
  });

  if (opts.status === "awaiting_approval") {
    lines.push({
      id: "review",
      text: opts.totalIdeas > 0 ? "Ready for your review — keep or skip each angle" : "Ready for your review",
      state: "active"
    });
  } else if (opts.status === "cancelled") {
    lines.push({
      id: "review",
      text: "Review closed — completed work is kept",
      state: "pending"
    });
  } else if (opts.status !== "created" && opts.status !== "planning") {
    const automated = opts.mode === "automate";
    lines.push({
      id: "review",
      text: automated
        ? opts.approvedIdeas > 0
          ? `Approved ${opts.approvedIdeas} of ${Math.max(opts.totalIdeas, opts.approvedIdeas)} angle${opts.approvedIdeas === 1 ? "" : "s"} automatically (automate)`
          : "Angles auto-approved (automate)"
        : opts.approvedIdeas > 0
          ? `You kept ${opts.approvedIdeas} of ${Math.max(opts.totalIdeas, opts.approvedIdeas)} angle${opts.approvedIdeas === 1 ? "" : "s"}`
          : "You approved the angles to work on",
      state: "done"
    });
  } else {
    lines.push({ id: "review", text: "Waiting for your review", state: "pending" });
  }

  const generationSteps = steps.filter((s) => s.kind === "generation");
  const drafted = generationSteps.filter((s) => s.status === "done").length;
  const generating = generationSteps.some((s) => s.status !== "done" && s.status !== "skipped" && s.status !== "failed");
  const reachedExecution = opts.status === "executing" || opts.status === "evaluating" || opts.status === "done";
  if (reachedExecution || (generating && opts.status !== "failed" && opts.status !== "cancelled")) {
    lines.push({
      id: "draft",
      text: drafted > 0 ? `Drafted ${drafted} piece${drafted === 1 ? "" : "s"}` : "Writing your drafts",
      state: drafted > 0 ? "done" : generating ? "active" : "pending"
    });
  }

  const reviewSteps = steps.filter((s) => s.kind === "review");
  const reviewed = reviewSteps.some((s) => s.status === "done");
  const reviewing = reviewSteps.some((s) => s.status !== "done" && s.status !== "skipped" && s.status !== "failed");
  const reachedReview = opts.status === "evaluating" || opts.status === "done";
  if (reachedReview || ((reviewing || reviewed) && opts.status !== "failed" && opts.status !== "cancelled")) {
    lines.push({
      id: "quality",
      text: reviewed ? "Quality review complete" : "Running the quality review",
      state: reviewed ? "done" : reviewing ? "active" : "pending"
    });
  }

  // Publishing is not part of the run itself — it's a separate, human-gated
  // queue. So this stage only appears when a distribution step actually
  // exists; it never renders as an always-gray "upcoming" line.
  const distributed = anyDone(steps, "distribution");
  const distributing = anyActive(steps, "distribution");
  if (distributed || distributing) {
    const automated = opts.mode === "automate";
    lines.push({
      id: "publish",
      text: distributed
        ? automated
          ? "Scheduled your drafts into the Buffer queue"
          : "Sent to your publishing queue"
        : "Preparing your publishing queue",
      state: distributed ? "done" : "active"
    });
  }

  if (opts.status === "done") {
    lines.push({
      id: "done",
      text: "Ready — drafts are saved in your library",
      state: "done"
    });
  } else if (opts.status === "failed") {
    lines.push({ id: "done", text: "Stopped early — see the details below", state: "pending" });
  }

  return lines;
}