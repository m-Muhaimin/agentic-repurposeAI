"use client";

// /notifications body: All/Unread toggle, shared hook + shared item component,
// cursor pagination, and the full loading/error/empty grammar. Reflects the
// same row the bell shows — both mount the same useNotifications hook.

import { useState } from "react";
import PageHeader from "@/components/page-header";
import { Card } from "@/components/card";
import SegmentedControl from "@/components/segmented-control";
import EmptyState from "@/components/empty-state";
import { useNotifications } from "./use-notifications";
import NotificationItem, { NotificationSkeletonRow } from "./notification-item";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" }
] as const;
type FilterId = (typeof FILTERS)[number]["id"];

function BellIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-6"
      aria-hidden="true"
    >
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

export default function NotificationsPage() {
  const [filter, setFilter] = useState<FilterId>("all");
  const {
    notifications,
    unreadCount,
    loading,
    error,
    loadingMore,
    hasMore,
    markRead,
    markAllRead,
    loadMore,
    retry
  } = useNotifications({ unreadOnly: filter === "unread" });

  const showFullError = !!error && !loading && notifications.length === 0;

  return (
    <>
      <PageHeader
        title="Notifications"
        description="Alerts when your content is ready or something needs your attention."
        actions={
          <button
            type="button"
            onClick={() => markAllRead()}
            disabled={unreadCount === 0}
            className="btn btn-outline-primary btn-sm disabled:opacity-50"
          >
            Mark all read
          </button>
        }
      />

      <SegmentedControl<FilterId>
        ariaLabel="Filter notifications"
        value={filter}
        onChange={setFilter}
        options={FILTERS.map((f) => ({ id: f.id, label: f.label }))}
      />

      <div className="mt-4" aria-busy={loadingMore}>
        {loading ? (
          <Card>
            <span className="sr-only">Loading notifications…</span>
            <NotificationSkeletonRow />
            <NotificationSkeletonRow />
            <NotificationSkeletonRow />
            <NotificationSkeletonRow />
          </Card>
        ) : showFullError ? (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-6 py-12 text-center"
          >
            <p className="text-sm font-medium text-red-700">{error}</p>
            <button
              type="button"
              onClick={() => retry()}
              className="btn btn-outline-primary btn-sm mt-4"
            >
              Retry
            </button>
          </div>
        ) : notifications.length === 0 ? (
          <EmptyState
            icon={<BellIcon />}
            title={filter === "unread" ? "You're all caught up" : "No notifications yet"}
            description={
              filter === "unread"
                ? "There are no unread notifications right now."
                : "VervAI will let you know when your content is ready."
            }
          />
        ) : (
          <>
            {error && (
              <div
                role="alert"
                className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                <span className="min-w-0">{error}</span>
                <button
                  type="button"
                  onClick={() => retry()}
                  className="btn btn-outline-primary btn-sm shrink-0"
                >
                  Retry
                </button>
              </div>
            )}
            <Card>
              <div className="p-1.5">
                {notifications.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onMarkRead={markRead}
                  />
                ))}
              </div>
            </Card>
            {hasMore && (
              <div className="mt-4 flex justify-center">
                <button
                  type="button"
                  onClick={() => loadMore()}
                  disabled={loadingMore}
                  className="btn btn-outline-primary btn-sm"
                >
                  {loadingMore ? "Loading…" : "Load more"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}