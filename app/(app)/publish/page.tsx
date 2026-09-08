import PageHeader from "@/components/page-header";
import PublishQueuePanel from "@/components/agent/publish-queue-panel";

export const dynamic = "force-dynamic";

// Publish: the queue of publishable drafts awaiting the user's explicit
// approval. Read-mostly + manual approval — nothing sends while a publishing
// channel is disconnected, and no fake success is shown.
export default function PublishPage() {
  return (
    <div className="workspace py-8 lg:py-10">
      <PageHeader
        title="Publish"
        description="Drafts ready to go out, queued for your approval — you stay in control of every send."
      />
      <div className="grid items-start gap-6 lg:grid-cols-3">
        <div className="lg:col-span-3">
          <PublishQueuePanel />
        </div>
      </div>
    </div>
  );
}