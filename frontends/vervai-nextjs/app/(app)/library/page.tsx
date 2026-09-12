import LibraryHeader from "@/components/library/LibraryHeader";
import FeaturedExtraction, { type FeaturedSource } from "@/components/library/FeaturedExtraction";
import OutputRegistry from "@/components/library/OutputRegistry";
import CuratedMatrix from "@/components/library/CuratedMatrix";
import type { ContentCardItem } from "@/components/library/ContentCard";
import SourceLineageTable from "@/components/library/SourceLineageTable";
import LibraryFilterBar from "@/components/library/LibraryFilterBar";
import {
  getSourcesWithOutputs,
  getDistributionJobs,
  getRecentIdeas,
  timeAgo,
  formatDateTime,
  formatDuration,
  SOURCE_TYPE_META,
  FORMAT_LABEL,
  SOURCE_STATUS_LABEL,
  type OutputFormat,
} from "@/lib/data";

type ApprovalStatus =
  | { kind: "pending"; label: string }
  | { kind: "published"; label: string }
  | { kind: "neutral"; label: string };

type LineageRow = {
  fileName: string;
  fileMeta: string;
  icon: string;
  iconTone: "secondary" | "error" | "fixed";
  ingestedAt: string;
  outputCount: string;
  outputBreakdown: string;
  approval: ApprovalStatus;
  toneScore: string;
};

const FORMAT_TONE: Record<OutputFormat, "primary" | "secondary"> = {
  linkedin_post: "primary",
  newsletter: "secondary",
  shortform_script: "secondary",
  thread: "secondary",
  carousel: "secondary",
};

function sourceApproval(status: string, outputCount: number): ApprovalStatus {
  if (status === "done") return { kind: "published", label: "Ready" };
  if (status === "failed") return { kind: "neutral", label: "Failed" };
  if (status === "transcribing" || status === "generating")
    return { kind: "pending", label: "Processing" };
  return { kind: "neutral", label: SOURCE_STATUS_LABEL[status as keyof typeof SOURCE_STATUS_LABEL] ?? status };
}

export default async function Page() {
  const [sources, jobs, ideas] = await Promise.all([
    getSourcesWithOutputs(100),
    getDistributionJobs(100),
    getRecentIdeas(50),
  ]);

  const sourceCount = sources.length;
  const outputs = sources.flatMap((s) =>
    (s.outputs ?? []).map((o) => ({ ...o, sourceTitle: s.title })),
  );
  const outputTotal = outputs.length;
  const formatCounts = outputs.reduce<Record<string, number>>((acc, o) => {
    acc[o.format] = (acc[o.format] ?? 0) + 1;
    return acc;
  }, {});
  const latestOutput = outputs.sort((a, b) => b.created_at.localeCompare(a.created_at))[0];

  const featuredSource = sources.find((s) => (s.outputs?.length ?? 0) > 0 && s.status === "done");
  const featured: FeaturedSource | null = featuredSource
    ? {
        title: featuredSource.title,
        sourceTypeLabel: SOURCE_TYPE_META[featuredSource.source_type].label,
        formats: (featuredSource.outputs ?? [])
          .map((o) => FORMAT_LABEL[o.format] ?? o.format)
          .filter((v, i, arr) => arr.indexOf(v) === i),
        wordCount: (featuredSource.outputs ?? []).reduce(
          (acc, o) => acc + o.content.split(/\s+/).filter(Boolean).length,
          0,
        ),
        minutes: featuredSource.duration_seconds
          ? Math.max(1, Math.round(featuredSource.duration_seconds / 60))
          : 0,
        outputCount: featuredSource.outputs?.length ?? 0,
        needsReview: sources.length > 0 && sources.filter((s) => s.status === "generating").length > 0,
        featuredIdeaId: ideas.find((i) => !i.approved)?.id ?? null,
      }
    : null;

  const registryRows = (Object.keys(formatCounts) as OutputFormat[]).map((format) => ({
    icon:
      format === "linkedin_post"
        ? "article"
        : format === "newsletter"
          ? "mail"
          : format === "shortform_script"
            ? "smart_display"
            : format === "thread"
              ? "tag"
              : "view_carousel",
    iconTone: FORMAT_TONE[format] ?? "secondary",
    label:
      format === "linkedin_post"
        ? "LinkedIn Posts"
        : format === "newsletter"
          ? "Newsletters / Dispatch"
          : format === "shortform_script"
            ? "Video Scripts & Clips"
            : format === "thread"
              ? "Micro-Essays & Threads"
              : "Carousels",
    count: `${formatCounts[format]} ready`,
  }));

  const lineageRows: LineageRow[] = sources.map((s) => {
    const sOutputs = s.outputs ?? [];
    const breakdown = sOutputs.reduce<Record<string, number>>((acc, o) => {
      acc[o.format] = (acc[o.format] ?? 0) + 1;
      return acc;
    }, {});
    const breakdownLabel = Object.keys(breakdown)
      .map((f) => `${breakdown[f]} ${FORMAT_LABEL[f as OutputFormat]}`)
      .join(", ");
    return {
      fileName: s.title,
      fileMeta: `${SOURCE_TYPE_META[s.source_type].label}${
        s.duration_seconds ? ` • ${formatDuration(s.duration_seconds)}` : ""
      }`,
      icon: SOURCE_TYPE_META[s.source_type].icon,
      iconTone: s.status === "failed" ? "error" : s.status === "done" ? "fixed" : "secondary",
      ingestedAt: formatDateTime(s.created_at),
      outputCount: `${sOutputs.length} ${sOutputs.length === 1 ? "output" : "outputs"}`,
      outputBreakdown: breakdownLabel || "No outputs yet",
      approval: sourceApproval(s.status, sOutputs.length),
      toneScore: SOURCE_STATUS_LABEL[s.status],
    };
  });

  const counts = {
    all: outputTotal,
    review: ideas.filter((i) => !i.approved).length,
    ready: outputTotal,
    scheduled: jobs.filter((j) => j.status === "scheduled").length,
    published: jobs.filter((j) => j.status === "published").length,
  };

  const matrixItems: ContentCardItem[] = outputs.slice(0, 3).map((o, i) => {
    const words = o.content.split(/\s+/).filter(Boolean).length;
    const formatLabel = FORMAT_LABEL[o.format] ?? o.format;
    return {
      typeLabel: formatLabel,
      typeIcon:
        o.format === "linkedin_post"
          ? "article"
          : o.format === "newsletter"
            ? "mail"
            : o.format === "shortform_script"
              ? "movie"
              : o.format === "thread"
                ? "forum"
                : "view_carousel",
      typeTone: i % 2 ? "neutral" : "secondary",
      status: { kind: "ready", label: "Ready to Publish" },
      preview: {
        kind: "thread",
        authorInitials: "VA",
        authorName: "VervAI Agent",
        authorHandle: "@vervai",
        tweetIndex: `${i + 1}/${outputs.length}`,
        quote: o.content.slice(0, 140),
      },
      title: o.sourceTitle,
      description: o.content.length > 140 ? `${o.content.slice(0, 160)}…` : o.content,
      meta: `${words} words`,
      source: o.sourceTitle,
      actionLabel: "View Output",
      actionIcon: "open_in_new",
      outputId: o.id,
    };
  });

  return (
    <div className="flex flex-col w-full gap-y-space-xl">
      <LibraryHeader counts={counts} />
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg items-stretch">
        <FeaturedExtraction source={featured} />
        <OutputRegistry
          rows={registryRows}
          total={outputTotal}
          sourceCount={sourceCount}
          latestLabel={latestOutput ? timeAgo(latestOutput.created_at) : "—"}
        />
      </section>
      <CuratedMatrix items={matrixItems} />
      <SourceLineageTable rows={lineageRows} />
    </div>
  );
}