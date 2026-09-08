import PageHeader from "@/components/page-header";
import { Card, CardHeader } from "@/components/card";
import EmptyState from "@/components/empty-state";

// Honest "coming soon" stub (P0): the calendar becomes the calendar once the
// publishing queue exists. Until then it states what's missing instead of
// pretending there's schedule data.

export const dynamic = "force-dynamic";

export default function ContentCalendarPage() {
  return (
    <div className="workspace py-8 lg:py-10">
      <PageHeader
        title="Content calendar"
        description="See what you plan to publish — once a publishing channel is connected."
      />
      <Card>
        <CardHeader title="Calendar" description="Planned for a connected publishing channel — drafts approved by the agent appear here once publishing is wired in." />
        <EmptyState
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-5" aria-hidden="true">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M16 2v4M8 2v4M3 10h18" />
            </svg>
          }
          title="Coming soon"
          description="Connect a publishing channel when you're ready to distribute your work."
        />
      </Card>
    </div>
  );
}