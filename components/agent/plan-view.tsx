"use client";

import { useState } from "react";
import { Card, CardHeader } from "@/components/card";
import type { ContentPlan } from "@/types/agent";

// The Stage 1 human gate: the user sees the planner's proposed angles and
// decides which survive before any generation runs. This is the assist-mode
// approval surface — nothing executes until this is submitted.

interface IdeaRow {
  id: string;
  title: string;
  description: string | null;
  suggested_formats: string[];
  quotes: string[] | null;
  rationale: string | null;
  approved: boolean;
  evaluation?: {
    score?: number;
    weakness?: string | null;
  } | null;
}

export default function PlanView({
  plan,
  ideas,
  submitting,
  onApprove,
  onReject
}: {
  plan: ContentPlan | null;
  ideas: IdeaRow[];
  submitting: boolean;
  onApprove: (decisions: { id: string; approved: boolean }[]) => void;
  onReject: () => void;
}) {
  const [checks, setChecks] = useState<Record<string, boolean>>(
    Object.fromEntries(ideas.map((i) => [i.id, i.approved]))
  );

  const anyChecked = Object.values(checks).some(Boolean);

  return (
    <Card>
      <CardHeader
        title="Content plan"
        description={plan?.summary ?? "The planner produced these angles from the transcript."}
      />

      <ul className="divide-y divide-theme-divider">
        {ideas.map((idea, index) => (
          <li key={idea.id} className="flex gap-4 px-5 py-4">
            <label className="mt-1 flex cursor-pointer items-center">
              <input
                type="checkbox"
                checked={checks[idea.id] ?? false}
                onChange={(e) => setChecks((prev) => ({ ...prev, [idea.id]: e.target.checked }))}
                className="size-4 accent-primary-500"
                aria-label={`Approve angle: ${idea.title}`}
              />
            </label>

            <div className="min-w-0">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="text-xs font-medium text-theme-text-secondary">#{index + 1}</span>
                <h3 className="font-display text-sm font-semibold">{idea.title}</h3>
              </div>
              {idea.description && <p className="mt-1 text-sm text-theme-text-secondary">{idea.description}</p>}

              <div className="mt-2 flex flex-wrap items-center gap-2">
                {idea.suggested_formats.map((fmt) => (
                  <span key={fmt} className="badge bg-primary-100 text-primary-500">
                    {fmt.replace(/_/g, " ")}
                  </span>
                ))}
                {idea.quotes?.slice(0, 1).map((quote) => (
                  <span key={quote} className="badge bg-neutral-100 text-neutral-500" title={quote}>
                    “{quote.slice(0, 60)}…”
                  </span>
                ))}
              </div>

              {idea.rationale && (
                <p className="mt-2 text-xs text-theme-text-secondary">Why: {idea.rationale}</p>
              )}

              {idea.evaluation && typeof idea.evaluation.score === "number" && (
                <p className="mt-1 text-xs text-theme-text-secondary">
                  Score {Math.round(idea.evaluation.score * 100)}%
                  {idea.evaluation.weakness && <span className="text-amber-600"> · {idea.evaluation.weakness}</span>}
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-theme-divider px-5 py-4">
        <p className="text-xs text-theme-text-secondary">
          Drafts are generated only for approved angles. In execute mode a flagged draft gets one bounded
          revision.
        </p>
        <div className="flex gap-2">
          <button type="button" onClick={onReject} disabled={submitting} className="btn text-sm">
            Reject all
          </button>
          <button
            type="button"
            onClick={() => onApprove(ideas.map((i) => ({ id: i.id, approved: checks[i.id] ?? false })))}
            disabled={submitting || !anyChecked}
            className="btn btn-primary text-sm disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Approving…" : "Approve selected"}
          </button>
        </div>
      </div>
    </Card>
  );
}