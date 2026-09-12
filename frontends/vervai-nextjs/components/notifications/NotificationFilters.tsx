"use client";

type FilterTab = { id: string; label: string; count: number };

export const FILTER_TABS: FilterTab[] = [
  { id: "all", label: "All", count: 0 },
  { id: "error", label: "Errors", count: 0 },
  { id: "success", label: "Success", count: 0 },
  { id: "info", label: "Info", count: 0 },
  { id: "action", label: "Action", count: 0 },
];

export default function NotificationFilters({
  tabs = FILTER_TABS,
  activeId,
  onChange,
}: {
  tabs?: FilterTab[];
  activeId: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="px-space-lg pb-space-sm pt-space-xs bg-surface-container-lowest flex items-center gap-1.5 overflow-x-auto no-scrollbar">
      {tabs.map((tab) => {
        const active = tab.id === activeId;
        return (
          <button
            key={tab.id}
            className={`filter-tab ${
              active
                ? "active-tab bg-on-surface text-surface shadow-sm"
                : "bg-surface-container hover:bg-surface-container-high text-on-surface-variant"
            } font-caption-bold text-caption-bold px-space-sm py-1 rounded-full whitespace-nowrap transition-all flex items-center gap-1`}
            data-filter={tab.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(tab.id)}
          >
            <span>{tab.label}</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                active ? "bg-surface/20 text-surface" : "bg-surface-container-highest text-on-surface"
              }`}
            >
              {tab.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}