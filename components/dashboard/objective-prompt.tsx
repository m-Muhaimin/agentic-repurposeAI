"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardHeader } from "@/components/card";

// The dashboard's dominant "next action": an objective prompt that hands the
// outcome to the agent. Everything it offers is a REAL route — Create prefills
// /agent?goal=… (the composer picks it up), and the quick tiles mirror the
// shell's own navigation verbs so nothing here is a fake control.

const EXAMPLES = [
  "Build a week of LinkedIn posts about AI automation for founders.",
  "Turn my latest recording into a newsletter section and a short-form script.",
  "Find the best angles in my most recent source and draft the top three."
];

const QUICK_ACTIONS = [
  { href: "/agent", title: "Draft with the agent", detail: "An outcome in, drafts out — you approve the angles." },
  { href: "/upload", title: "Repurpose a recording", detail: "Upload media, a transcript, or a link to repurpose." },
  { href: "/library", title: "See your library", detail: "Sources, their drafts, and processing status." }
];

export default function ObjectivePrompt() {
  const router = useRouter();
  const [goal, setGoal] = useState("");

  function start() {
    router.push(`/agent${goal.trim() ? `?goal=${encodeURIComponent(goal.trim())}` : ""}`);
  }

  return (
    <Card>
      <CardHeader
        title="What should we make this week?"
        description="Tell the agent the outcome you want. It plans angles from your real content, you approve them, and it drafts."
      />
      <div className="px-5 py-4">
        <textarea
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              start();
            }
          }}
          rows={2}
          aria-label="Your goal for the week"
          placeholder="e.g. Build a week of LinkedIn posts about AI automation for founders."
          className="w-full rounded-lg border border-theme-divider bg-theme-bg-paper px-3 py-2 text-sm placeholder:text-theme-text-secondary"
        />
        <div className="mt-2 flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => setGoal(ex)}
              className="rounded-full border border-theme-divider bg-theme-bg-paper px-3 py-1.5 text-xs text-theme-text-secondary transition-colors hover:border-primary-500/40 hover:text-theme-text-primary"
            >
              {ex}
            </button>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={start} className="btn btn-primary">
            Create with the agent
          </button>
          <Link href="/agent" className="btn btn-outline-primary">
            Open the agent
          </Link>
        </div>

        <div className="mt-5 grid gap-3 border-t border-theme-divider pt-5 sm:grid-cols-3">
          {QUICK_ACTIONS.map((a) => (
            <Link
              key={a.href}
              href={a.href}
              className="rounded-lg border border-theme-divider bg-theme-bg-paper p-4 transition-colors hover:border-primary-200"
            >
              <p className="text-sm font-medium text-theme-text-primary">{a.title}</p>
              <p className="mt-1 text-xs text-theme-text-secondary">{a.detail}</p>
            </Link>
          ))}
        </div>
      </div>
    </Card>
  );
}