"use client";

import { useState } from "react";
import { Card, CardHeader } from "@/components/card";
import type { ContentPlan } from "@/types/agent";
import { FORMAT_LABEL } from "@/lib/agent/strategy-panel-helpers";
import { opportunityTag } from "@/lib/agent/plan-presentation";

// The Stage 1 human gate (P0 rework): each proposed angle is an opportunity
// card carrying strategy ("High opportunity", why, evidence from the
// transcript) beside the keep/skip call — not a bare checkbox row. Nothing
// executes until the plan is approved at the card level.

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
  onApprove: (decisions: { id: string; approved: boolean; title?: string; description?: string }[]) => void;
  onReject: () => void;
}) {
  const [checks, setChecks] = useState<Record<string, boolean>>(
    Object.fromEntries(ideas.map((i) => [i.id, i.approved]))
  );
  const [editing, setEditing] = useState<Record<string, boolean>>({});
  const [titleDrafts, setTitleDrafts] = useState<Record<string, string>>({});
  const [descDrafts, setDescDrafts] = useState<Record<string, string>>({});

  const kept = Object.values(checks).filter(Boolean).length;

  function decide(idea: IdeaRow, approved: boolean) {
    setChecks((prev) => ({ ...prev, [idea.id]: approved }));
  }

  function toggleEdit(idea: IdeaRow) {
    setEditing((prev) => {
      const next = { ...prev, [idea.id]: !prev[idea.id] };
      if (next[idea.id]) {
        setTitleDrafts((t) => ({ ...t, [idea.id]: idea.title }));
        setDescDrafts((d) => ({ ...d, [idea.id]: idea.description ?? "" }));
      }
      return next;
    });
  }

  const decisions = ideas.map((idea) => {
    const d: { id: string; approved: boolean; title?: string; description?: string } = {
      id: idea.id,
      approved: checks[idea.id] ?? false
    };
    // Only persist edits the user actually changed — the API is additive.
    const title = titleDrafts[idea.id];
    const desc = descDrafts[idea.id];
    if (editing[idea.id] && typeof title === "string" && title.trim() !== idea.title) {
      d.title = title.trim();
    }
    if (editing[idea.id] && typeof desc === "string" && desc.trim() !== (idea.description ?? "")) {
      d.description = desc.trim();
    }
    return d;
  });

  return (
    <Card>
      <CardHeader
        title="Content plan"
        description={
          plan?.summary ??
          "The planner produced these angles from the transcript. Keep the ones that are worth writing."
        }
      />

      <ul className="divide-y divide-theme-divider">
        {ideas.map((idea) => {
          const tag = opportunityTag(idea.evaluation?.score);
          const quotes = idea.quotes ?? [];
          return (
            <li key={idea.id} className="px-5 py-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`badge ${
                      tag.tone === "high"
                        ? "bg-amber-50 text-amber-700"
                        : tag.tone === "strong"
                          ? "bg-primary-100 text-primary-500"
                          : "bg-neutral-100 text-neutral-500"
                    }`}
                  >
                    {tag.label}
                  </span>
                  {typeof idea.evaluation?.score === "number" && (
                    <span className="text-xs text-theme-text-secondary">
                      {Math.round(idea.evaluation.score * 100)}% fit with your content
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => toggleEdit(idea)}
                    className={`text-xs font-medium ${editing[idea.id] ? "text-theme-text-primary" : "text-theme-text-secondary hover:text-theme-text-primary"}`}
                  >
                    {editing[idea.id] ? "Editing…" : "Edit"}
                  </button>
                  <button
                    type="button"
                    onClick={() => decide(idea, true)}
                    className={`btn px-2 py-1 text-xs ${checks[idea.id] ? "btn-primary" : ""}`}
                    aria-pressed={Boolean(checks[idea.id])}
                  >
                    Keep
                  </button>
                  <button
                    type="button"
                    onClick={() => decide(idea, false)}
                    className={`text-xs font-medium ${!checks[idea.id] ? "text-theme-text-primary" : "text-theme-text-secondary hover:text-theme-text-primary"}`}
                    aria-pressed={!checks[idea.id]}
                  >
                    Skip
                  </button>
                </div>
              </div>

              {editing[idea.id] ? (
                <div className="mt-3 space-y-2">
                  <input
                    value={titleDrafts[idea.id] ?? idea.title}
                    onChange={(e) => setTitleDrafts((t) => ({ ...t, [idea.id]: e.target.value }))}
                    className="w-full rounded-lg border border-theme-divider bg-theme-bg-paper px-3 py-2 text-sm font-medium"
                    aria-label="Angle title"
                  />
                  <textarea
                    rows={3}
                    value={descDrafts[idea.id] ?? idea.description ?? ""}
                    onChange={(e) => setDescDrafts((d) => ({ ...d, [idea.id]: e.target.value }))}
                    className="w-full rounded-lg border border-theme-divider bg-theme-bg-paper px-3 py-2 text-sm"
                    aria-label="Angle description"
                  />
                </div>
              ) : (
                <>
                  <h3 className="mt-2 font-display text-sm font-semibold">{idea.title}</h3>
                  {idea.description && <p className="mt-1 text-sm text-theme-text-secondary">{idea.description}</p>}
                </>
              )}

              <div className="mt-2 flex flex-wrap items-center gap-2">
                {idea.suggested_formats.map((fmt) => (
                  <span key={fmt} className="badge bg-primary-100 text-primary-500">
                    {FORMAT_LABEL[fmt as keyof typeof FORMAT_LABEL] ?? fmt.replace(/_/g, " ")}
                  </span>
                ))}
              </div>

              {idea.rationale && (
                <p className="mt-2 text-xs text-theme-text-secondary">
                  <span className="font-medium">Why this:</span> {idea.rationale}
                </p>
              )}

              {quotes.length > 0 && (
                <div className="mt-2 space-y-1">
                  {quotes.slice(0, 2).map((quote) => (
                    <p key={quote} className="text-xs text-theme-text-secondary">
                      “{quote}” <span className="italic">— from your transcript</span>
                    </p>
                  ))}
                </div>
              )}

              {idea.evaluation?.weakness && (
                <p className="mt-2 text-xs text-amber-600">{idea.evaluation.weakness}</p>
              )}
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-theme-divider px-5 py-4">
        <p className="text-xs text-theme-text-secondary">
          Drafts are generated only for the angles you keep. In “Do it with my approval” mode a flagged
          draft gets one bounded revision.
        </p>
        <div className="flex gap-2">
          <button type="button" onClick={onReject} disabled={submitting} className="btn text-sm">
            Reject plan
          </button>
          <button
            type="button"
            onClick={() => onApprove(decisions)}
            disabled={submitting || kept === 0}
            className="btn btn-primary text-sm disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Approving…" : `Approve plan${kept > 0 ? ` (${kept})` : ""}`}
          </button>
        </div>
      </div>
    </Card>
  );
}