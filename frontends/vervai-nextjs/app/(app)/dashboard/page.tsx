import PageHeading from "@/components/ui/PageHeading";
import Icon from "@/components/ui/Icon";
import { Button, ButtonLink } from "@/components/ui/Button";
import IntakePanel, { type RecentSource } from "@/components/dashboard/IntakePanel";
import NeedsReviewPanel, { type Review } from "@/components/dashboard/NeedsReviewPanel";
import AgentOpportunitiesPanel, { type Opportunity } from "@/components/dashboard/AgentOpportunitiesPanel";
import RecentContentPanel, { type ContentItem } from "@/components/dashboard/RecentContentPanel";
import OverviewKpis, { type Kpi } from "@/components/dashboard/OverviewKpis";
import type { TagTone } from "@/components/ui/Tag";
import {
  getSourcesWithOutputs,
  getDistributionJobs,
  getRecentIdeas,
  getConnectionsState,
  timeAgo,
  type SourceRow,
  type OutputFormat,
  type DistributionJobRow,
} from "@/lib/data";

const FORMAT_CHANNEL: Record<OutputFormat, { label: string; tone: TagTone }> = {
  linkedin_post: { label: "LinkedIn", tone: "primary" },
  newsletter: { label: "Newsletter", tone: "secondary" },
  shortform_script: { label: "Short-form", tone: "surface" },
  thread: { label: "Twitter / X", tone: "surface" },
  carousel: { label: "Carousel", tone: "surface" },
};

const FORMAT_TILE: Record<OutputFormat, { label: string; labelTone: TagTone }> = {
  linkedin_post: { label: "LinkedIn", labelTone: "primary" },
  newsletter: { label: "Newsletter", labelTone: "tertiary" },
  shortform_script: { label: "Script", labelTone: "secondary" },
  thread: { label: "Thread", labelTone: "neutral" },
  carousel: { label: "Carousel", labelTone: "neutral" },
};

const OPPORTUNITY_ICON: Record<OutputFormat, string> = {
  linkedin_post: "article",
  newsletter: "email",
  shortform_script: "movie",
  thread: "tag",
  carousel: "view_carousel",
};

const PLATFORM_META: Record<DistributionJobRow["platform"], { icon: string; label: string }> = {
  linkedin: { icon: "in", label: "LinkedIn" },
  x: { icon: "𝕏", label: "Twitter / X" },
  newsletter: { icon: "mail", label: "Newsletter" },
  youtube_shorts: { icon: "play_arrow", label: "YT Shorts" },
  tiktok: { icon: "music_note", label: "TikTok" },
  instagram: { icon: "photo_camera", label: "Instagram" },
};

function wordCount(content: string): number {
  return content.split(/\s+/).filter(Boolean).length;
}

export default async function Page() {
  const [sources, jobs, ideas, connections] = await Promise.all([
    getSourcesWithOutputs(60),
    getDistributionJobs(100),
    getRecentIdeas(50),
    getConnectionsState(),
  ]);

  const outputs = sources.flatMap((s: SourceRow) =>
    (s.outputs ?? []).map((o) => ({ ...o, sourceTitle: s.title })),
  );
  const outputTotal = outputs.length;
  const lastOutput = outputs.sort((a, b) => b.created_at.localeCompare(a.created_at))[0];

  const sourceTotal = sources.length;
  const lastSource = sources[0];
  const sourceTypeCounts = sources.reduce<Record<string, number>>((acc, s) => {
    acc[s.source_type] = (acc[s.source_type] ?? 0) + 1;
    return acc;
  }, {});

  const queuedJobs = jobs.filter(
    (j) => j.status === "draft" || j.status === "scheduled",
  );
  const queuedByPlatform = queuedJobs.reduce<Record<string, number>>((acc, j) => {
    acc[j.platform] = (acc[j.platform] ?? 0) + 1;
    return acc;
  }, {});

  const outputFormatCounts = outputs.reduce<Record<string, number>>((acc, o) => {
    acc[o.format] = (acc[o.format] ?? 0) + 1;
    return acc;
  }, {});

  const kpis: Kpi[] = [
    {
      label: "Source Repositories",
      icon: "database",
      value: String(sourceTotal),
      unit: sourceTotal === 1 ? "active source" : "active sources",
      description: "Cataloged into semantic search vector space.",
      rows: (Object.keys(sourceTypeCounts) as (keyof typeof sourceTypeCounts)[]).map((type) => ({
        icon:
          type === "audio"
            ? "mic"
            : type === "video"
              ? "videocam"
              : type === "youtube"
                ? "smart_display"
                : "description",
        label:
          type === "audio"
            ? "Audio recordings"
            : type === "video"
              ? "Video files"
              : type === "youtube"
                ? "YouTube sources"
                : "Text documents",
        value: String(sourceTypeCounts[type]),
      })),
      footerLeft: "Sync state",
      footerRight: (
        <>
          <span className="w-1.5 h-1.5 rounded-full bg-tertiary" /> {lastSource ? timeAgo(lastSource.created_at) : "no sources"}
        </>
      ),
    },
    {
      label: "Distribution Pipeline",
      icon: "send",
      iconTone: "text-primary",
      value: `${queuedJobs.length}`,
      unit: queuedJobs.length === 1 ? "post queued" : "posts queued",
      description: "Real pipeline scheduled through connected channels.",
      rows: (Object.keys(queuedByPlatform) as (keyof typeof PLATFORM_META)[]).map(
        (platform) => ({
          icon: PLATFORM_META[platform].icon,
          label: PLATFORM_META[platform].label,
          value: `${queuedByPlatform[platform]} queued`,
        }),
      ),
      footerLeft: "Connector",
      footerRight: (
        <>
          <Icon name="link" size={14} className="text-tertiary" />{" "}
          {connections.buffer ? "Buffer Connected" : "No Buffer key"}
        </>
      ),
    },
    {
      label: "Outputs Generated",
      icon: "speed",
      value: String(outputTotal),
      unit: outputTotal === 1 ? "output" : "outputs",
      description: "Synthesized deliverables across your source nodes.",
      rows: (Object.keys(outputFormatCounts) as (keyof typeof outputFormatCounts)[]).map(
        (format) => ({
          icon:
            format === "linkedin_post"
              ? "article"
              : format === "newsletter"
                ? "mail"
                : format === "shortform_script"
                  ? "movie"
                  : format === "thread"
                    ? "tag"
                    : "view_carousel",
          label:
            format === "linkedin_post"
              ? "LinkedIn Posts"
              : format === "newsletter"
                ? "Newsletters"
                : format === "shortform_script"
                  ? "Short-Form Scripts"
                  : format === "thread"
                    ? "Threads"
                    : "Carousels",
          value: String(outputFormatCounts[format]),
        }),
      ),
      footerLeft: "Latest",
      footerRight: lastOutput ? timeAgo(lastOutput.created_at) : "no outputs",
    },
  ];

  const recentIntake: RecentSource[] = sources.slice(0, 3).map((s) => ({
    icon:
      s.source_type === "audio"
        ? "graphic_eq"
        : s.source_type === "video"
          ? "videocam"
          : s.source_type === "youtube"
            ? "smart_display"
            : "description",
    iconTone:
      s.source_type === "audio"
        ? "text-tertiary"
        : s.source_type === "video"
          ? "text-primary"
          : "text-secondary",
    name: s.title,
  }));

  const reviews: Review[] = ideas
    .filter((idea) => !idea.approved)
    .slice(0, 3)
    .map((idea) => {
      const fmt = idea.suggested_formats[0] ?? "linkedin_post";
      const channel = FORMAT_CHANNEL[fmt] ?? FORMAT_CHANNEL.linkedin_post;
      return {
        channel: channel.label,
        channelTone: channel.tone,
        match: "Awaiting approval",
        title: idea.title,
        meta:
          idea.rationale ??
          idea.description ??
          "Top angle surfaced from your latest ingested source.",
      };
    });

  const opportunities: Opportunity[] = ideas
    .filter((idea) => idea.approved)
    .slice(0, 3)
    .map((idea, i) => {
      const fmt = idea.suggested_formats[0] ?? "linkedin_post";
      const tones: TagTone[] = ["tertiary", "secondary", "primary"];
      return {
        icon: OPPORTUNITY_ICON[fmt] ?? "auto_awesome",
        iconTone: i === 0 ? "text-primary" : "text-secondary",
        title: idea.title,
        tagLabel: `${idea.suggested_formats.length} ${idea.suggested_formats.length === 1 ? "format" : "formats"}`,
        tagTone: tones[i % tones.length],
        description:
          idea.description ??
          idea.rationale ??
          "Angle detected from your latest ingested sources.",
      };
    });

  const contents: ContentItem[] = outputs.slice(0, 6).map((o) => {
    const tile = FORMAT_TILE[o.format] ?? FORMAT_TILE.linkedin_post;
    return {
      label: tile.label,
      labelTone: tile.labelTone,
      image: null,
      imageAlt: tile.label,
      title: o.sourceTitle,
      meta: formatMeta(o),
      status: "Ready",
      statusTone: "brand",
    };
  });

  function formatMeta(o: { format: OutputFormat; content: string }) {
    if (o.format === "shortform_script") {
      const words = wordCount(o.content);
      return `${Math.max(1, Math.round(words / 150))} min read`;
    }
    if (o.format === "carousel") return `${Math.max(1, Math.round(wordCount(o.content) / 120))} slides`;
    return `${wordCount(o.content)} words`;
  }

  return (
    <div className="flex flex-col w-full">
      <PageHeading
        eyebrow="Autonomous Operations"
        title="Workspace Overview"
        subtitle="Your content pipeline, live from the database."
        actions={
          <>
            <Button variant="secondary" size="md">
              <Icon name="calendar_today" size={16} className="text-secondary" />
              This week
              <Icon name="expand_more" size={14} className="text-outline" />
            </Button>
            <ButtonLink href="/source-intake">
              <Icon name="upload_file" size={18} />
              Upload source
            </ButtonLink>
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter mb-gutter">
        <IntakePanel recentSources={recentIntake} />
        <NeedsReviewPanel reviews={reviews} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter mb-gutter">
        <AgentOpportunitiesPanel opportunities={opportunities} count={opportunities.length} />
        <RecentContentPanel
          contents={contents}
          total={outputTotal}
          updatedLabel={lastSource ? timeAgo(lastSource.created_at) : "never"}
        />
      </div>

      <OverviewKpis kpis={kpis} />
    </div>
  );
}