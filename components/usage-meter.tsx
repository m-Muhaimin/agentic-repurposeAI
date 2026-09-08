"use client";

import Link from "next/link";
import type { ClientUsage } from "@/lib/billing/usage-client";
import { formatResetDate } from "@/lib/billing/usage-client";

// Compact meter used on the dashboard strip and the usage page.
export function UsageMeter({
  used,
  limit,
  percent,
  label,
  resetAt
}: {
  used: number;
  limit: number | null;
  percent: number;
  label?: string;
  resetAt?: string;
}) {
  const pct = limit ? Math.min(100, percent) : 0;
  const tone = limit === null || percent < 80 ? "ok" : percent >= 100 ? "danger" : "warn";
  const barColor =
    tone === "danger" ? "bg-red-500" : tone === "warn" ? "bg-amber-500" : "bg-primary-500";
  const textColor = tone === "danger" ? "text-red-600" : tone === "warn" ? "text-amber-600" : "text-theme-text-secondary";

  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-medium text-theme-text-primary">{label ?? "This month"}</span>
        <span className={`${textColor} tabular-nums`}>
          {limit === null ? `${used} total` : `${used} / ${limit}`}
        </span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-neutral-200">
        <div
          className={`h-full rounded-full ${barColor} transition-[width] duration-500 ease-out`}
          style={{ width: `${Math.max(limit && used > 0 ? 3 : 0, pct)}%` }}
        />
      </div>
      {resetAt && (
        <p className="mt-1 text-xs text-theme-text-secondary">Resets {formatResetDate(resetAt)}</p>
      )}
    </div>
  );
}

// Limit-aware banner for the upload page (and anywhere else a user is about to
// spend a slot): warns at 80%+, blocks with clear copy at 100%.
export function UsageNotice({ usage, className = "" }: { usage: ClientUsage | null; className?: string }) {
  if (!usage || !usage.limit) return null;

  if (usage.atLimit) {
    return (
      <div
        role="alert"
        className={`rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 ${className}`}
      >
        <p className="font-medium">
          You&apos;ve used all {usage.limit} VervAI jobs for {usage.windowLabel}.
        </p>
        <p className="mt-0.5">
          They reset {formatResetDate(usage.resetAt)}. Your saved content and drafts stay in your
          library.
        </p>
        <p className="mt-1.5">
          <Link href="/settings/usage" className="font-medium underline underline-offset-2 hover:text-red-900">
            View plan &amp; usage
          </Link>
          {" · "}
          <Link href="/library" className="font-medium underline underline-offset-2 hover:text-red-900">
            Go to your library
          </Link>
        </p>
      </div>
    );
  }

  if (usage.percent >= 80) {
    return (
      <div
        role="status"
        className={`rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 ${className}`}
      >
        You&apos;ve used {usage.percent}% of your {usage.limit} jobs this month — they reset{" "}
        {formatResetDate(usage.resetAt)}.
      </div>
    );
  }

  return null;
}

// Reads the structured limit-error body the API returns (error + code) so
// callers can special-case USAGE_LIMIT_REACHED/REGENERATION_LIMIT_REACHED.
export function parseLimitBody(data: Record<string, unknown> | null | undefined): {
  code: string | null;
  message: string;
} {
  const code = typeof data?.code === "string" ? data.code : null;
  const message =
    typeof data?.error === "string" ? data.error : "Something went wrong. Please try again.";
  return { code, message };
}