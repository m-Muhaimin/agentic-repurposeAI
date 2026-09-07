import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/app-shell";
import PageHeader from "@/components/page-header";
import AgentWorkspace from "@/components/agent/agent-workspace";

export const dynamic = "force-dynamic";

export default async function AgentPage() {
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

  return (
    <AppShell>
      <div className="workspace py-8 lg:py-10">
        <PageHeader
          title="Agent"
          description="Plan, generate and evaluate repurposed content from transcripts — with a human approval gate between an idea and a published draft."
        />
        <AgentWorkspace
          initialSources={(sources ?? []).map((s) => ({
            id: s.id,
            title: s.title ?? "Untitled source",
            status: s.status,
            created_at: s.created_at
          }))}
        />
      </div>
    </AppShell>
  );
}