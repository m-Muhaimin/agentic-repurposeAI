import AppShell from "@/components/app-shell";
import PageHeader from "@/components/page-header";
import { Card, CardHeader } from "@/components/card";
import EmptyState from "@/components/empty-state";

// Honest "coming soon" stub (P0): the calendar becomes the calendar once the
// publishing queue exists. Until then it states what's missing instead of
// pretending there's schedule data.

export const dynamic = "force-dynamic";

export default function ContentCalendarPage() {
  return (
    <AppShell>
      <div className="workspace py-8 lg:py-10">
        <PageHeader
          title="Content calendar"
          description="A weekly view of what you plan to publish — once a publishing channel is connected."
        />
        <Card>
          <CardHeader title="Calendar" description="Planned for a connected publishing channel." />
          <EmptyState
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-5" aria-hidden="true">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <path d="M16 2v4M8 2v4M3 10h18" />
              </svg>
            }
            title="Coming soon"
            description="Start an agent run, approve the angles, and those drafts will appear here once publishing is wired in."
          />
        </Card>
      </div>
    </AppShell>
  );
}