import ConnectorSection from "@/components/connections/ConnectorSection";
import CheckAllStatuses from "@/components/connections/CheckAllStatuses";
import type { ConnectorCardItem } from "@/components/connections/ConnectorCard";
import {
  getConnectionsState,
  getDistributionJobs,
  getSourcesWithOutputs,
  timeAgo,
  FORMAT_LABEL,
} from "@/lib/data";

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
    {
      icon: "videocam",
      iconTone: "primary",
      status: { label: "Available", tone: "available" },
      title: "Loom / Screen Recorder",
      description: "Drop Loom recordings as video sources via the intake node.",
      details: [{ label: "Status:", value: "Not connected", valueTone: "tertiary" }],
      action: { label: "+ Connect OAuth", tone: "connect" },
    },
    {
      icon: "podcasts",
      iconTone: "on-surface-variant",
      status: { label: "Available", tone: "available" },
      title: "Spotify / RSS Feeds",
      description: "Paste a podcast RSS or Markdown URL into the intake node.",
      details: [{ label: "Status:", value: "Not required — use Web Link", valueTone: "tertiary" }],
      action: { label: "+ Paste URL", tone: "connect" },
    },
  ];
}

function publishingRelays(
  connections: Awaited<ReturnType<typeof getConnectionsState>>,
  scheduledCount: number,
): ConnectorCardItem[] {
  const buffer = connections.buffer;
  return [
    buffer
      ? {
          icon: "layers",
          iconTone: "primary-container",
          status: { label: "Connected", tone: "stable" },
          title: "Buffer Pipeline",
          description: `Connected Buffer account: @${buffer.username}`,
          details: [
            { label: "Account:", value: `@${buffer.username}` },
            { label: "Queued:", value: `${scheduledCount} scheduled`, valueTone: "primary" },
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
        },
    {
      icon: "share",
      iconTone: "primary",
      status: { label: "Available", tone: "available" },
      title: "LinkedIn Creator API",
      description: "Distribution routes through the Buffer pipeline once connected.",
      details: [{ label: "Status:", value: "Via Buffer", valueTone: "tertiary" }],
      action: { label: "+ Connect via Buffer", tone: "connect" },
    },
    {
      icon: "tag",
      iconTone: "on-surface",
      status: { label: "Available", tone: "available" },
      title: "Twitter / X",
      description: "Thread publishing routes through the Buffer pipeline.",
      details: [{ label: "Status:", value: "Via Buffer", valueTone: "tertiary" }],
      action: { label: "+ Connect via Buffer", tone: "connect" },
    },
    {
      icon: "webhook",
      iconTone: "on-surface-variant",
      status: { label: "Available", tone: "available" },
      title: "Newsletter Dispatch",
      description: "Newsletter outputs become ready-to-publish drafts in the queue.",
      details: [{ label: "Status:", value: "Via queue", valueTone: "tertiary" }],
      action: { label: "View Publish Queue", tone: "default" },
    },
  ];
}

export default async function Page() {
  const [connections, jobs, sources] = await Promise.all([
    getConnectionsState(),
    getDistributionJobs(200),
    getSourcesWithOutputs(500),
  ]);

  const connectedCount = [connections.buffer, connections.youtube, connections.drive].filter(
    Boolean,
  ).length;
  const scheduledCount = jobs.filter((j) => j.status === "scheduled").length;
  const publishedCount = jobs.filter((j) => j.status === "published").length;
  const draftCount = jobs.filter((j) => j.status === "draft").length;

  return (
    <div className="flex flex-col w-full">
      <div className="w-full max-w-7xl mx-auto space-y-space-xl">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-space-md pt-2">
          <div className="flex flex-col gap-1 max-w-3xl">
            <div className="flex items-center gap-2">
              <span className="font-label-caps text-label-caps uppercase text-outline tracking-wider">
                Workspace
              </span>
              <span className="text-outline-variant text-[10px]">/</span>
              <span className="font-label-caps text-label-caps uppercase text-primary font-semibold tracking-wider">
                Integration &amp; Relay Ecosystem
              </span>
            </div>
            <h1 className="font-headline-xl text-headline-xl text-on-surface tracking-tight">
              System Connections &amp; Infrastructure
            </h1>
            <p className="font-body-medium text-body-medium text-on-surface-variant leading-relaxed">
              Manage OAuth authentications, webhook pipelines, source intake connectors, and
              scheduled distribution endpoints. Status reflects your live database rows.
            </p>
          </div>
          <div className="flex items-center gap-space-sm shrink-0">
            <CheckAllStatuses />
            <button
              className="flex items-center gap-2 px-space-md py-2.5 rounded-lg bg-primary-container text-on-primary font-body-medium text-body-medium hover:bg-primary transition-all active:scale-[0.98] shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              id="addIntegrationBtn"
              type="button"
              disabled
              title="Coming soon"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              <span>+ Add Integration</span>
              <span className="font-label-caps text-[10px] text-on-surface-variant uppercase ml-1">Coming soon</span>
            </button>
          </div>
        </div>
        <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-space-md items-center">
            <div className="flex items-center gap-space-md p-space-sm rounded-lg bg-surface-container-low">
              <div className="w-10 h-10 rounded-lg bg-tertiary-fixed flex items-center justify-center text-tertiary">
                <span className="material-symbols-outlined text-[22px]">hub</span>
              </div>
              <div className="flex flex-col">
                <span className="font-display-xl text-display-xl text-on-surface leading-tight">
                  {connectedCount}
                </span>
                <span className="font-caption-bold text-caption-bold text-on-surface-variant uppercase">
                  Connected Services
                </span>
              </div>
            </div>
            <div className="flex items-center gap-space-md p-space-sm rounded-lg bg-surface-container-low">
              <div className="w-10 h-10 rounded-lg bg-secondary-container flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-[22px]">schedule</span>
              </div>
              <div className="flex flex-col">
                <span className="font-display-xl text-display-xl text-on-surface leading-tight">
                  {scheduledCount}
                </span>
                <span className="font-caption-bold text-caption-bold text-on-surface-variant uppercase">
                  Scheduled Posts
                </span>
              </div>
            </div>
            <div className="flex items-center gap-space-md p-space-sm rounded-lg bg-surface-container-low">
              <div className="w-10 h-10 rounded-lg bg-tertiary-container flex items-center justify-center text-tertiary">
                <span className="material-symbols-outlined text-[22px]">check_circle</span>
              </div>
              <div className="flex flex-col">
                <span className="font-display-xl text-display-xl text-on-surface leading-tight">
                  {publishedCount}
                </span>
                <span className="font-caption-bold text-caption-bold text-on-surface-variant uppercase">
                  Published Posts
                </span>
              </div>
            </div>
            <div className="flex items-center gap-space-md p-space-sm rounded-lg bg-surface-container-low">
              <div className="w-10 h-10 rounded-lg bg-surface-container-high flex items-center justify-center text-secondary">
                <span className="material-symbols-outlined text-[22px]">drafts</span>
              </div>
              <div className="flex flex-col flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-display-xl text-display-xl text-on-surface leading-tight">
                    {draftCount}
                  </span>
                </div>
                <span className="font-caption-bold text-caption-bold text-on-surface-variant uppercase truncate">
                  Queued Drafts
                </span>
              </div>
            </div>
          </div>
          <div className="mt-space-md pt-space-sm flex flex-col md:flex-row md:items-center justify-between gap-2 text-on-surface-variant font-caption-bold text-caption-bold">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-tertiary-container"></span> Live from
                database
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-primary-container"></span> {connectedCount}/3
                OAuth relays active
              </span>
            </div>
            <div className="flex items-center gap-1 font-body-sm text-body-sm">
              <span>Distribution jobs tracked:</span>
              <span className="text-on-surface font-semibold">{jobs.length}</span>
            </div>
          </div>
        </div>
        <ConnectorSection
          colorBar="bg-primary"
          title="Source Intake & Storage Connectors"
          badge={`${connectedCount} Connected`}
          meta="Raw Ingestion Layer"
          items={sourceConnectors(connections)}
          variant="compact"
        />
        <ConnectorSection
          colorBar="bg-primary-container"
          title="Publishing & Distribution Relays"
          badge="Outbound Dispatch"
          meta="Multi-Platform Queue"
          items={publishingRelays(connections, scheduledCount)}
          variant="compact"
        />
        <section className="space-y-space-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-space-sm">
              <div className="w-2 h-5 bg-tertiary-container rounded-full"></div>
              <h2 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">
                Live Pipeline State
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-secondary-container text-primary font-caption-bold text-caption-bold">
                Current Data
              </span>
            </div>
            <span className="font-caption-bold text-caption-bold text-outline uppercase tracking-wider">
              Storage &amp; Inference
            </span>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-gutter">
            <div className="bg-surface-container-lowest rounded-xl p-space-lg flex flex-col justify-between shadow-sm relative overflow-hidden">
              <div className="absolute -right-8 -top-8 w-36 h-36 bg-tertiary-fixed/30 rounded-full blur-2xl pointer-events-none"></div>
              <div className="space-y-space-md relative z-10">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-surface-container-high flex items-center justify-center text-tertiary">
                      <span className="material-symbols-outlined text-[28px]">database</span>
                    </div>
                    <div>
                      <h3 className="font-headline-lg text-headline-lg text-on-surface">
                        Supabase Storage &amp; Postgres
                      </h3>
                      <p className="font-body-sm text-body-sm text-on-surface-variant">
                        Source nodes + generated outputs live in your project&apos;s database
                      </p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-tertiary-fixed text-tertiary font-caption-bold text-caption-bold">
                    <span className="w-2 h-2 rounded-full bg-tertiary"></span> RLS Protected
                  </span>
                </div>
                <p className="font-body-base text-body-base text-on-surface-variant leading-relaxed">
                  Every source you ingest and every output the agent synthesizes is persisted as a
                  row, queryable in real time from this workspace.
                </p>
                <div className="grid grid-cols-3 gap-space-sm pt-2">
                  <div className="p-space-sm rounded-lg bg-surface-container-low flex flex-col">
                    <span className="font-caption-bold text-caption-bold text-outline uppercase">
                      Sources
                    </span>
                    <span className="font-headline-sm text-headline-sm text-on-surface">
                      {sources.length}
                    </span>
                  </div>
                  <div className="p-space-sm rounded-lg bg-surface-container-low flex flex-col">
                    <span className="font-caption-bold text-caption-bold text-outline uppercase">
                      Region
                    </span>
                    <span className="font-headline-sm text-headline-sm text-tertiary">
                      Supabase Hosted
                    </span>
                  </div>
                  <div className="p-space-sm rounded-lg bg-surface-container-low flex flex-col">
                    <span className="font-caption-bold text-caption-bold text-outline uppercase">
                      Security
                    </span>
                    <span className="font-headline-sm text-headline-sm text-on-surface">
                      Row-Level
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between pt-space-lg mt-space-md">
                <div className="flex items-center gap-2 text-on-surface-variant font-caption-bold text-caption-bold">
                  <span className="material-symbols-outlined text-[18px] text-tertiary">
                    verified_user
                  </span>
                  <span>Per-user RLS via auth session</span>
                </div>
                <button
                  className="px-space-md py-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-body-medium text-body-medium transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  type="button"
                  disabled
                  title="Coming soon"
                >
                  <span>Open Content Library</span>
                  <span className="material-symbols-outlined text-[16px]">query_stats</span>
                </button>
              </div>
            </div>
            <div className="bg-surface-container-lowest rounded-xl p-space-lg flex flex-col justify-between shadow-sm relative overflow-hidden">
              <div className="absolute -right-8 -top-8 w-36 h-36 bg-primary-fixed/30 rounded-full blur-2xl pointer-events-none"></div>
              <div className="space-y-space-md relative z-10">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-surface-container-high flex items-center justify-center text-primary">
                      <span className="material-symbols-outlined text-[28px]">sensors</span>
                    </div>
                    <div>
                      <h3 className="font-headline-lg text-headline-lg text-on-surface">
                        Distribution &amp; Agent Compute
                      </h3>
                      <p className="font-body-sm text-body-sm text-on-surface-variant">
                        Scheduled posts and generated formats tracked in the database
                      </p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary-container text-primary font-caption-bold text-caption-bold">
                    <span className="w-2 h-2 rounded-full bg-primary"></span> Live Queue
                  </span>
                </div>
                <p className="font-body-base text-body-base text-on-surface-variant leading-relaxed">
                  Outputs are staged as drafts, scheduled, and published through the queue. Status
                  here reflects the real rows behind every dashboard stat.
                </p>
                <div className="grid grid-cols-3 gap-space-sm pt-2">
                  <div className="p-space-sm rounded-lg bg-surface-container-low flex flex-col">
                    <span className="font-caption-bold text-caption-bold text-outline uppercase">
                      Scheduled
                    </span>
                    <span className="font-headline-sm text-headline-sm text-on-surface">
                      {scheduledCount}
                    </span>
                  </div>
                  <div className="p-space-sm rounded-lg bg-surface-container-low flex flex-col">
                    <span className="font-caption-bold text-caption-bold text-outline uppercase">
                      Published
                    </span>
                    <span className="font-headline-sm text-headline-sm text-tertiary">
                      {publishedCount}
                    </span>
                  </div>
                  <div className="p-space-sm rounded-lg bg-surface-container-low flex flex-col">
                    <span className="font-caption-bold text-caption-bold text-outline uppercase">
                      Drafts
                    </span>
                    <span className="font-headline-sm text-headline-sm text-primary">
                      {draftCount}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between pt-space-lg mt-space-md">
                <div className="flex items-center gap-2 text-on-surface-variant font-caption-bold text-caption-bold">
                  <span className="material-symbols-outlined text-[18px] text-primary">schedule</span>
                  <span>Queryable across {Object.keys(FORMAT_LABEL).length} output formats</span>
                </div>
                <button
                  className="px-space-md py-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-body-medium text-body-medium transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  type="button"
                  disabled
                  title="Coming soon"
                >
                  <span>Open Publish Queue</span>
                  <span className="material-symbols-outlined text-[16px]">sync_lock</span>
                </button>
              </div>
            </div>
          </div>
        </section>
        <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col md:flex-row items-center justify-between gap-space-md">
          <div className="flex items-center gap-space-md">
            <div className="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center text-outline shrink-0">
              <span className="material-symbols-outlined text-[20px]">help_outline</span>
            </div>
            <div className="space-y-0.5">
              <h4 className="font-headline-sm text-headline-sm text-on-surface">
                Better with more connections enabled?
              </h4>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Connect Google Drive, YouTube, and Buffer to unlock auto-ingest and scheduled
                distribution across LinkedIn, X, and newsletters.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-space-sm shrink-0">
            <button
              className="px-space-md py-2 rounded-lg bg-surface-container-low hover:bg-surface-container-high text-on-surface font-body-medium text-body-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              type="button"
              disabled
              title="Coming soon"
            >
              View Setup Guide
            </button>
            <button
              className="px-space-md py-2 rounded-lg bg-primary-container text-on-primary font-body-medium text-body-medium hover:bg-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              type="button"
              disabled
              title="Coming soon"
            >
              Request Connector
            </button>
          </div>
        </div>
      </div>
      <div
        className="fixed bottom-6 right-6 bg-inverse-surface text-inverse-on-surface px-space-md py-3 rounded-xl shadow-xl flex items-center gap-3 transform translate-y-24 opacity-0 transition-all duration-300 z-50 pointer-events-none"
        id="statusToast"
      >
        <span className="material-symbols-outlined text-[20px] text-tertiary-fixed">check_circle</span>
        <span className="font-body-medium text-body-medium" id="statusToastText">
          Connection status verified against the database.
        </span>
      </div>
    </div>
  );
}