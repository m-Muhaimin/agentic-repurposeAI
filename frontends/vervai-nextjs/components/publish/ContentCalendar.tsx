export type CalendarDay =
  | {
      kind: "published";
      day: string;
      dayClass?: string;
      label: string;
      labelClass: string;
      channel: string;
      channelClass: string;
      dotClass: string;
      title: string;
      description: string;
      stats: { icon: string; value: string }[];
      footer: string;
    }
  | {
      kind: "today";
      day: string;
    }
  | {
      kind: "scheduled";
      day: string;
      dayClass?: string;
      label: string;
      labelClass: string;
      channel: string;
      channelClass: string;
      dotClass: string;
      time: string;
      title: string;
      description: string;
      status: { icon: string; label: string; tone: "primary" | "secondary" };
    };

const WEEK: CalendarDay[] = [];

function PublishedDay({ day }: { day: Extract<CalendarDay, { kind: "published" }> }) {
  return (
    <div className="flex flex-col rounded-xl bg-surface-container-low/40 p-space-sm space-y-space-sm">
      <div className="flex items-center justify-between pb-1">
        <span className={`font-headline-sm text-headline-sm ${day.dayClass ?? "text-secondary"}`}>
          {day.day}
        </span>
        <span
          className={`font-label-caps text-[10px] px-2 py-0.5 rounded ${day.labelClass} font-bold uppercase`}
        >
          {day.label}
        </span>
      </div>
      <div className="flex-1 bg-surface-container-lowest rounded-lg p-3 space-y-2 shadow-xs flex flex-col justify-between">
        <div className="space-y-2">
          <div className={`flex items-center gap-1.5 font-caption-bold text-[11px] ${day.channelClass}`}>
            <span className={`w-2 h-2 rounded-full ${day.dotClass}`}></span>
            {day.channel}
          </div>
          <h4 className="font-caption-bold text-caption-bold text-on-surface line-clamp-2">
            {day.title}
          </h4>
          <p className="font-body-sm text-[12px] text-secondary line-clamp-3">{day.description}</p>
        </div>
        <div className="pt-2 bg-surface-container-low/50 rounded p-2 space-y-1">
          <div className="flex items-center justify-between text-[11px] font-caption-bold text-secondary">
            {day.stats.map((stat) => (
              <span key={stat.value} className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[13px]">{stat.icon}</span>
                {stat.value}
              </span>
            ))}
          </div>
          <div className="text-[10px] font-label-caps text-tertiary font-bold">{day.footer}</div>
        </div>
      </div>
    </div>
  );
}

function TodayDay({ day }: { day: Extract<CalendarDay, { kind: "today" }> }) {
  return (
    <div className="flex flex-col rounded-xl bg-surface-container-low/70 p-space-sm space-y-space-sm">
      <div className="flex items-center justify-between pb-1">
        <div className="flex items-center gap-1.5">
          <span className="font-headline-sm text-headline-sm text-primary font-bold">{day.day}</span>
          <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
        </div>
        <span className="font-label-caps text-[10px] px-2 py-0.5 rounded bg-surface-container-high text-secondary font-bold uppercase">
          Today
        </span>
      </div>
      <div className="flex-1 rounded-lg bg-surface-container-lowest/70 p-3 flex flex-col items-center justify-center text-center space-y-2">
        <span className="material-symbols-outlined text-[28px] text-secondary/60">event_busy</span>
        <div>
          <p className="font-caption-bold text-caption-bold text-on-surface">Queue Rest Day</p>
          <p className="font-body-sm text-[12px] text-secondary mt-0.5">
            No automatic dispatches configured.
          </p>
        </div>
        <button
          className="mt-2 text-[11px] font-caption-bold text-primary hover:underline flex items-center gap-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
          type="button"
          disabled
          title="Coming soon"
        >
          <span className="material-symbols-outlined text-[14px]">add</span>
          Add impromptu post
        </button>
      </div>
    </div>
  );
}

function ScheduledDay({ day }: { day: Extract<CalendarDay, { kind: "scheduled" }> }) {
  return (
    <div className="flex flex-col rounded-xl bg-surface-container-low/40 p-space-sm space-y-space-sm">
      <div className="flex items-center justify-between pb-1">
        <span className={`font-headline-sm text-headline-sm ${day.dayClass ?? "text-on-surface"}`}>
          {day.day}
        </span>
        <span
          className={`font-label-caps text-[10px] px-2 py-0.5 rounded ${day.labelClass} font-bold uppercase`}
        >
          {day.label}
        </span>
      </div>
      <div className="flex-1 bg-surface-container-lowest rounded-lg p-3 space-y-2 shadow-xs flex flex-col justify-between">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className={`flex items-center gap-1.5 font-caption-bold text-[11px] ${day.channelClass}`}>
              <span className={`w-2 h-2 rounded-full ${day.dotClass}`}></span>
              {day.channel}
            </span>
            <span className="text-[10px] font-label-caps text-secondary">{day.time}</span>
          </div>
          <h4 className="font-caption-bold text-caption-bold text-on-surface line-clamp-2">
            {day.title}
          </h4>
          <p className="font-body-sm text-[12px] text-secondary line-clamp-3">{day.description}</p>
        </div>
        <div className="pt-2 flex items-center justify-between">
          <span
            className={`inline-flex items-center gap-1 text-[11px] font-caption-bold ${
              day.status.tone === "primary" ? "text-primary" : "text-secondary"
            }`}
          >
            <span className="material-symbols-outlined text-[14px]">{day.status.icon}</span>
            {day.status.label}
          </span>
          <button
            className="text-secondary hover:text-on-surface p-1 disabled:opacity-50 disabled:cursor-not-allowed"
            type="button"
            disabled
            title="Coming soon"
          >
            <span className="material-symbols-outlined text-[16px]">more_vert</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ContentCalendar({
  days,
  rangeLabel,
}: {
  days: CalendarDay[];
  rangeLabel?: string;
}) {
  return (
    <section className="bg-surface-container-lowest rounded-xl shadow-sm flex flex-col">
      <div className="p-space-lg bg-surface-container-low/40 rounded-t-xl flex flex-col sm:flex-row sm:items-center justify-between gap-space-md">
        <div>
          <h2 className="font-headline-lg text-headline-lg text-on-surface">
            Scheduled Content Calendar &amp; Broadcast Queue
          </h2>
          <p className="font-body-sm text-body-sm text-secondary">
            {rangeLabel ?? "Live orchestration queue from your distribution jobs"}
          </p>
        </div>
        <div className="flex items-center gap-space-xs self-start sm:self-auto">
          <div className="inline-flex rounded-lg bg-surface-container p-0.5 shadow-xs">
            <button
              className="px-3 py-1 rounded-md bg-surface-container-lowest font-caption-bold text-caption-bold text-on-surface shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
              type="button"
              disabled
              title="Coming soon"
            >
              Queue View
            </button>
          </div>
          <div className="inline-flex items-center gap-1 pl-2">
            <span className="font-caption-bold text-caption-bold text-on-surface px-1">
              Upcoming
            </span>
          </div>
        </div>
      </div>
      <div className="p-space-lg">
        {days.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-space-md">
            {days.map((day) => {
              if (day.kind === "published") return <PublishedDay key={day.day + day.title} day={day} />;
              if (day.kind === "today") return <TodayDay key={day.day} day={day} />;
              return <ScheduledDay key={day.day + day.title} day={day} />;
            })}
          </div>
        ) : (
          <div className="rounded-xl bg-surface-container-low p-space-lg text-center text-secondary font-body-sm text-body-sm">
            No scheduled or published posts yet. Approved outputs will appear on the calendar.
          </div>
        )}
      </div>
    </section>
  );
}