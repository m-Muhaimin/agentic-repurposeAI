import { createClient } from "@/lib/supabase/server";
import { resolvePlan } from "@/lib/billing/entitlements";
import { getUsageSnapshot } from "@/lib/billing/usage";
import PageHeader from "@/components/page-header";
import Breadcrumbs from "@/components/breadcrumbs";
import { Card, CardHeader } from "@/components/card";
import { UsageMeter } from "@/components/usage-meter";

function usageDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(iso));
}

export default async function UsagePage() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  // Plan + reactive monthly snapshot (service-role read; fails open to the
  // Beta defaults if billing tables/migration aren't live yet).
  const plan = await resolvePlan(user!.id);
  const usage = await getUsageSnapshot(user!.id, plan);
  const { jobsUsed: used, jobsLimit: limit, jobsRemaining: remaining } = usage;

  let recentJobs: { title: string; date: string; formats: number }[] = [];
  try {
    const { data: jobs } = await supabase
      .from("jobs")
      .select("created_at, formats, source_id")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false })
      .limit(5);
    if (jobs?.length) {
      const sourceIds = jobs.map((j) => j.source_id);
      const { data: sources } = await supabase
        .from("sources")
        .select("id, title")
        .in("id", sourceIds);
      const titles = new Map((sources ?? []).map((s) => [s.id, s.title]));
      recentJobs = jobs.map((j) => ({
        title: titles.get(j.source_id) ?? "Untitled content",
        date: usageDate(j.created_at),
        formats: j.formats?.length ?? 0
      }));
    }
  } catch {
    // Recent usage unavailable — section shows "—".
  }

  return (
      <div className="workspace py-8 lg:py-10">
        <Breadcrumbs items={[{ label: "Settings", href: "/settings" }, { label: "Plan & Usage" }]} />
        <PageHeader
          title="Plan &amp; Usage"
          description="Track your monthly content generation and plan limits."
        />

        <div className="grid gap-4 lg:grid-cols-2">
          {/* Plan */}
          <Card className="p-6">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-display text-lg font-semibold">{plan.name} plan</p>
                <p className="mt-0.5 text-sm text-theme-text-secondary">
                  Free during beta · {plan.displayPrice}
                </p>
              </div>
              <span className="badge bg-neutral-900 text-white">Active</span>
            </div>

            <div className="mt-6">
              <UsageMeter
                used={used}
                limit={limit}
                percent={usage.percent}
                label={usage.windowLabel}
                resetAt={usage.resetAt}
              />
              <p className="mt-2 text-xs text-theme-text-secondary">
                {remaining === 0
                  ? "All jobs used for this month — they reset automatically."
                  : `${remaining} job${remaining === 1 ? "" : "s"} left this month.`}{" "}
                Failed or cancelled jobs are refunded and don&apos;t count.
              </p>
            </div>

            <p className="mt-5 text-xs text-theme-text-secondary">
              {plan.tagline} Paid plans are on the way — no payment details needed yet.
            </p>
          </Card>

          {/* Included */}
          <Card className="p-6">
            <h2 className="font-display text-base font-semibold">Included with your plan</h2>
            <ul className="mt-4 flex flex-col gap-3">
              {plan.includes.map((item) => (
                <li key={item} className="flex items-center gap-2.5 text-sm text-theme-text-secondary">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="size-4 shrink-0 text-primary-500"
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <path d="m9 12 2 2 4-4" />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-theme-text-secondary">
              Creation jobs are budgeted per calendar month and reset automatically.
            </p>
          </Card>
        </div>

        {/* Recent usage */}
        <Card className="mt-4">
          <CardHeader
            title="Recent usage"
            description="Your most recent creation jobs this cycle."
          />
          {recentJobs.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-theme-text-secondary">
              No jobs yet this cycle — create your first piece of content.
            </p>
          ) : (
            <ul className="divide-y divide-theme-divider">
              {recentJobs.map((job, i) => (
                <li
                  key={`${job.title}-${i}`}
                  className="flex items-center justify-between gap-4 px-5 py-3"
                >
                  <span className="truncate text-sm font-medium text-theme-text-primary">
                    {job.title}
                  </span>
                  <span className="shrink-0 text-xs text-theme-text-secondary">
                  {job.date} · {job.formats} format{job.formats === 1 ? "" : "s"}
                </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
  );
}