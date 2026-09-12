import PublishHeader from "@/components/publish/PublishHeader";
import ReadyToPublish from "@/components/publish/ReadyToPublish";
import type { ApprovalCardItem } from "@/components/publish/ApprovalCard";
import ConnectedChannels from "@/components/publish/ConnectedChannels";
import DispatchTelemetry from "@/components/publish/DispatchTelemetry";
import ContentCalendar from "@/components/publish/ContentCalendar";
import type { CalendarDay } from "@/components/publish/ContentCalendar";
import {
  getSourcesWithOutputs,
  getDistributionJobs,
  getConnectionsState,
  timeAgo,
  formatDate,
  PLATFORM_LABEL,
} from "@/lib/data";

const CHANNEL_TONE: Record<string, "blue" | "orange" | "red"> = {
  linkedin: "blue",
  newsletter: "orange",
  x: "red",
  youtube_shorts: "red",
  tiktok: "red",
  instagram: "red",
};

const CHANNEL_ICON: Record<string, string> = {
  linkedin: "share",
  newsletter: "mail",
  x: "tag",
  youtube_shorts: "smart_display",
  tiktok: "movie",
  instagram: "photo_camera",
};

function formatDayShort(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    day: "numeric",
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function wordCount(content: string): number {
  return content.split(/\s+/).filter(Boolean).length;
}

export default async function Page() {
  const [sources, jobs, connections] = await Promise.all([
    getSourcesWithOutputs(100),
    getDistributionJobs(200),
    getConnectionsState(),
  ]);

  const outputs = sources.flatMap((s) =>
    (s.outputs ?? []).map((o) => ({ ...o, sourceTitle: s.title })),
  );
  const outputMap = new Map(outputs.map((o) => [o.id, o]));

  const draftJobs = jobs.filter((j) => j.status === "draft");
  const scheduledJobs = jobs.filter((j) => j.status === "scheduled");
  const publishedJobs = jobs.filter((j) => j.status === "published");
  const failedJobs = jobs.filter((j) => j.status === "failed");
  const queueCount = draftJobs.length + scheduledJobs.length;

  const approvals: ApprovalCardItem[] = draftJobs.slice(0, 4).map((job) => {
    const out = job.output_id ? outputMap.get(job.output_id) : null;
    const title = out?.sourceTitle ?? PLATFORM_LABEL[job.platform] ?? "Untitled output";
    const content = out?.content ?? "";
    const tone = CHANNEL_TONE[job.platform] ?? "blue";
    return {
      jobId: job.id,
      scheduledAt: job.scheduled_at,
      channel: PLATFORM_LABEL[job.platform] ?? job.platform,
      channelTone: tone,
      channelIcon: CHANNEL_ICON[job.platform] ?? "send",
      channelMeta: job.scheduled_at
        ? `Scheduled ${formatDate(job.scheduled_at)}`
        : "Awaiting scheduling",
      title,
      slot: job.scheduled_at ? `${formatDate(job.scheduled_at)} at ${formatTime(job.scheduled_at)}` : "No slot assigned",
      slotTone: job.scheduled_at ? "primary" : "neutral",
      slotHint: "Awaiting approval",
      preview: {
        kind: "document" as const,
        icon: "article",
        text: content.length > 180 ? `${content.slice(0, 180)}…` : content || "No preview available.",
      },
      validation: {
        icon: "auto_awesome",
        label: `Generated output • ${out ? `${wordCount(content)} words` : "N/A"}`,
      },
      secondaryAction: "Edit Draft",
    };
  });

  const channels: {
    monogram: string;
    monogramClass: string;
    name: string;
    meta: string;
    status: string;
    statusIcon: string;
  }[] = [];
  if (connections.buffer) {
    channels.push({
      monogram: "B",
      monogramClass: "bg-blue-600",
      name: "Buffer Pipeline",
      meta: `@${connections.buffer.username}`,
      status: "Synchronized",
      statusIcon: "check_circle",
    });
  }

  const nextScheduled = scheduledJobs
    .filter((j) => j.scheduled_at)
    .sort((a, b) => a.scheduled_at!.localeCompare(b.scheduled_at!))[0];

  const calendarDays: CalendarDay[] = [
    {
      kind: "today",
      day: formatDayShort(new Date().toISOString()),
    },
    ...scheduledJobs.slice(0, 4).map((job, i): CalendarDay => {
      const out = job.output_id ? outputMap.get(job.output_id) : null;
      return {
        kind: "scheduled",
        day: job.scheduled_at ? formatDayShort(job.scheduled_at) : `Slot ${i + 1}`,
        label: "Scheduled",
        labelClass: "bg-blue-100 text-blue-900",
        channel: PLATFORM_LABEL[job.platform] ?? job.platform,
        channelClass: "text-blue-800",
        dotClass: "bg-blue-700",
        time: job.scheduled_at ? formatTime(job.scheduled_at) : "—",
        title: out?.sourceTitle ?? "Output",
        description: PLATFORM_LABEL[job.platform] ?? "Distribution platform",
        status: { icon: "check", label: "Queued", tone: "primary" },
      };
    }),
    ...publishedJobs.slice(0, 2).map((job): CalendarDay => {
      const out = job.output_id ? outputMap.get(job.output_id) : null;
      return {
        kind: "published",
        day: job.published_at ? formatDayShort(job.published_at) : "—",
        label: "Published",
        labelClass: "bg-emerald-100 text-emerald-900",
        channel: PLATFORM_LABEL[job.platform] ?? job.platform,
        channelClass: "text-blue-800",
        dotClass: "bg-blue-700",
        title: out?.sourceTitle ?? "Post",
        description: PLATFORM_LABEL[job.platform] ?? "Published content",
        stats: [{ icon: "check_circle", value: "Published" }],
        footer: job.published_at ? formatDate(job.published_at) : "Published",
      };
    }),
  ];

  return (
    <div className="flex flex-col w-full space-y-space-xl">
      <PublishHeader
        queueCount={queueCount}
        bufferLabel={connections.buffer ? `Synced ${timeAgo(connections.buffer.created_at)}` : "Not connected"}
      />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg items-start">
        <ReadyToPublish items={approvals} total={approvals.length} />
        <aside className="lg:col-span-5 space-y-space-lg">
          <ConnectedChannels channels={channels} updatedLabel={timeAgo(new Date().toISOString())} />
          <DispatchTelemetry
            published={publishedJobs.length}
            failed={failedJobs.length}
            scheduled={scheduledJobs.length}
            draft={draftJobs.length}
          />
        </aside>
      </div>
      <ContentCalendar days={calendarDays} />
    </div>
  );
}