import { createClient } from "@/lib/supabase/server";
import PageHeader from "@/components/page-header";
import AgentWorkspace from "@/components/agent/agent-workspace";
import { getAgentContext } from "@/lib/agent/context";
import { AGENT_MODES, type AgentMode } from "@/types/agent";

export const dynamic = "force-dynamic";

type QueryValue = string | string[] | undefined;

function param(v: QueryValue): string | undefined {
  return typeof v === "string" ? v : undefined;
}

function isAgentMode(v: string | undefined): v is AgentMode {
  return Boolean(v && (AGENT_MODES as string[]).includes(v));
}

export default async function AgentPage({
  searchParams
}: {
  searchParams: { goal?: QueryValue; source?: QueryValue; run?: QueryValue; mode?: QueryValue };
}) {
  // Real deep links FROM the dashboard (and recommendations): ?goal= prefills
  // the composer, ?source= preselects a ready source, ?run= loads that run's
  // plan, ?mode= preselects the autonomy mode.
  const initialGoal = param(searchParams?.goal)?.slice(0, 800);
  const initialSourceId = param(searchParams?.source);
  const initialRunId = param(searchParams?.run);
  const initialModeRaw = param(searchParams?.mode);
  const initialMode = isAgentMode(initialModeRaw) ? initialModeRaw : undefined;

  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  // Sources the agent can plan from: ones that already have a transcript
  // (a finished repurpose run produced it). RLS keeps it to this user.
  const { data: sources } = await supabase
    .from("sources")
    .select("id, title, status, created_at")
    .eq("user_id", user!.id)
    .in("status", ["done", "failed"])
    .order("created_at", { ascending: false })
    .limit(100);

  const readySources = (sources ?? []).filter((s) => s.status === "done" || s.status === "failed");

  const context = await getAgentContext(user!.id);

  return (
      <div className="workspace py-8 lg:py-10">
        <PageHeader
          title="VervAI"
          description="Your strategic creation workspace: say what you want, review VervAI's plan, and it drafts the pieces — while anything you create stays under your control."
        />
        <AgentWorkspace
          initialSources={readySources.map((s) => ({
            id: s.id,
            title: s.title ?? "Untitled source",
            status: s.status,
            created_at: s.created_at
          }))}
          defaultSourceId={readySources[0]?.id ?? null}
          initialGoal={initialGoal}
          initialSourceId={initialSourceId}
          initialRunId={initialRunId}
          initialMode={initialMode}
        />
      </div>
  );
}