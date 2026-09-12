const TABS = [
  { id: "general-profile", icon: "tune", label: "General & Profile" },
  { id: "agent-defaults", icon: "smart_toy", label: "Agent Defaults" },
  { id: "notifications", icon: "notifications_active", label: "Notifications" },
  { id: "data-export", icon: "database", label: "Data & Export" },
];

export default function PreferencesTabs() {
  return (
    <nav className="flex items-center gap-1 p-1 bg-surface-container rounded-xl overflow-x-auto select-none shadow-sm">
      {TABS.map((tab) => (
        <a
          key={tab.id}
          href={`#${tab.id}`}
          className="flex items-center gap-2 px-space-md py-2 rounded-lg transition-all whitespace-nowrap text-on-surface-variant hover:text-on-surface hover:bg-surface-container-lowest font-body-medium text-body-medium"
        >
          <span className="material-symbols-outlined text-[18px]">{tab.icon}</span>
          <span>{tab.label}</span>
        </a>
      ))}
    </nav>
  );
}