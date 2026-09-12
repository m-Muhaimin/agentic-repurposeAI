import type { ReactNode } from "react";

type DangerAction = {
  icon: string;
  iconClass: string;
  title: string;
  titleClass: string;
  description: ReactNode;
  action: { icon: string; label: string; className: string; chip?: boolean };
};

const DANGER_ACTIONS: DangerAction[] = [
  {
    icon: "folder_zip",
    iconClass: "text-primary text-[18px]",
    title: "Export Workspace Data",
    titleClass: "text-on-surface",
    description:
      "Download an archive of your workspace sources, generated outputs, and saved configuration as an open JSON/Vector manifest.",
    action: {
      icon: "download",
      label: "Export Workspace Archive",
      className:
        "flex items-center gap-2 bg-surface-container-highest hover:bg-surface-dim text-on-surface font-body-medium text-body-medium px-4 py-2 rounded-lg transition-all active:scale-[0.98] shadow-sm disabled:opacity-50 disabled:cursor-not-allowed",
    },
  },
  {
    icon: "delete_forever",
    iconClass: "text-error text-[18px]",
    title: "Close Account",
    titleClass: "text-error",
    description:
      "Closing your account removes access to this workspace, revokes personal tokens, and detaches linked identities. This cannot be undone.",
    action: {
      icon: "close",
      label: "Close Account & Revoke Access",
      className:
        "flex items-center gap-1.5 bg-error text-on-error hover:bg-on-error-container font-body-medium text-body-medium px-4 py-2 rounded-lg transition-all active:scale-[0.98] shadow-sm disabled:opacity-50 disabled:cursor-not-allowed",
      chip: true,
    },
  },
];

export default function DangerZone() {
  return (
    <section className="col-span-12 bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden">
      <div className="px-space-lg py-4 bg-error-container/40 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-error text-[20px]">warning</span>
          <div>
            <h2 className="font-headline-sm text-headline-sm text-on-surface">Data Sovereignty, Portability & Identity Deletion</h2>
            <p className="font-body-sm text-[12px] text-on-surface-variant">Export your workspace content or irrevocably close this account.</p>
          </div>
        </div>
        <span className="font-caption-bold text-caption-bold text-error uppercase tracking-wide">Danger Zone</span>
      </div>
      <div className="p-space-lg grid grid-cols-1 md:grid-cols-2 gap-space-lg items-center">
        {DANGER_ACTIONS.map((item) => (
          <div key={item.title} className="flex flex-col gap-2 p-space-md bg-surface-container-low rounded-xl">
            <div className={`flex items-center gap-2 font-headline-sm text-[15px] ${item.titleClass}`}>
              <span className={`material-symbols-outlined ${item.iconClass}`}>{item.icon}</span>
              <span>{item.title}</span>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant">{item.description}</p>
            <div className="mt-2">
              <button className={item.action.className} type="button" disabled title="Coming soon">
                <span className="material-symbols-outlined text-[18px]">{item.action.icon}</span>
                <span>
                  {item.action.label}
                  {item.action.chip ? (
                    <span className="font-label-caps text-[10px] text-on-surface-variant uppercase ml-1">Coming soon</span>
                  ) : null}
                </span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}