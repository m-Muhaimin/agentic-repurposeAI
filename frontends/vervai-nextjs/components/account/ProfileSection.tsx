import SectionHeader from "@/components/account/SectionHeader";

type ProfileSectionProps = {
  email: string | null;
  name?: string | null;
  plan?: string | null;
  planStatus?: string | null;
  userId?: string | null;
};

function initialsOf(value: string | null): string {
  const parts = (value ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "—";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function ProfileSection({
  email,
  name,
  plan,
  planStatus,
  userId,
}: ProfileSectionProps) {
  const isFree = plan ? /free|starter|basic|trial|hobby|none/i.test(plan) : null;
  const planLabel = plan
    ? plan.charAt(0).toUpperCase() + plan.slice(1)
    : "Not configured";

  return (
    <section className="col-span-12 lg:col-span-7 bg-surface-container-lowest rounded-xl shadow-sm flex flex-col justify-between overflow-hidden">
      <SectionHeader
        icon="person_pin"
        iconClass="text-primary"
        title="Primary Identity & Author Attribution"
        subtitle="Identity details mirror your signed-in authentication session."
        badge={{ label: planLabel, className: "font-caption-bold text-caption-bold bg-primary-fixed text-on-primary-fixed px-2.5 py-1 rounded-md" }}
      />
      <div className="p-space-lg flex flex-col gap-space-lg">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-space-md p-space-md bg-surface-container-low rounded-xl">
          <div className="flex items-center gap-space-md">
            <span className="w-20 h-20 rounded-full bg-surface-container-highest text-primary flex items-center justify-center font-headline-lg text-headline-lg shadow-sm">
              {initialsOf(name ?? email)}
            </span>
            <div className="flex flex-col">
              <span className="font-headline-md text-headline-md text-on-surface">{name ?? "Account"}</span>
              <span className="font-body-sm text-body-sm text-on-surface-variant">
                {email ?? "Email hidden"}
              </span>
              {planStatus && (
                <span className="font-caption-bold text-[11px] text-secondary mt-0.5">
                  Plan status: {planStatus}
                </span>
              )}
            </div>
          </div>
          {isFree === true && (
            <button
              className="flex-1 sm:flex-none px-3 py-1.5 bg-primary hover:bg-primary-container text-on-primary font-caption-bold text-caption-bold rounded-lg transition-all active:scale-[0.98] text-center disabled:opacity-50 disabled:cursor-not-allowed"
              type="button"
              disabled
              title="Coming soon"
            >
              Upgrade Plan
              <span className="font-label-caps text-[10px] text-on-surface-variant uppercase ml-1">Coming soon</span>
            </button>
          )}
        </div>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-space-md">
          <div className="flex flex-col gap-1.5">
            <dt className="font-caption-bold text-caption-bold text-on-surface uppercase tracking-wide">Full Name</dt>
            <dd className="h-10 px-3 bg-surface-container-low rounded-lg flex items-center font-body-sm text-body-sm text-on-surface">
              {name ?? "—"}
            </dd>
          </div>
          <div className="flex flex-col gap-1.5">
            <dt className="font-caption-bold text-caption-bold text-on-surface uppercase tracking-wide">Primary Email</dt>
            <dd className="h-10 px-3 bg-surface-container-low rounded-lg flex items-center font-body-sm text-body-sm text-on-surface">
              {email ?? "Hidden"}
            </dd>
          </div>
          <div className="flex flex-col gap-1.5">
            <dt className="font-caption-bold text-caption-bold text-on-surface uppercase tracking-wide">Current Plan</dt>
            <dd className="h-10 px-3 bg-surface-container-low rounded-lg flex items-center font-body-sm text-body-sm text-on-surface">
              {planLabel}
            </dd>
          </div>
          <div className="flex flex-col gap-1.5">
            <dt className="font-caption-bold text-caption-bold text-on-surface uppercase tracking-wide">Account ID</dt>
            <dd className="h-10 px-3 bg-surface-container-low rounded-lg flex items-center font-body-sm text-body-sm text-on-surface font-mono">
              {userId ? userId.slice(0, 8) : "—"}
            </dd>
          </div>
        </dl>
      </div>
      <div className="px-space-lg py-3 bg-surface-container-low flex items-center justify-between">
        <span className="font-body-sm text-[12px] text-on-surface-variant">
          Identity fields reflect your sign-in session and are read-only here.
        </span>
        {isFree === true && (
          <button
            className="flex items-center gap-1.5 bg-primary hover:bg-primary-container text-on-primary font-body-medium text-body-medium px-4 py-2 rounded-lg active:scale-[0.98] transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            type="button"
            disabled
            title="Coming soon"
          >
            <span className="material-symbols-outlined text-[18px]">upgrade</span>
            <span>Upgrade</span>
            <span className="font-label-caps text-[10px] text-on-surface-variant uppercase ml-1">Coming soon</span>
          </button>
        )}
      </div>
    </section>
  );
}