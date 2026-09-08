import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { resolvePlan } from "@/lib/billing/entitlements";
import { getUsageSnapshot, type UsageSnapshot } from "@/lib/billing/usage";
import PageHeader from "@/components/page-header";
import { Card, CardHeader, CardFooter } from "@/components/card";
import StatusBadge from "@/components/status-badge";
import { UsageMeter } from "@/components/usage-meter";
import { PENDING_STATUS } from "@/lib/status";
import ObjectivePrompt from "@/components/dashboard/objective-prompt";
import AtAGlance from "@/components/dashboard/at-a-glance";
import OpportunityNext from "@/components/dashboard/opportunity-next";

// Renders the Beta plan strip above the content regardless of empty/full state
// so every visit communicates the current entitlement.
function UsageStrip({
  usage,
  planName
}: {
  usage: Pick<UsageSnapshot, "jobsUsed" | "jobsLimit" | "jobsRemaining" | "percent" | "resetAt" | "windowLabel">;
  planName: string;
}) {
  return (
    <section className="mb-6 rounded-lg border border-theme-divider bg-theme-bg-paper px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-display text-sm font-semibold">{planName} plan</span>
            <span className="badge bg-primary-100 text-primary-700">Free</span>
            <span className="text-xs text-theme-text-secondary">for {usage.windowLabel}</span>
          </div>
          <p className="mt-1 text-xs text-theme-text-secondary">
            {usage.jobsLimit === null
              ? `${usage.jobsUsed} creation jobs used so far`
              : `${usage.jobsUsed} of ${usage.jobsLimit} creation jobs used${
                  usage.jobsRemaining ? ` · ${usage.jobsRemaining} left` : ""
                }`}
          </p>
        </div>
        <div className="flex w-full max-w-[220px] flex-col gap-2">
          <UsageMeter
            used={usage.jobsUsed}
            limit={usage.jobsLimit}
            percent={usage.percent}
            resetAt={usage.resetAt}
          />
          <Link
            href="/settings/usage"
            className="caption text-primary-500 transition-colors hover:text-primary-700"
          >
            Plan &amp; usage →
          </Link>
        </div>
      </div>
    </section>
  );
}

type Source = {
  id: string;
  title: string;
  status: string;
  error_message: string | null;
  created_at: string;
  outputs: { id: string; format: string; content: string }[] | null;
};

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = Math.max(0, Date.now() - then);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min${mins === 1 ? "" : "s"} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(iso));
}

function MiniStat({ label, value, tone }: { label: string; value: number; tone?: "red" | "default" }) {
  return (
    <div>
      <p className="font-display text-2xl font-bold tabular-nums text-theme-text-primary">{value}</p>
      <p className={`mt-1 text-sm ${tone === "red" ? "font-medium text-red-600" : "text-theme-text-secondary"}`}>
        {label}
      </p>
    </div>
  );
}

function ActivitySummary({ source }: { source: Source }) {
  if (source.status === "done") {
    const n = source.outputs?.length ?? 0;
    return `${n} draft${n === 1 ? "" : "s"} generated`;
  }
  if (source.status === "failed") {
    return source.error_message ?? "Processing failed — try again";
  }
  return "Processing…";
}

export default async function OverviewPage() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  // Entitlement snapshot for the Beta strip — fails open to defaults if the
  // billing tables/migration aren't live yet.
  let entitlement: { used: number; limit: number | null; percent: number; resetAt: string; windowLabel: string; planName: string } | null = null;
  try {
    const plan = await resolvePlan(user!.id);
    const snap = await getUsageSnapshot(user!.id, plan);
    entitlement = {
      used: snap.jobsUsed,
      limit: snap.jobsLimit,
      percent: snap.percent,
      resetAt: snap.resetAt,
      windowLabel: snap.windowLabel,
      planName: plan.name
    };
  } catch {
    entitlement = null;
  }

  const { data: sources } = await supabase
    .from("sources")
    .select("*, outputs(*)")
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false });

  const allSources = (sources ?? []) as unknown as Source[];

  const contentPieces = allSources.length;
  const drafts = allSources.reduce((acc, s) => acc + (s.outputs?.length ?? 0), 0);
  const inProgress = allSources.filter((s) => PENDING_STATUS.includes(s.status)).length;
  const needsAttention = allSources.filter((s) => s.status === "failed").length;

  // "Your content system" panel — each lookup degrades silently so the overview
  // still renders even if a table/policy is missing.
  let brandVoiceSet = false;
  let formatOverrides = 0;
  try {
    const { data: prompts } = await supabase
      .from("user_prompts")
      .select("format, prompt")
      .eq("user_id", user!.id);
    const rows = prompts ?? [];
    brandVoiceSet = rows.some((r) => r.format === "brand_voice" && (r.prompt ?? "").trim().length > 0);
    formatOverrides = rows.filter(
      (r) => r.format !== "brand_voice" && (r.prompt ?? "").trim().length > 0
    ).length;
  } catch {
    // Ignore — defaults shown.
  }

  let youtubeConnected = false;
  let youtubeChannel: string | null = null;
  try {
    const { data: connections } = await supabase
      .from("youtube_connections")
      .select("channel_title")
      .eq("user_id", user!.id)
      .limit(1);
    youtubeConnected = Boolean(connections?.length);
    youtubeChannel = connections?.[0]?.channel_title ?? null;
  } catch {
    // Ignore — "Connect" shown.
  }

  return (
    <div className="workspace py-8 lg:py-10">
      <PageHeader
        className="mb-6"
        title="Overview"
        description="Your command center — what needs you, what's working, and what to make next, all from your real data."
      />

      <ObjectivePrompt />

      {entitlement && (
        <div className="mt-5">
          <UsageStrip
            usage={{
              jobsUsed: entitlement.used,
              jobsLimit: entitlement.limit,
              jobsRemaining: entitlement.limit === null ? null : Math.max(0, entitlement.limit - entitlement.used),
              percent: entitlement.percent,
              resetAt: entitlement.resetAt,
              windowLabel: entitlement.windowLabel
            }}
            planName={entitlement.planName}
          />
        </div>
      )}

      <div className="mt-5 grid items-start gap-5 lg:grid-cols-12">
        {/* Left rail — the queue, then recent work */}
        <div className="flex flex-col gap-5 lg:col-span-7">
          <AtAGlance />

          <Card>
            <CardHeader
              title="Recent content"
              action={
                <Link
                  href="/library"
                  className="caption text-primary-500 transition-colors hover:text-primary-700"
                >
                  View library →
                </Link>
              }
            />
            {allSources.length === 0 ? (
              <div className="px-5 py-10">
                <p className="text-sm text-theme-text-secondary">
                  Nothing here yet — create your first piece of content and it will show up here.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-theme-divider">
                {allSources.slice(0, 5).map((source) => (
                  <li key={source.id} className="flex items-center justify-between gap-4 px-5 py-4">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-theme-text-primary">{source.title}</p>
                      <p className="mt-0.5 truncate text-sm text-theme-text-secondary">
                        {source.status === "failed" ? (
                          <span className="text-red-600">{source.error_message ?? "Failed"}</span>
                        ) : (
                          ActivitySummary({ source })
                        )}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <StatusBadge status={source.status} />
                      <span className="hidden text-xs text-theme-text-secondary sm:block">
                        {timeAgo(source.created_at)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        {/* Right rail — what to do next, then performance, then the system */}
        <div className="flex flex-col gap-5 lg:col-span-5">
          <OpportunityNext />

          <Card>
            <CardHeader
              title="Performance"
              description="A compact snapshot of your content system."
            />
            <div className="grid grid-cols-1 gap-5 p-5 sm:grid-cols-2">
              <MiniStat label="Content pieces" value={contentPieces} />
              <MiniStat label="Drafts created" value={drafts} />
              <MiniStat label="In progress" value={inProgress} />
              <MiniStat
                label="Needs attention"
                value={needsAttention}
                tone={needsAttention ? "red" : "default"}
              />
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Your content system"
              description="Voice, outputs, and the platforms you work with."
            />
            <ul className="flex flex-col gap-4 px-5 py-5">
              <li className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-theme-text-primary">Brand voice</p>
                  <p className="text-xs text-theme-text-secondary">
                    {brandVoiceSet
                      ? "Personalised"
                      : formatOverrides > 0
                        ? `${formatOverrides} format${formatOverrides === 1 ? "" : "s"} customised`
                        : "Following defaults"}
                  </p>
                </div>
                <span
                  className={`badge ${
                    brandVoiceSet || formatOverrides > 0
                      ? "bg-primary-100 text-primary-700"
                      : "bg-neutral-100 text-neutral-600"
                  }`}
                >
                  {brandVoiceSet || formatOverrides > 0 ? "Set" : "Defaults"}
                </span>
              </li>
              <li className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-theme-text-primary">Output preferences</p>
                  <p className="text-xs text-theme-text-secondary">LinkedIn · Newsletter · Short-form</p>
                </div>
                <span className="badge bg-primary-100 text-primary-700">3 formats</span>
              </li>
              <li className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-theme-text-primary">YouTube</p>
                  <p className="text-xs text-theme-text-secondary">
                    {youtubeConnected
                      ? youtubeChannel ?? "Connected"
                      : "Connect your channel to use captions"}
                  </p>
                </div>
                {youtubeConnected ? (
                  <span className="badge bg-neutral-900 text-white">Connected</span>
                ) : (
                  <Link href="/connections" className="btn btn-outline-primary btn-sm">
                    Connect
                  </Link>
                )}
              </li>
            </ul>
            <CardFooter>
              <Link href="/branding" className="btn btn-light-primary w-full">
                Manage brand &amp; voice
              </Link>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}