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
}

function stepCounts(steps: TimelineStepInput[], kind: string) {
  let total = 0;
  let ours = 0;
  for (const s of steps) {
    if (!s.kind) continue;
    total += 1;
    if (s.kind === kind) ours += 1;
  }
  return { total, ours };
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
    lines.push({
      id: "review",
      text:
        opts.approvedIdeas > 0
          ? `You kept ${opts.approvedIdeas} of ${Math.max(opts.totalIdeas, opts.approvedIdeas)} angle${opts.approvedIdeas === 1 ? "" : "s"}`
          : "You approved the angles to work on",
      state: "done"
    });
  } else {
    lines.push({ id: "review", text: "Waiting for your review", state: "pending" });
  }

  const drafted = stepCounts(steps, "generation").ours;
  const generating = anyActive(steps, "generation");
  if (opts.status === "executing" || opts.status === "evaluating" || opts.status === "done") {
    lines.push({
      id: "draft",
      text: drafted > 0 ? `Drafted ${drafted} piece${drafted === 1 ? "" : "s"}` : "Writing your drafts",
      state: drafted > 0 ? "done" : generating ? "active" : "pending"
    });
  } else if (opts.status !== "failed" && opts.status !== "cancelled") {
    lines.push({ id: "draft", text: "Writing drafts", state: "pending" });
  }

  const reviewed = anyDone(steps, "review");
  const reviewing = anyActive(steps, "review");
  if (opts.status === "evaluating" || opts.status === "done") {
    lines.push({
      id: "quality",
      text: reviewed ? "Quality review complete" : "Running the quality review",
      state: reviewed ? "done" : reviewing ? "active" : "pending"
    });
  } else if (opts.status !== "failed" && opts.status !== "cancelled") {
    lines.push({ id: "quality", text: "Running the quality review", state: "pending" });
  }

  const distributed = anyDone(steps, "distribution");
  const distributing = anyActive(steps, "distribution");
  lines.push({
    id: "publish",
    text: distributed ? "Sent to your publishing queue" : "Preparing your publishing queue",
    state: distributed ? "done" : distributing ? "active" : "pending"
  });

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