import CreditCards from "@/components/billing/CreditCards";
import OnDemandPacks from "@/components/billing/OnDemandPacks";
import ConsumptionLedger from "@/components/billing/ConsumptionLedger";
import BillingAutoToggle from "@/components/billing/BillingAutoToggle";
import TopUpModal from "@/components/billing/TopUpModal";
import { getSourcesWithOutputs, getDistributionJobs, getProfile } from "@/lib/data";

function planDisplayName(plan: string | null): string {
  if (!plan || plan === "free") return "Free";
  return plan.charAt(0).toUpperCase() + plan.slice(1).replace(/_/g, " ");
}

export default async function Page() {
  const [sources, jobs, profile] = await Promise.all([
    getSourcesWithOutputs(100),
    getDistributionJobs(200),
    getProfile(),
  ]);

  const outputs = sources.flatMap((s) => s.outputs ?? []);
  const publishedJobs = jobs.filter((j) => j.status === "published");
  const planLabel = planDisplayName(profile?.plan ?? null);
  const planStatus = profile?.plan_status ?? "active";

  return (
    <div className="flex flex-col w-full">
      <div className="w-full max-w-7xl mx-auto px-space-lg py-space-xl flex flex-col gap-space-xl">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-space-md">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-space-xs text-on-surface-variant font-label-caps text-label-caps uppercase tracking-wider">
              <span>Workspace</span>
              <span className="material-symbols-outlined text-[13px]">chevron_right</span>
              <span className="text-primary font-caption-bold">Billing &amp; Plan</span>
            </div>
            <h1 className="font-headline-xl text-headline-xl text-on-surface tracking-tight">
              Credits &amp; Subscription
            </h1>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Manage your plan, view consumption, and top up credits.
            </p>
          </div>
          <div className="flex items-center gap-space-sm shrink-0">
            <TopUpModal />
            <button
              className="flex items-center gap-space-xs bg-primary-container hover:bg-primary text-on-primary font-body-medium text-body-medium px-space-md py-2.5 rounded-lg transition-all active:scale-[0.98] shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              type="button"
              disabled
              title="Coming soon"
            >
              <span className="material-symbols-outlined text-[18px]">upgrade</span>
              <span>Upgrade Plan</span>
              <span className="font-label-caps text-[10px] text-on-surface-variant uppercase ml-1">Coming soon</span>
            </button>
          </div>
        </div>
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-secondary-container via-surface-container-low to-surface-container-low p-space-md shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-md z-10 relative">
            <div className="flex items-center gap-space-md">
              <div className="w-10 h-10 rounded-lg bg-surface-container-lowest flex items-center justify-center text-primary shadow-sm shrink-0">
                <span className="material-symbols-outlined text-[24px]">speed</span>
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-space-xs">
                  <span className="font-headline-sm text-headline-sm text-on-surface">
                    Auto-Topup
                  </span>
                  <span className="font-caption-bold text-caption-bold px-2 py-0.5 rounded bg-tertiary-fixed text-on-tertiary-fixed">
                    Recommended
                  </span>
                </div>
                <span className="font-body-sm text-body-sm text-on-surface-variant">
                  Automatically replenish credits when your balance runs low.
                </span>
              </div>
            </div>
            <div className="flex items-center gap-space-sm self-start sm:self-center">
              <BillingAutoToggle />
            </div>
          </div>
        </div>
        <CreditCards
          sourceCount={sources.length}
          outputCount={outputs.length}
          jobCount={jobs.length}
          publishedCount={publishedJobs.length}
        />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter items-stretch">
          <div className="lg:col-span-7 bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col justify-between">
            <div className="flex flex-col gap-space-md">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-xs pb-space-sm bg-surface-container-low -mx-space-lg -mt-space-lg px-space-lg pt-space-md rounded-t-xl">
                <div className="flex items-center gap-space-sm">
                  <span className="bg-primary text-on-primary font-caption-bold text-caption-bold px-2 py-1 rounded tracking-wide">
                    ACTIVE PLAN
                  </span>
                  <h2 className="font-headline-lg text-headline-lg text-on-surface">
                    {planLabel}
                  </h2>
                </div>
                <span className="font-caption-bold text-caption-bold text-secondary bg-surface-container-lowest px-2.5 py-1 rounded shadow-sm self-start sm:self-center">
                  {planStatus.charAt(0).toUpperCase() + planStatus.slice(1)}
                </span>
              </div>
              <div className="bg-surface-container-low rounded-lg p-space-md flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm">
                <div className="flex items-center gap-space-sm">
                  <span className="material-symbols-outlined text-on-surface-variant text-[24px]">
                    credit_card
                  </span>
                  <div className="flex flex-col">
                    <span className="font-body-medium text-body-medium text-on-surface">
                      {sources.length} sources · {outputs.length} outputs
                    </span>
                    <span className="font-body-sm text-body-sm text-on-surface-variant">
                      {publishedJobs.length} posts published
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-space-sm pt-space-md mt-space-sm">
              <button
                className="bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-body-medium text-body-medium px-space-md py-2 rounded-lg transition-colors active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                disabled
                title="Coming soon"
              >
                Change Plan
              </button>
            </div>
          </div>
          <OnDemandPacks />
        </div>
        <ConsumptionLedger sources={sources} />
      </div>
    </div>
  );
}