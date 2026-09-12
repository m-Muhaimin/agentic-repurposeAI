import ConnectorSection from "@/components/connections/ConnectorSection";
import CheckAllStatuses from "@/components/connections/CheckAllStatuses";
import type { ConnectorCardItem } from "@/components/connections/ConnectorCard";
import {
  getConnectionsState,
  getSourcesWithOutputs,
  getDistributionJobs,
  getProfile,
  timeAgo,
  SOURCE_STATUS_LABEL,
  PLATFORM_LABEL,
  FORMAT_LABEL,
  type DistributionJobRow,
} from "@/lib/data";

const PLATFORM_RELAY_META: Record<
  DistributionJobRow["platform"],
  { icon: string; iconTone: string }
> = {
  linkedin: { icon: "share", iconTone: "primary" },
  x: { icon: "tag", iconTone: "on-surface" },
  newsletter: { icon: "mark_email_read", iconTone: "on-surface-variant" },
  youtube_shorts: { icon: "smart_display", iconTone: "error" },
  tiktok: { icon: "music_note", iconTone: "secondary" },
  instagram: { icon: "photo_camera", iconTone: "primary-container" },
};

function sourceConnectors(
  connections: Awaited<ReturnType<typeof getConnectionsState>>,
): ConnectorCardItem[] {
  const drive = connections.drive;
  const youtube = connections.youtube;
  return [
    drive
      ? {
          icon: "folder_shared",
          iconTone: "primary-container",
          status: { label: "Connected", tone: "active" },
          title: "Google Drive",
          description: drive.drive_name || "Workspace storage connected",
          details: [
            { label: "Email:", value: drive.drive_email },
            { label: "Connected:", value: timeAgo(drive.created_at), valueTone: "tertiary" },
          ],
          action: { label: "Manage Sync Paths", tone: "default" },
        }
      : {
          icon: "folder_shared",
          iconTone: "primary-container",
          status: { label: "Available", tone: "available" },
          title: "Google Drive",
          description: "Auto-sync a source intake folder from your Drive.",
          details: [{ label: "Status:", value: "No OAuth connection", valueTone: "tertiary" }],
          action: { label: "+ Connect OAuth", tone: "connect" },
        },
    youtube
      ? {
          icon: "smart_display",
          iconTone: "error",
          status: { label: "Connected", tone: "active" },
          title: "YouTube & Workspace",
          description: `Channel: ${youtube.channel_title}`,
          details: [
            { label: "Channel:", value: youtube.channel_title, valueTone: "tertiary" },
            { label: "Connected:", value: timeAgo(youtube.created_at) },
          ],
          action: { label: "Manage Channel Watch", tone: "default" },
        }
      : {
          icon: "smart_display",
          iconTone: "error",
          status: { label: "Available", tone: "available" },
          title: "YouTube & Workspace",
          description: "Ingest captions from your own YouTube channel.",
          details: [{ label: "Status:", value: "No OAuth connection", valueTone: "tertiary" }],
          action: { label: "+ Connect OAuth", tone: "connect" },
        },
  ];
}

function publishingRelays(
  connections: Awaited<ReturnType<typeof getConnectionsState>>,
  jobs: DistributionJobRow[],
): ConnectorCardItem[] {
  const buffer = connections.buffer;

  const byPlatform = new Map<DistributionJobRow["platform"], DistributionJobRow[]>();
  for (const job of jobs) {
    const list = byPlatform.get(job.platform) ?? [];
    list.push(job);
    byPlatform.set(job.platform, list);
  }

  const platformRelays: ConnectorCardItem[] = Array.from(byPlatform.entries())
    .sort((a, b) => b[1].length - a[1].length)
    .map(([platform, platformJobs]) => {
      const scheduled = platformJobs.filter((j) => j.status === "scheduled").length;
      const published = platformJobs.filter((j) => j.status === "published").length;
      const meta = PLATFORM_RELAY_META[platform];
      return {
        icon: meta.icon,
        iconTone: meta.iconTone,
        status: { label: `${platformJobs.length} tracked`, tone: "stable" },
        title: `${PLATFORM_LABEL[platform]} Relay`,
        description: "Distribution relay fed from your publish queue.",
        details: [
          { label: "Scheduled:", value: String(scheduled) },
          {
            label: "Published:",
            value: String(published),
            valueTone: published > 0 ? "primary" : "default",
          },
        ],
        action: { label: "View Publish Queue", tone: "default" },
      };
    });

  const bufferItem: ConnectorCardItem = buffer
    ? {
        icon: "layers",
        iconTone: "primary-container",
        status: { label: "Connected", tone: "stable" },
        title: "Buffer Pipeline",
        description: `Connected Buffer account: @${buffer.username}`,
        details: [
          { label: "Account:", value: `@${buffer.username}` },
          {
            label: "Queued:",
            value: `${jobs.filter((j) => j.status === "scheduled").length} scheduled`,
            valueTone: "primary",
          },
        ],
        action: { label: "Test Webhook Relay", tone: "default" },
      }
    : {
        icon: "layers",
        iconTone: "primary-container",
        status: { label: "Available", tone: "available" },
        title: "Buffer Pipeline",
        description: "Schedule LinkedIn, X, and more via a Buffer connection.",
        details: [{ label: "Status:", value: "No Buffer key", valueTone: "tertiary" }],
        action: { label: "+ Connect OAuth", tone: "connect" },
      };

  return [bufferItem, ...platformRelays];
}

export default async function Page() {
  const [connections, sources, jobs, profile] = await Promise.all([
    getConnectionsState(),
    getSourcesWithOutputs(100),
    getDistributionJobs(200),
    getProfile(),
  ]);

  const connectedCount = [connections.buffer, connections.youtube, connections.drive].filter(
    Boolean,
  ).length;
  const sourceConnectedCount = [connections.drive, connections.youtube].filter(Boolean).length;

  const scheduledCount = jobs.filter((j) => j.status === "scheduled").length;
  const publishedCount = jobs.filter((j) => j.status === "published").length;
  const draftCount = jobs.filter((j) => j.status === "draft").length;
  const failedCount = jobs.filter((j) => j.status === "failed").length;
  const queuedCount = draftCount + failedCount;

  const allOutputs = sources.flatMap((s) => s.outputs ?? []);
  const sourceStatusCounts = new Map<string, number>();
  for (const s of sources) {
    sourceStatusCounts.set(s.status, (sourceStatusCounts.get(s.status) ?? 0) + 1);
  }
  const outputFormatCounts = new Map<string, number>();
  for (const o of allOutputs) {
    outputFormatCounts.set(o.format, (outputFormatCounts.get(o.format) ?? 0) + 1);
  }
  const readySources = sources.filter((s) => s.status === "done").length;
  const platformRelayCount = new Set(jobs.map((j) => j.platform)).size;
  const sourceStatusRows = Object.entries(SOURCE_STATUS_LABEL)
    .map(([status, label]) => ({ status, label, count: sourceStatusCounts.get(status) ?? 0 }))
    .filter((r) => r.count > 0);
  const outputFormatRows = Object.entries(FORMAT_LABEL)
    .map(([format, label]) => ({ format, label, count: outputFormatCounts.get(format) ?? 0 }))
    .filter((r) => r.count > 0);

  void profile;

  return (
    <div className="flex flex-col w-full space-y-space-xl">
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-space-md">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-secondary font-label-caps text-label-caps uppercase tracking-wider">
            <span>Workspace</span>
            <span className="text-outline-variant">/</span>
            <span className="text-primary font-bold">Integration &amp; Relay Ecosystem</span>
          </div>
          <h1 className="font-headline-lg text-display-xl md:text-display-2xl text-on-surface tracking-tight">
            System Connections &amp; Infrastructure
          </h1>
          <p className="font-body-medium text-body-medium text-secondary max-w-3xl">
            Manage OAuth authentications, webhook pipelines, source intake connectors, and scheduled
            distribution endpoints. Status reflects the rows in your live workspace database.
          </p>
        </div>
        <div className="flex items-center gap-space-sm shrink-0">
          <CheckAllStatuses />
          <button
            className="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg bg-primary text-on-primary font-caption-bold text-caption-bold shadow-sm hover:bg-primary-container transition-colors active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            type="button"
            disabled
            title="Coming soon"
          >
            <span className="material-symbols-outlined text-[18px]">add_link</span>
            <span>Add Integration</span>
            <span className="font-label-caps text-[10px] text-on-surface-variant uppercase ml-1">Coming soon</span>
          </button>
        </div>
      </section>

      <section className="flex flex-col space-y-space-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md">
          <div className="p-space-lg rounded-xl bg-surface-container-lowest shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="font-label-caps text-label-caps text-secondary uppercase tracking-wider">
                Connected Services
              </span>
              <span className="w-2.5 h-2.5 rounded-full bg-tertiary"></span>
            </div>
            <div className="mt-space-md flex items-baseline justify-between">
              <div className="font-headline-lg text-display-xl text-on-surface">
                {connectedCount}{" "}
                <span className="text-body-sm font-body-sm text-secondary font-normal">
                  of 3 relays
                </span>
              </div>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-tertiary-fixed text-on-tertiary-fixed font-caption-bold text-[11px]">
                <span className="material-symbols-outlined text-[14px]">check_circle</span>
                {connectedCount > 0 ? "Operational" : "Waiting for first connection"}
              </span>
            </div>
          </div>
          <div className="p-space-lg rounded-xl bg-surface-container-lowest shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="font-label-caps text-label-caps text-secondary uppercase tracking-wider">
                Scheduled Posts
              </span>
              <span className="material-symbols-outlined text-[16px] text-primary">schedule</span>
            </div>
            <div className="mt-space-md flex items-baseline justify-between">
              <div className="font-headline-lg text-display-xl text-on-surface">
                {scheduledCount}{" "}
                <span className="text-body-sm font-body-sm text-secondary font-normal">queued</span>
              </div>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary-fixed text-on-primary-fixed font-caption-bold text-[11px]">
                {scheduledCount > 0 ? "Awaiting dispatch" : "Empty queue"}
              </span>
            </div>
          </div>
          <div className="p-space-lg rounded-xl bg-surface-container-lowest shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="font-label-caps text-label-caps text-secondary uppercase tracking-wider">
                Published Posts
              </span>
              <span className="material-symbols-outlined text-[16px] text-tertiary">send</span>
            </div>
            <div className="mt-space-md flex items-baseline justify-between">
              <div className="font-headline-lg text-display-xl text-on-surface">
                {publishedCount}{" "}
                <span className="text-body-sm font-body-sm text-secondary font-normal">sent</span>
              </div>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface font-caption-bold text-[11px]">
                {publishedCount > 0 ? "Published" : "No posts yet"}
              </span>
            </div>
          </div>
          <div className="p-space-lg rounded-xl bg-surface-container-lowest shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="font-label-caps text-label-caps text-secondary uppercase tracking-wider">
                Queued Drafts
              </span>
              <span className="material-symbols-outlined text-[16px] text-secondary">drafts</span>
            </div>
            <div className="mt-space-md flex items-baseline justify-between">
              <div className="font-headline-lg text-display-xl text-on-surface">
                {queuedCount}{" "}
                <span className="text-body-sm font-body-sm text-secondary font-normal">
                  drafts + failed
                </span>
              </div>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-error-container text-on-error-container font-caption-bold text-[11px]">
                {failedCount > 0 ? "Needs Attention" : "Draft queue"}
              </span>
            </div>
          </div>
        </div>
        <div className="px-space-md py-2.5 rounded-lg bg-surface-container-low flex flex-wrap items-center justify-between text-secondary font-label-caps text-[11px] gap-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-tertiary"></span>
            <span>{connectedCount} connected services</span>
            <span className="text-outline-variant">•</span>
            <span>{jobs.length} distribution jobs tracked</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[14px]">sensors</span>
            <span>Live from database</span>
          </div>
        </div>
      </section>

      <ConnectorSection
        colorBar="bg-primary"
        title="Source Intake & Storage Connectors"
        badge="Raw Ingestion Layer"
        meta={`${sourceConnectedCount}/2 Connected`}
        items={sourceConnectors(connections)}
      />

      <ConnectorSection
        colorBar="bg-tertiary"
        title="Publishing & Distribution Relays"
        badge={connections.buffer ? "Connected" : "Available"}
        meta={`${platformRelayCount} platform relay${platformRelayCount === 1 ? "" : "s"} tracked`}
        items={publishingRelays(connections, jobs)}
      />

      <section className="space-y-space-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-space-sm">
            <span className="w-1.5 h-4 rounded-full bg-on-secondary-fixed-variant"></span>
            <h2 className="font-headline-md text-headline-md text-on-surface">
              Live Pipeline State
            </h2>
            <span className="font-label-caps text-[10px] uppercase bg-surface-container-high text-secondary px-2 py-0.5 rounded font-semibold">
              Storage &amp; Inference Layer
            </span>
          </div>
          <span className="font-caption-bold text-caption-bold text-secondary">
            Real-time from database
          </span>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-space-lg">
          <div className="p-space-lg rounded-xl bg-surface-container-lowest shadow-sm flex flex-col justify-between space-y-space-md">
            <div className="space-y-space-md">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-space-sm">
                  <div className="w-12 h-12 rounded-xl bg-surface-container flex items-center justify-center text-tertiary">
                    <span className="material-symbols-outlined text-[28px]">database</span>
                  </div>
                  <div>
                    <h3 className="font-headline-sm text-headline-lg text-on-surface">
                      Source Ingestion
                    </h3>
                    <p className="font-body-sm text-body-sm text-secondary">
                      Sources persisted as rows in your workspace
                    </p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-tertiary-fixed text-on-tertiary-fixed font-caption-bold text-[11px]">
                  {sources.length} total
                </span>
              </div>
              {sourceStatusRows.length > 0 ? (
                <div className="grid grid-cols-3 gap-space-sm p-space-sm rounded-lg bg-surface-container-low">
                  {sourceStatusRows.map((row) => (
                    <div key={row.status} className="space-y-0.5">
                      <p className="font-label-caps text-[10px] uppercase text-secondary">
                        {row.label}
                      </p>
                      <p className="font-headline-sm text-headline-sm text-on-surface">
                        {row.count}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="font-body-sm text-body-sm text-secondary">
                  No sources ingested yet.
                </p>
              )}
            </div>
            <div className="pt-space-sm flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-secondary font-caption-bold text-caption-bold">
                <span className="material-symbols-outlined text-[16px] text-tertiary">
                  check_circle
                </span>
                <span>{readySources} source{readySources === 1 ? "" : "s"} ready for generation</span>
              </div>
            </div>
          </div>
          <div className="p-space-lg rounded-xl bg-surface-container-lowest shadow-sm flex flex-col justify-between space-y-space-md">
            <div className="space-y-space-md">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-space-sm">
                  <div className="w-12 h-12 rounded-xl bg-surface-container flex items-center justify-center text-primary">
                    <span className="material-symbols-outlined text-[28px]">output</span>
                  </div>
                  <div>
                    <h3 className="font-headline-sm text-headline-lg text-on-surface">
                      Outputs &amp; Distribution
                    </h3>
                    <p className="font-body-sm text-body-sm text-secondary">
                      Generated formats staged in the publish queue
                    </p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary-fixed text-on-primary-fixed font-caption-bold text-[11px]">
                  {allOutputs.length} total
                </span>
              </div>
              {outputFormatRows.length > 0 ? (
                <div className="grid grid-cols-3 gap-space-sm p-space-sm rounded-lg bg-surface-container-low">
                  {outputFormatRows.map((row) => (
                    <div key={row.format} className="space-y-0.5">
                      <p className="font-label-caps text-[10px] uppercase text-secondary">
                        {row.label}
                      </p>
                      <p className="font-headline-sm text-headline-sm text-on-surface">
                        {row.count}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="font-body-sm text-body-sm text-secondary">
                  No outputs generated yet.
                </p>
              )}
            </div>
            <div className="pt-space-sm flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-secondary font-caption-bold text-caption-bold">
                <span className="material-symbols-outlined text-[16px] text-primary">send</span>
                <span>
                  {publishedCount} output{publishedCount === 1 ? "" : "s"} published via jobs
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="p-space-lg rounded-xl bg-surface-container-lowest shadow-sm flex flex-col md:flex-row items-center justify-between gap-space-lg">
        <div className="flex items-start gap-space-md max-w-2xl">
          <div className="w-10 h-10 rounded-lg bg-primary-fixed text-on-primary-fixed flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[22px]">terminal</span>
          </div>
          <div>
            <h4 className="font-headline-sm text-headline-sm text-on-surface">
              Custom ERP or Bespoke CMS Endpoints?
            </h4>
            <p className="font-body-sm text-body-sm text-secondary mt-1">
              Develop tailored webhook listeners via our open-source TypeScript SDK or
              access enterprise SSO and custom data warehouse connectors.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-space-sm shrink-0 w-full md:w-auto justify-end">
          <span
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded bg-surface-container-low text-on-surface font-caption-bold text-caption-bold cursor-default"
          >
            <span className="material-symbols-outlined text-[16px]">code</span>
            <span>View Developer SDK</span>
          </span>
          <span
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded bg-primary text-on-primary font-caption-bold text-caption-bold shadow-sm cursor-default"
            title="Coming soon"
          >
            <span className="material-symbols-outlined text-[16px]">contact_support</span>
            <span>Request Connector</span>
          </span>
        </div>
      </section>
    </div>
  );
}