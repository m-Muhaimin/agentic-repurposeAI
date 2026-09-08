import AppShell from "@/components/app-shell";
import PageHeader from "@/components/page-header";
import ObservePanel from "@/components/agent/observe-panel";
import PublishQueuePanel from "@/components/agent/publish-queue-panel";
import ScalePanel from "@/components/agent/scale-panel";

export const dynamic = "force-dynamic";

// Observe: publish queue (P10) + insights (P11) + scale overview (P13).
// Read-mostly, honest data only. Nothing on this page publishes while channels
// are disconnected.
export default function ObservePage() {
  return (
    <AppShell>
      <div className="workspace py-8 lg:py-10">
        <PageHeader
          title="Observe"
          description="Your publish queue, insights and scale overview — computed from real data, with publishing awaiting your explicit approval."
        />
        <div className="grid gap-6 lg:grid-cols-2">
          <PublishQueuePanel />
          <div className="space-y-6">
            <ObservePanel />
            <ScalePanel />
          </div>
        </div>
      </div>
    </AppShell>
  );
}