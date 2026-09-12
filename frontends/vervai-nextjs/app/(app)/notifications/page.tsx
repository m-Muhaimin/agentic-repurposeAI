import NotificationCenter from "@/components/notifications/NotificationCenter";
import {
  type NotificationCardProps,
  type NotificationChip,
} from "@/components/notifications/NotificationCard";
import {
  getSourcesWithOutputs,
  getDistributionJobs,
  getRecentIdeas,
  getConnectionsState,
  timeAgo,
  formatDateTime,
  FORMAT_LABEL,
  PLATFORM_LABEL,
  SOURCE_STATUS_LABEL,
  OUTCOME_STATUS_LABEL,
  type OutputFormat,
  type OutputRow,
} from "@/lib/data";

const FORMAT_ICON: Record<OutputFormat, string> = {
  linkedin_post: "article",
  newsletter: "mail",
  shortform_script: "movie",
  thread: "tag",
  carousel: "view_carousel",
};

const ERROR_BADGE =
  "font-label-caps text-label-caps bg-error-container text-on-error-container px-space-xs py-0.5 rounded font-bold uppercase";
const SUCCESS_BADGE =
  "font-label-caps text-label-caps bg-tertiary-fixed text-on-tertiary-fixed px-space-xs py-0.5 rounded uppercase";
const INFO_BADGE = "font-caption-bold text-caption-bold text-on-surface-variant";
const ACTION_BADGE =
  "font-label-caps text-label-caps bg-secondary-container text-on-secondary-fixed px-space-xs py-0.5 rounded font-bold uppercase";

const ERROR_BUTTON =
  "bg-error hover:bg-on-error-container text-on-error font-body-medium text-body-sm px-space-md py-1.5 rounded-lg transition-all active:scale-[0.98] shadow-sm flex items-center gap-1";
const REVIEW_BUTTON =
  "bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-body-medium text-body-sm px-space-md py-1.5 rounded-lg transition-colors flex items-center gap-1";
const PRIMARY_BUTTON =
  "bg-primary hover:bg-primary-container text-on-primary font-body-medium text-body-sm px-space-md py-1.5 rounded-lg transition-all active:scale-[0.98] shadow-sm flex items-center gap-1";

const STATUS_META: Record<"error" | "success" | "info" | "action", { barClass: string; icon: string; iconClass: string }> = {
  error: { barClass: "bg-error", icon: "error", iconClass: "text-error" },
  success: { barClass: "bg-primary", icon: "check_circle", iconClass: "text-primary" },
  info: { barClass: "bg-outline-variant", icon: "event", iconClass: "text-on-surface-variant" },
  action: { barClass: "bg-primary-container", icon: "rate_review", iconClass: "text-primary" },
};

function formatChips(outputs: OutputRow[]): NotificationChip[] {
  const counts = outputs.reduce<Record<string, number>>((acc, o) => {
    acc[o.format] = (acc[o.format] ?? 0) + 1;
    return acc;
  }, {});
  return (Object.entries(counts) as [OutputFormat, number][]).map(([format, count]) => ({
    icon: FORMAT_ICON[format] ?? "article",
    iconClass: "text-primary",
    label: `${count}x ${FORMAT_LABEL[format]}`,
  }));
}

export default async function Page() {
  const [sources, jobs, ideas, connections] = await Promise.all([
    getSourcesWithOutputs(60),
    getDistributionJobs(100),
    getRecentIdeas(50),
    getConnectionsState(),
  ]);

  const entries: { ts: string; notification: NotificationCardProps }[] = [];

  for (const source of sources) {
    const outputs = source.outputs ?? [];
    if (source.status === "failed") {
      entries.push({
        ts: source.created_at,
        notification: {
          category: "error",
          ...STATUS_META.error,
          title: "Source ingestion failed",
          badge: { label: SOURCE_STATUS_LABEL[source.status], className: ERROR_BADGE },
          time: timeAgo(source.created_at),
          description: (
            <>
              Ingestion failed for <span className="text-on-surface font-body-medium">{source.title}</span>. No outputs were produced.
            </>
          ),
          body: { type: "none" },
          footer: {
            type: "error",
            wrapperClass: "flex items-center justify-between pt-space-xs",
            button: { label: "Review source", icon: "search", className: ERROR_BUTTON },
            status: (
              <span className="font-body-sm text-[11px] text-on-surface-variant flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">error_outline</span>
                {SOURCE_STATUS_LABEL[source.status]}
              </span>
            ),
          },
        },
      });
    } else if (source.status === "done" && outputs.length > 0) {
      entries.push({
        ts: source.created_at,
        notification: {
          category: "success",
          ...STATUS_META.success,
          title: "Outputs ready",
          badge: { label: SOURCE_STATUS_LABEL[source.status], className: SUCCESS_BADGE },
          time: timeAgo(source.created_at),
          description: (
            <>
              {outputs.length} {outputs.length === 1 ? "output" : "outputs"} generated for{" "}
              <span className="text-on-surface font-body-medium">{source.title}</span>.
            </>
          ),
          body: { type: "chips", chips: formatChips(outputs) },
          footer: {
            type: "actions",
            wrapperClass: "flex items-center justify-between pt-space-xs",
            buttons: [{ label: "Review drafts", icon: "article", className: REVIEW_BUTTON }],
          },
        },
      });
    }
  }

  for (const job of jobs) {
    if (job.status === "failed") {
      entries.push({
        ts: job.created_at,
        notification: {
          category: "error",
          ...STATUS_META.error,
          title: "Distribution failed",
          badge: { label: OUTCOME_STATUS_LABEL[job.status], className: ERROR_BADGE },
          time: timeAgo(job.created_at),
          description: (
            <>
              Publishing to <span className="text-on-surface font-body-medium">{PLATFORM_LABEL[job.platform]}</span> failed. The post was not published.
            </>
          ),
          body: { type: "none" },
          footer: {
            type: "error",
            wrapperClass: "flex items-center justify-between pt-space-xs",
            button: { label: "Review job", icon: "search", className: ERROR_BUTTON },
            status: (
              <span className="font-body-sm text-[11px] text-on-surface-variant flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">error_outline</span>
                {OUTCOME_STATUS_LABEL[job.status]}
              </span>
            ),
          },
        },
      });
    } else if (job.status === "scheduled") {
      const when = job.scheduled_at ?? job.created_at;
      entries.push({
        ts: when,
        notification: {
          category: "info",
          ...STATUS_META.info,
          title: "Post scheduled",
          badge: { label: OUTCOME_STATUS_LABEL[job.status], className: INFO_BADGE },
          time: timeAgo(when),
          description: (
            <>
              A <span className="text-on-surface font-body-medium">{PLATFORM_LABEL[job.platform]}</span> post is scheduled for distribution.
            </>
          ),
          body: { type: "none" },
          footer: {
            type: "actions",
            wrapperClass: "flex items-center justify-between",
            buttons: [],
            trailing: (
              <span className="font-caption-bold text-[11px] text-on-surface-variant">
                {formatDateTime(when)}
              </span>
            ),
          },
        },
      });
    }
  }

  for (const idea of ideas) {
    if (!idea.approved) {
      entries.push({
        ts: idea.created_at,
        notification: {
          category: "action",
          ...STATUS_META.action,
          title: "Idea awaiting approval",
          badge: { label: "Pending", className: ACTION_BADGE },
          time: timeAgo(idea.created_at),
          description: (
            <>
              <span className="text-on-surface font-body-medium">{idea.title}</span> needs your approval before it can be developed.
            </>
          ),
          body: { type: "none" },
          footer: {
            type: "actions",
            wrapperClass: "flex items-center justify-between pt-space-xs",
            buttons: [{ label: "Review idea", icon: "check", className: PRIMARY_BUTTON }],
          },
        },
      });
    }
  }

  const notifications = entries
    .sort((a, b) => b.ts.localeCompare(a.ts))
    .slice(0, 10)
    .map((e) => e.notification);

  return (
    <div className="flex flex-col w-full relative">
      <NotificationCenter notifications={notifications} connections={connections} />
    </div>
  );
}