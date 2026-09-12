import QuotaMonitors from "@/components/usage/QuotaMonitors";
import VelocityChart from "@/components/usage/VelocityChart";
import LeverageMetrics from "@/components/usage/LeverageMetrics";
import PipelineExecutions from "@/components/usage/PipelineExecutions";
import {
  getSourcesWithOutputs,
  getDistributionJobs,
  getRecentIdeas,
  getProfile,
  getRunStatusCounts,
  getAgentRuns,
} from "@/lib/data";
import type { SourceRow } from "@/lib/data";

export default async function Page() {
  const [sources, jobs, ideas, profile, runStatusCounts, agentRuns] =
    await Promise.all([
      getSourcesWithOutputs(100),
      getDistributionJobs(200),
      getRecentIdeas(100),
      getProfile(),
      getRunStatusCounts(),
      getAgentRuns(20),
    ]);

  const outputs = sources.flatMap((s: SourceRow) => s.outputs ?? []);
  const outputCount = outputs.length;
  const publishedJobs = jobs.filter((j) => j.status === "published");

  const now = new Date();
  const currentMonth = now.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const dayMs = 86_400_000;
  const bars: { day: string; sources: number; outputs: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now.getTime() - i * dayMs);
    const dateStr = d.toISOString().slice(0, 10);
    const dayLabel = d.toLocaleDateString("en-US", { day: "numeric" });
    const srcCount = sources.filter(
      (s) => s.created_at.slice(0, 10) === dateStr,
    ).length;
    const outCount = outputs.filter(
      (o) => o.created_at.slice(0, 10) === dateStr,
    ).length;
    bars.push({ day: dayLabel, sources: srcCount, outputs: outCount });
  }

  const planLabel = profile?.plan
    ? profile.plan.charAt(0).toUpperCase() +
      profile.plan.slice(1).replace(/_/g, " ")
    : "Free";
  const isFree =
    !profile?.plan || profile.plan === "free" || profile.plan === "starter";

  const totalRuns = runStatusCounts.reduce((sum, r) => sum + r.count, 0);

  return (
    <div className="flex flex-col w-full">
      <div className="flex flex-wrap items-center justify-between gap-space-sm mb-space-sm">
        <div className="flex items-center gap-space-xs font-label-caps text-label-caps tracking-wider text-secondary">
          <span>WORKSPACE</span>
          <span>/</span>
          <span className="text-on-surface font-semibold">USAGE</span>
          <span className="w-1.5 h-1.5 rounded-full bg-tertiary-container animate-pulse ml-1"></span>
        </div>
        <div className="flex items-center gap-space-xs text-caption-bold font-caption-bold text-secondary">
          <span className="material-symbols-outlined text-[16px] text-tertiary">
            check_circle
          </span>
          <span>
            {sources.length} sources · {outputCount} outputs ·{" "}
            {publishedJobs.length} published
          </span>
        </div>
      </div>
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-space-md mb-space-lg pb-space-sm">
        <div className="max-w-2xl">
          <h1 className="font-headline-xl text-headline-xl text-on-surface tracking-tight">
            Usage &amp; Telemetry
          </h1>
          <p className="font-body-base text-body-base text-secondary mt-1">
            Real-time observability into your content pipeline: sources
            ingested, outputs generated, distribution activity, and agent runs.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-space-sm shrink-0">
          <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-container-lowest shadow-sm">
            <span className="material-symbols-outlined text-[18px] text-primary">
              calendar_today
            </span>
            <span className="font-caption-bold text-caption-bold text-on-surface">
              {currentMonth}
            </span>
            <span className="font-label-caps text-[10px] px-1.5 py-0.5 rounded bg-tertiary-fixed text-on-tertiary-fixed uppercase font-bold">
              {planLabel}
            </span>
          </div>
          {isFree && (
            <button
              type="button"
              disabled
              title="Coming soon"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-on-primary font-caption-bold text-caption-bold shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined text-[18px]">
                bolt
              </span>
              <span>Upgrade Plan</span>
            </button>
          )}
        </div>
      </div>
      <QuotaMonitors
        sources={sources}
        outputs={outputs}
        publishedCount={publishedJobs.length}
        ideas={ideas}
      />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter mb-space-lg">
        <VelocityChart bars={bars} />
        <LeverageMetrics
          sourceCount={sources.length}
          outputCount={outputCount}
          jobCount={jobs.length}
          ideaCount={ideas.length}
          approvedIdeas={ideas.filter((i) => i.approved).length}
        />
      </div>
      <PipelineExecutions
        runs={agentRuns}
        sources={sources}
        totalRunCount={totalRuns}
      />
    </div>
  );
}
