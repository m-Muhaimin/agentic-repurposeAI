type StatusTone = "active" | "error" | "available" | "stable";

type ActionTone = "default" | "primary" | "error" | "connect";

type Detail = {
  label: string;
  value: string;
  valueTone?: "default" | "tertiary" | "error" | "primary" | "mono";
};

export type ConnectorCardItem = {
  icon: string;
  iconTone: string;
  status: { label: string; tone: StatusTone };
  title: string;
  description: string;
  details: Detail[];
  action: { label: string; icon?: string; tone: ActionTone };
};

const STATUS_CLASSES: Record<StatusTone, { standard: string; compact: string }> = {
  active: {
    standard: "bg-tertiary-fixed/60 text-tertiary",
    compact: "bg-tertiary-fixed/60 text-tertiary",
  },
  error: {
    standard: "bg-error-container text-on-error-container",
    compact: "bg-error-container text-error",
  },
  available: {
    standard: "bg-surface-container-high text-on-surface-variant",
    compact: "bg-surface-container-high text-on-surface-variant",
  },
  stable: {
    standard: "bg-tertiary-fixed text-on-tertiary-fixed",
    compact: "bg-tertiary-fixed/60 text-tertiary",
  },
};

const ACTION_CLASSES: Record<ActionTone, { standard: string; compact: string }> = {
  default: {
    standard: "bg-surface-container hover:bg-surface-container-high text-on-surface",
    compact: "bg-surface-container hover:bg-surface-container-high text-on-surface",
  },
  primary: {
    standard: "bg-primary text-on-primary hover:bg-primary-container",
    compact: "bg-primary text-on-primary hover:bg-primary-container",
  },
  error: {
    standard: "bg-error text-on-error hover:opacity-95",
    compact: "bg-error text-on-error hover:opacity-95",
  },
  connect: {
    standard: "bg-primary-fixed text-on-primary-fixed hover:bg-primary hover:text-on-primary",
    compact: "bg-secondary-container hover:bg-secondary-fixed text-primary",
  },
};

const VALUE_TONE_CLASSES: Record<string, string> = {
  default: "text-on-surface",
  tertiary: "text-tertiary",
  error: "text-error",
  primary: "text-primary",
  mono: "text-tertiary font-mono text-[11px] font-bold",
};

export default function ConnectorCard({
  item,
  variant = "standard",
}: {
  item: ConnectorCardItem;
  variant?: "standard" | "compact";
}) {
  const compact = variant === "compact";
  return (
    <div
      className={`${compact ? "p-space-md" : "p-space-lg"} rounded-xl bg-surface-container-lowest shadow-sm flex flex-col justify-between hover:shadow-md transition-all`}
    >
      <div className={compact ? "space-y-space-md" : "space-y-space-sm"}>
        <div className="flex items-start justify-between">
          <div
            className={`${compact ? "w-11 h-11 bg-surface-container" : "w-10 h-10 bg-surface-container-low"} rounded-lg flex items-center justify-center text-primary`}
          >
            <span className="material-symbols-outlined text-[24px]">{item.icon}</span>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 ${compact ? "px-2.5 py-1" : "px-2 py-0.5"} rounded-full font-caption-bold text-caption-bold ${STATUS_CLASSES[item.status.tone][variant]}`}
          >
            {item.status.tone === "active" || item.status.tone === "stable" ? (
              <span className="w-1.5 h-1.5 rounded-full bg-tertiary"></span>
            ) : null}
            {item.status.label}
          </span>
        </div>
        <div>
          <h3 className="font-headline-sm text-headline-sm text-on-surface">{item.title}</h3>
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
            {item.description}
          </p>
        </div>
        {compact ? (
          <div className="p-space-sm rounded-lg bg-surface-container-low space-y-1 text-on-surface-variant font-caption-bold text-caption-bold">
            {item.details.map((detail) => (
              <div key={detail.label || detail.value} className="flex justify-between">
                <span>{detail.label}</span>
                <span className={VALUE_TONE_CLASSES[detail.valueTone ?? "default"]}>
                  {detail.value}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-1.5 pt-space-xs text-secondary font-body-sm text-body-sm">
            {item.details.map((detail) => (
              <div key={detail.label || detail.value} className="flex justify-between">
                <span>{detail.label}</span>
                <span className={`font-medium ${VALUE_TONE_CLASSES[detail.valueTone ?? "default"]}`}>
                  {detail.value}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
      <button
        className={`mt-space-md w-full ${compact ? "py-2 px-space-md rounded-lg font-body-medium text-body-medium" : "h-9 rounded font-caption-bold text-caption-bold"} transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed ${ACTION_CLASSES[item.action.tone][variant]}`}
        type="button"
        disabled
        title="Coming soon"
      >
        {item.action.icon ? (
          <span className="material-symbols-outlined text-[16px]">{item.action.icon}</span>
        ) : null}
        <span>{item.action.label}</span>
      </button>
    </div>
  );
}