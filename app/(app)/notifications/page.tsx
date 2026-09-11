import NotificationsPage from "@/components/notifications/notifications-page";

// Minimal server page mirroring app/(app)/library/page.tsx's structure: the
// workspace container lives here, all data fetching happens client-side
// through the shared hook (/api/notifications + Realtime).
export default function NotificationsRoute() {
  return (
    <div className="workspace py-8 lg:py-10">
      <NotificationsPage />
    </div>
  );
}