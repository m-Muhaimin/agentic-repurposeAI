import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/app-shell";
import PageHeader from "@/components/page-header";
import AgentWorkspace from "@/components/agent/agent-workspace";
import type { AgentContextData } from "@/components/agent/agent-context-strip";
import { getAgentPreferences } from "@/lib/agent/memory";
import { getConnection } from "@/lib/buffer/connections";

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

  // ── "What your agent knows" — every figure is real and user-scoped. Each
  // lookup fails open to an honest empty value; nothing is invented. ────────
  let libraryDrafts = 0;
  try {
    const { count } = await supabase
      .from("outputs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user!.id);
    libraryDrafts = count ?? 0;
  } catch {
    libraryDrafts = 0;
  }

  let totalSources = (sources ?? []).length;
  try {
    const { count } = await supabase
      .from("sources")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user!.id);
    totalSources = count ?? totalSources;
  } catch {
    // keep the ready-source list length as the honest best effort
  }

  let brandVoiceSet = false;
  try {
    const prefs = await getAgentPreferences(user!.id);
    brandVoiceSet = Boolean(
      prefs?.brand && (prefs.brand.tone?.trim().length > 0 || (prefs.brand.examples?.length ?? 0) > 0)
    );
  } catch {
    brandVoiceSet = false;
  }

  let strategyPlans = 0;
  try {
    const { count } = await supabase
      .from("v4_content_strategies")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user!.id);
    strategyPlans = count ?? 0;
  } catch {
    strategyPlans = 0;
  }

  const readySources = (sources ?? []).filter((s) => s.status === "done" || s.status === "failed");

  // Real publishing channel connection (honest-per-build: stubbed pipeline, so
  // "Connected" means the Buffer OAuth integration exists for the account).
  let publishingConnected = false;
  try {
    publishingConnected = (await getConnection(user!.id)) !== null;
  } catch {
    publishingConnected = false;
  }

  const context: AgentContextData = {
    readySources: readySources.length,
    totalSources,
    libraryDrafts,
    brandVoiceSet,
    strategyPlans,
    publishingConnected
  };

  return (
    <AppShell>
      <div className="workspace py-8 lg:py-10">
        <PageHeader
          title="Agent"
          description="Your content operator: say what you want, review its plan, and it drafts the pieces — while anything famous stays under your control."
        />
        <AgentWorkspace
          initialSources={readySources.map((s) => ({
            id: s.id,
            title: s.title ?? "Untitled source",
            status: s.status,
            created_at: s.created_at
          }))}
          defaultSourceId={readySources[0]?.id ?? null}
          context={context}
        />
      </div>
    </AppShell>
  );
}