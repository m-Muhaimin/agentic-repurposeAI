"use client";

import { useRouter } from "next/navigation";
import type { AgentMode } from "@/types/agent";
import OpportunityFeed from "./opportunity-feed";

// Hooks OpportunityFeed's "create from recommendation" action to the workspace:
// a recommendation pushes a deep link that pre-selects the source (and the
// chosen autonomy mode) on /agent, where the human approves before anything runs.

export default function InsightLauncher() {
  const router = useRouter();

  return (
    <OpportunityFeed
      onStartRun={(sourceId, mode: AgentMode) =>
        router.push(`/agent?source=${encodeURIComponent(sourceId)}&mode=${encodeURIComponent(mode)}`)
      }
    />
  );
}