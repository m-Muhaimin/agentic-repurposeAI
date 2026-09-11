"use client";

// Header bell + dropdown, hand-rolled on the exact user-menu pattern: relative
// wrapper + rootRef, outside-mousedown + Escape close, close on navigation,
// animate-fade-in panel. Renders the shared hook's first page; the footer's
// "View all" is the only entry to /notifications — the sidebar stays
// deliberately curated (no nav-item addition).

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useNotifications } from "./use-notifications";
import NotificationItem, { NotificationSkeletonRow } from "./notification-item";

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const { notifications, unreadCount, loading, error, markRead, markAllRead } = useNotifications();

  // Close on navigation.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Outside click + Escape.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  // Keep focus inside the panel: land on the first notification item when it
  // opens; on an empty/loading panel fall back to the footer's "View all".
  useEffect(() => {
    if (!open) return;
    const first = listRef.current?.querySelector<HTMLElement>("a[href], button");
    if (first) {
      first.focus();
      return;
    }
    const focusables = panelRef.current?.querySelectorAll<HTMLElement>("a[href], button");
    if (focusables && focusables.length > 0) {
      focusables[focusables.length - 1].focus();
    }
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="notifications-menu"
        onClick={() => setOpen((v) => !v)}
        className="relative flex min-h-[34px] items-center justify-center rounded-full border border-theme-divider bg-theme-bg-paper text-theme-text-secondary transition-colors hover:bg-primary-500/[0.04] hover:text-theme-text-primary"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-5"
          aria-hidden="true"
        >
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {unreadCount > 0 && (
          <span
            className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary-500 px-1 text-xs font-semibold leading-none text-white tabular-nums"
            aria-hidden="true"
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          id="notifications-menu"
          role="menu"
          aria-label="Notifications"
          ref={panelRef}
          className="absolute right-0 top-[calc(100%+8px)] z-50 w-80 max-w-[calc(100vw-2rem)] animate-fade-in rounded-xl border border-theme-divider bg-theme-bg-paper shadow-xl"
        >
          <div className="flex items-center justify-between gap-3 border-b border-theme-divider px-4 py-3">
            <p className="caption text-theme-text-secondary">Notifications</p>
            {unreadCount > 0 && (
              <button
                type="button"
                role="menuitem"
                onClick={() => markAllRead()}
                className="rounded-md px-2 py-1 text-xs font-medium text-primary-500 transition-colors hover:bg-primary-100/40"
              >
                Mark all read
              </button>
            )}
          </div>

          {error && (
            <p role="alert" className="border-b border-theme-divider px-4 py-2 text-xs text-red-600">
              {error}
            </p>
          )}

          <div ref={listRef} className="max-h-[60vh] overflow-y-auto p-1.5">
            {loading ? (
              <>
                <NotificationSkeletonRow />
                <NotificationSkeletonRow />
                <NotificationSkeletonRow />
              </>
            ) : notifications.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-theme-text-secondary">
                No notifications yet.
              </p>
            ) : (
              notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onMarkRead={markRead}
                  onNavigate={() => setOpen(false)}
                  role="menuitem"
                />
              ))
            )}
          </div>

          <div className="border-t border-theme-divider p-1.5">
            <Link
              href="/notifications"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-primary-500 transition-colors hover:bg-primary-100/40"
            >
              View all
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="size-3.5"
                aria-hidden="true"
              >
                <path d="m9 6 6 6-6 6" />
              </svg>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}