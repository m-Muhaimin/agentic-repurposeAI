export type NotificationSettings = {
  emailEnabled?: boolean;
  inAppEnabled?: boolean;
  slackEnabled?: boolean;
};

type NotificationRow = {
  title: string;
  category: string;
  categoryClass: string;
};

const NOTIFICATION_ROWS: NotificationRow[] = [
  { title: "Agent run finished processing", category: "Intake Loop", categoryClass: "text-outline" },
  { title: "Needs review queue has drafts", category: "Editorial", categoryClass: "text-outline" },
  { title: "Scheduled dispatch delivered", category: "Egress", categoryClass: "text-outline" },
];

type NotificationSettingsProps = {
  settings?: NotificationSettings;
};

export default function NotificationSettings({ settings }: NotificationSettingsProps) {
  const emailOn = settings?.emailEnabled ?? false;
  const inAppOn = settings?.inAppEnabled ?? false;
  const slackOn = settings?.slackEnabled ?? false;

  const channels = [
    {
      icon: emailOn ? "check" : "close",
      label: emailOn ? "Email: On" : "Email: Off",
      on: emailOn,
    },
    {
      icon: inAppOn ? "check" : "close",
      label: inAppOn ? "In-app: On" : "In-app: Off",
      on: inAppOn,
    },
    {
      icon: "webhook",
      label: slackOn ? "Slack: On" : "Slack: Off",
      on: slackOn,
    },
  ];

  return (
    <section
      id="notifications"
      className="lg:col-span-5 bg-surface-container-lowest rounded-xl p-space-xl shadow-sm flex flex-col justify-between gap-space-lg scroll-mt-8"
    >
      <div className="flex flex-col gap-space-md">
        <div className="flex items-center justify-between pb-space-xs">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary-fixed text-primary">
              <span className="material-symbols-outlined text-[20px]">notifications</span>
            </div>
            <div>
              <h2 className="font-headline-lg text-headline-lg text-on-surface">
                Notification & Relay Alerts
              </h2>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Control dispatch triggers across communication streams.
              </p>
            </div>
          </div>
        </div>
        <div className="space-y-3">
          {NOTIFICATION_ROWS.map((row) => (
            <div
              key={row.title}
              className="p-3.5 bg-surface-container-low rounded-xl flex flex-col gap-2"
            >
              <div className="flex items-center justify-between">
                <span className="font-headline-sm text-body-medium text-on-surface font-semibold">
                  {row.title}
                </span>
                <span className={`font-caption-bold text-[10px] uppercase tracking-wider ${row.categoryClass}`}>
                  {row.category}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {channels.map((channel) => (
                  <span
                    key={channel.label}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded font-caption-bold text-caption-bold ${
                      channel.on
                        ? "bg-primary-fixed text-primary"
                        : "bg-surface-container-highest text-on-surface-variant opacity-60"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[14px]">{channel.icon}</span>
                    {channel.label}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="p-4 bg-surface-container rounded-xl flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-on-surface-variant text-[24px]">hub</span>
          <div className="flex flex-col">
            <span className="font-body-medium text-body-sm font-semibold text-on-surface">
              Slack Webhook Relays
            </span>
            <span className="font-body-sm text-[12px] text-on-surface-variant">
              Not configured
            </span>
          </div>
        </div>
        <span className="px-2.5 py-1 rounded-full bg-surface-container-high text-on-surface-variant font-caption-bold text-[11px]">
          Off
        </span>
      </div>
      <p className="font-body-sm text-[12px] text-on-surface-variant">
        Notification preferences are not persisted yet — all channels default to off.
      </p>
    </section>
  );
}