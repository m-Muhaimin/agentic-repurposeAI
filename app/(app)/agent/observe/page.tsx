import PageHeader from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { getAgentContext } from "@/lib/agent/context";
import AgentContextStrip from "@/components/agent/agent-context-strip";
import InsightLauncher from "@/components/agent/insight-launcher";
import ObservePanel from "@/components/agent/observe-panel";
import ScalePanel from "@/components/agent/scale-panel";

export const dynamic = "force-dynamic";

// AI insights: what the agent knows, what to work on next (real strategy
// recommendations), run/step/spend transparency (ObservePanel), and the
// permission-model scale overview (ScalePanel). Publish lives on /publish.

export default async function ObservePage() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  const context = await getAgentContext(user?.id ?? "");

  return (
    <div className="workspace py-8 lg:py-10">
      <PageHeader
        title="AI insights"
        description="What VervAI knows, what to work on next, real run and spend data — plus how much your agent is allowed to do on its own."
      />
      <div className="grid items-start gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <InsightLauncher />
          <ObservePanel />
        </div>
        <div className="space-y-6">
          <AgentContextStrip context={context} />
          <ScalePanel />
        </div>
      </div>
    </div>
  );
}