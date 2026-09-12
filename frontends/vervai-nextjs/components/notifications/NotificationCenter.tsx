"use client";

import { useState } from "react";
import Icon from "@/components/ui/Icon";
import NotificationCard, { type NotificationCardProps } from "./NotificationCard";
import NotificationFilters, { FILTER_TABS } from "./NotificationFilters";
import LiveRelays from "./LiveRelays";
import type { ConnectionsState } from "@/lib/data";

export default function NotificationCenter({
  notifications,
  connections,
}: {
  notifications: NotificationCardProps[];
  connections: ConnectionsState;
}) {
  const [activeFilter, setActiveFilter] = useState("all");
  const [allRead, setAllRead] = useState(false);

  const tabs = FILTER_TABS.map((tab) => ({
    ...tab,
    count:
      tab.id === "all"
        ? notifications.length
        : notifications.filter((n) => n.category === tab.id).length,
  }));

  const visible =
    activeFilter === "all"
      ? notifications
      : notifications.filter((n) => n.category === activeFilter);

  return (
    <aside className="fixed top-14 right-0 bottom-0 w-full sm:w-[540px] sm:max-w-[calc(100vw-16rem)] bg-surface-container-lowest shadow-2xl z-50 flex flex-col justify-between overflow-hidden sm:border-l sm:border-outline-variant/40">
      <div className="bg-surface-container-lowest shrink-0">
        <div className="px-space-lg py-space-md flex items-center justify-between bg-surface-container-lowest">
          <div className="flex items-center gap-space-sm">
            <div className={`w-2.5 h-2.5 rounded-full ${notifications.length ? "bg-primary animate-pulse" : "bg-surface-container-highest"}`}></div>
            <div className="flex flex-col">
              <h2 className="font-headline-md text-headline-md text-on-surface tracking-tight">
                Notifications & Feed
              </h2>
              <span className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider">
                Pipeline Activity
              </span>
            </div>
          </div>
          <div className="flex items-center gap-space-xs">
            <button
              className="text-primary hover:text-on-primary-fixed-variant font-caption-bold text-caption-bold px-space-sm py-1.5 rounded-lg hover:bg-secondary-container/40 transition-colors flex items-center gap-1"
              type="button"
              onClick={() => setAllRead(true)}
            >
              <Icon name="done_all" size={16} />
              <span>{allRead ? "All caught up" : "Mark all as read"}</span>
            </button>
          </div>
        </div>
        <NotificationFilters tabs={tabs} activeId={activeFilter} onChange={setActiveFilter} />
        <div className="h-[1px] w-full bg-surface-container-highest"></div>
      </div>
      <div className="flex-1 overflow-y-auto px-space-lg py-space-md space-y-space-md bg-surface-container-low/40">
        {visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center gap-2">
            <Icon name="inbox" size={28} className="text-outline" />
            <p className="font-body-medium text-body-medium text-on-surface-variant">
              {notifications.length === 0
                ? "No notifications yet. Activity will appear here as your pipeline runs."
                : `No ${activeFilter} notifications.`}
            </p>
          </div>
        ) : (
          visible.map((notification, index) => (
            <NotificationCard key={`${notification.title}-${index}`} {...notification} />
          ))
        )}
      </div>
      <LiveRelays connections={connections} />
    </aside>
  );
}