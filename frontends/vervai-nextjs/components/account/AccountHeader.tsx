type AccountHeaderProps = {
  email: string | null;
  name?: string | null;
  plan?: string | null;
  planStatus?: string | null;
};

const ACCOUNT_TABS = [
  { icon: "badge", label: "Profile & Identity", active: true },
  { icon: "devices", label: "Sessions & Security", active: false },
  { icon: "hub", label: "Connected Accounts", active: false },
  { icon: "warning", label: "Data & Danger Zone", active: false },
];

const FREE_PLAN = /free|starter|basic|trial|hobby|none/i;

export default function AccountHeader({
  email,
  name,
  plan,
  planStatus,
}: AccountHeaderProps) {
  const isFree = plan ? FREE_PLAN.test(plan) : null;
  const planLabel = plan
    ? plan.charAt(0).toUpperCase() + plan.slice(1)
    : "Free";
  const identity = name ?? email ?? "Account";
  const initials = (identity.trim().charAt(0) || "—").toUpperCase();

  return (
    <>
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-space-md">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-space-xs text-on-surface-variant font-label-caps text-label-caps uppercase tracking-wider">
            <span>Account</span>
            <span className="material-symbols-outlined text-[13px] text-outline">chevron_right</span>
            <span className="text-primary font-headline-sm">Identity & Security</span>
          </div>
          <h1 className="font-display-xl text-display-xl text-on-surface tracking-tight">Account & User Profile</h1>
          <p className="font-body-medium text-body-medium text-on-surface-variant max-w-2xl">
            Manage your signed-in identity, authenticated session, connected accounts, and data settings.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-space-sm self-start md:self-auto">
          <div className="flex items-center gap-2 bg-surface-container px-3 py-1.5 rounded-lg shadow-sm">
            <span className="w-6 h-6 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-caption-bold text-[11px]">
              {initials}
            </span>
            <span className="font-caption-bold text-caption-bold text-on-surface">
              {email ?? "Signed-in session"}
            </span>
          </div>
          <div className="flex items-center gap-2 bg-surface-container px-3 py-1.5 rounded-lg shadow-sm">
            <span className="inline-block w-2 h-2 rounded-full bg-tertiary"></span>
            <span className="font-caption-bold text-caption-bold text-on-surface">
              {plan ? (planStatus ? `${planLabel} · ${planStatus}` : planLabel) : "Free plan"}
            </span>
          </div>
          {isFree === true && (
            <button
              className="flex items-center gap-1.5 bg-primary hover:bg-primary-container text-on-primary px-3 py-1.5 rounded-lg font-body-sm text-body-sm transition-all shadow-sm active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              type="button"
              disabled
              title="Coming soon"
            >
              Upgrade
              <span className="font-label-caps text-[10px] text-on-surface-variant uppercase ml-1">Coming soon</span>
            </button>
          )}
        </div>
      </div>
      <div className="bg-surface-container-low p-1 rounded-xl shadow-sm overflow-x-auto">
        <nav className="flex items-center gap-1 min-w-max">
          {ACCOUNT_TABS.map((tab) => (
            <button
              key={tab.label}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                tab.active
                  ? "bg-surface-container-lowest text-primary font-headline-sm text-headline-sm shadow-sm"
                  : "hover:bg-surface-container text-on-surface-variant font-body-medium text-body-medium"
              }`}
              type="button"
            >
              <span className="material-symbols-outlined text-[18px]">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>
    </>
  );
}