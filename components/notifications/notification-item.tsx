"use client";

// One notification row, shared by the header bell and /notifications. Unread
// is NEVER color-only: unread rows get a dot + heavier title weight + sr-only
// "Unread" text, and the severity icon carries its own sr-only label. Rows
// with a safe internal actionUrl render as links (cmd/middle-click works);
// rows without one render as buttons. Clicking marks read, then navigates —
// external navigation is impossible by construction (isSafeActionUrl).

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { isSafeActionUrl, type NotificationSeverity } from "@/lib/notifications/types";
import type { NotificationRecord } from "./use-notifications";
import { relativeTimeLabel } from "./relative-time";

const SEVERITY_LABEL: Record<NotificationSeverity, string> = {
  info: "Information",
  success: "Success",
  warning: "Warning",
  error: "Error"
};

// Severity accent on a neutral tint — the only non-theme colors in the row,
// exactly the four the design brief mandates. Never the sole signal.
const SEVERITY_STYLE: Record<NotificationSeverity, string> = {
  info: "bg-neutral-100 text-theme-text-secondary",
  success: "bg-green-50 text-green-600",
  warning: "bg-amber-50 text-amber-600",
  error: "bg-red-50 text-red-600"
};

function SeverityIcon({ severity }: { severity: NotificationSeverity }) {
  return (
    <span
      className={clsx(
        "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg",
        SEVERITY_STYLE[severity]
      )}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-4"
        aria-hidden="true"
      >
        {severity === "info" && (
          <>
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4M12 8h.01" />
          </>
        )}
        {severity === "success" && (
          <>
            <circle cx="12" cy="12" r="10" />
            <path d="m8.5 12.5 2.5 2.5 5-5" />
          </>
        )}
        {severity === "warning" && (
          <>
            <path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
            <path d="M12 9v4M12 17h.01" />
          </>
        )}
        {severity === "error" && (
          <>
            <circle cx="12" cy="12" r="10" />
            <path d="m15 9-6 6M9 9l6 6" />
          </>
        )}
      </svg>
      <span className="sr-only">{SEVERITY_LABEL[severity]}</span>
    </span>
  );
}

// Timestamp that re-reads the clock every 60s while mounted, so the popover's
// "5 minutes ago" stays honest without a global interval.
function RelativeTime({ iso }: { iso: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);
  return (
    <time dateTime={iso} className="text-theme-text-secondary">
      {relativeTimeLabel(iso, now)}
    </time>
  );
}

export default function NotificationItem({
  notification,
  onMarkRead,
  onNavigate,
  role
}: {
  notification: NotificationRecord;
  onMarkRead: (id: string) => void;
  onNavigate?: () => void;
  role?: "menuitem";
}) {
  const router = useRouter();
  const unread = notification.readAt == null;
  const safeUrl =
    notification.actionUrl && isSafeActionUrl(notification.actionUrl)
      ? notification.actionUrl
      : null;

  function handleClick() {
    if (unread) onMarkRead(notification.id);
    if (safeUrl) {
      onNavigate?.();
      router.push(safeUrl);
    }
  }

  const content = (
    <>
      <SeverityIcon severity={notification.severity} />
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-2">
          <span
            className={clsx(
              "min-w-0 truncate text-sm text-theme-text-primary",
              unread && "font-semibold"
            )}
          >
            {notification.title}
          </span>
          {unread && (
            <span className="mt-1.5 flex shrink-0 items-center" aria-hidden="true">
              <span className="size-2 rounded-full bg-primary-500" />
            </span>
          )}
        </span>
        {notification.body && (
          <span className="mt-0.5 line-clamp-2 block text-xs leading-normal text-theme-text-secondary">
            {notification.body}
          </span>
        )}
        <span className="mt-1 block text-[11px]">
          <RelativeTime iso={notification.createdAt} />
        </span>
      </span>
      {unread && <span className="sr-only">Unread</span>}
    </>
  );

  const itemClass =
    "flex w-full items-start gap-3 rounded-lg px-3 py-3 text-left transition-colors hover:bg-primary-500/[0.04] hover:text-theme-text-primary";

  if (safeUrl) {
    return (
      <Link href={safeUrl} role={role} onClick={handleClick} className={itemClass}>
        {content}
      </Link>
    );
  }
  return (
    <button type="button" role={role} onClick={handleClick} className={itemClass}>
      {content}
    </button>
  );
}

// Loading placeholder used by both the bell and the page. `animate-pulse` is
// the stock Tailwind utility — no new animation added for this.
export function NotificationSkeletonRow() {
  return (
    <div className="flex items-start gap-3 px-3 py-3" aria-hidden="true">
      <div className="size-8 shrink-0 animate-pulse rounded-lg bg-neutral-200" />
      <div className="min-w-0 flex-1 space-y-2 py-0.5">
        <div className="h-3 w-1/3 animate-pulse rounded bg-neutral-200" />
        <div className="h-3 w-2/3 animate-pulse rounded bg-neutral-200" />
      </div>
    </div>
  );
}