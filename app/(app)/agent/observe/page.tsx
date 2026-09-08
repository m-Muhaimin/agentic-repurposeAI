import PageHeader from "@/components/page-header";
import ObservePanel from "@/components/agent/observe-panel";
import ScalePanel from "@/components/agent/scale-panel";

export const dynamic = "force-dynamic";

// Insights: run/step/spend transparency (ObservePanel) + the permission-model
// scale overview (ScalePanel). Publish lives on its own /publish page.
export default function ObservePage() {
  return (
    <div className="workspace py-8 lg:py-10">
      <PageHeader
        title="Insights"
        description="Real run, step and spend data from your agent workspace — plus how much your agent is allowed to do on its own."
      />
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <ObservePanel />
        <div className="space-y-6">
          <ScalePanel />
        </div>
      </div>
    </div>
  );
}