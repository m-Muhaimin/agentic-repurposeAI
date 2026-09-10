"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader } from "@/components/card";
import EmptyState from "@/components/empty-state";
import { FORMAT_LABEL, type OutputFormat } from "@/types/agent";
import BufferPostPicker from "./buffer-post-picker";

// Publish queue surface (P10). READ-MOSTLY + manual approval. This panel:
//   - lists real publishable drafts (from done runs' output_ids) and the user's
//     v4_distribution_jobs (draft/scheduled/...);
//   - the ONLY action is "Queue for approval" — the pre-send confirm step. On
//     confirm the server records a `scheduled` job that NEVER auto-advances;
//   - the actual "Send" affordance is EXPLICITLY blocked with the truthful
//     "no publishing channel connected" reason. There is NO fake success toast.

interface QueueDraft {
  id: string;
  runId: string;
  format: string;
  preview: string;
  createdAt: string;
}

interface QueueJob {
  id: string;
  runId: string | null;
  outputId: string | null;
  platform: string;
  status: string;
  statusLabel: string;
  blockReason: string | null;
  scheduledAt: string | null;
  externalId: string | null;
  errorMessage: string | null;
  createdAt: string;
  preview: string;
  format: string | null;
}

interface BufferProfileView {
  id: string;
  service: string;
  username: string | null;
  avatar: string | null;
  default: boolean;
}

interface QueueData {
  ok: boolean;
  publishable: QueueDraft[];
  jobs: QueueJob[];
  channelsConnected: boolean;
  hasApiKey: boolean;
  notConnectedMessage: string;
  historyWindowMs: number;
  note: string;
}

const PLATFORMS = ["linkedin", "x", "newsletter", "youtube_shorts", "tiktok", "instagram"] as const;

export default function PublishQueuePanel() {
  const router = useRouter();
  const [data, setData] = useState<QueueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [sendingJobId, setSendingJobId] = useState<string | null>(null);
  const [draftPlatform, setDraftPlatform] = useState<Record<string, string>>({});
  const [jobProfile, setJobProfile] = useState<Record<string, string>>({});
  const [jobProfileByPlatform, setJobProfileByPlatform] = useState<Record<string, BufferProfileView[]>>({});
  const [jobSchedule, setJobSchedule] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState<string | null>(null);

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/agent/queue");
      if (res.ok) {
        const body = (await res.json()) as QueueData;
        if (body.ok) setData(body);
      } else {
        setError("VervAI couldn't complete this action. Your content is safe. [Try again]");
      }
    } catch {
      setError("VervAI couldn't complete this action. Your content is safe. [Try again]");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  async function queueDraft(draftId: string) {
    const platform = draftPlatform[draftId] ?? "linkedin";
    setConfirmingId(draftId);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/agent/queue/publish", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ outputId: draftId, platform, confirm: true, mode: "queue" })
      });
      const body = (await res.json()) as { ok?: boolean; error?: string; publishBlockedMessage?: string };
      if (!res.ok || !body.ok) {
        setError(body.error ?? "VervAI couldn't publish this post. Your draft is still available. [Review draft] [Try again]");
        return;
      }
      setSuccess("Draft queued for approval.");
      await fetchQueue();
    } catch {
      setError("VervAI couldn't publish this post. Your draft is still available. [Review draft] [Try again]");
    } finally {
      setConfirmingId(null);
    }
  }

  // Load the caller's connected Buffer profiles for a platform (cached per
  // platform) and pre-select a default for the job that triggered the fetch.
  async function loadProfiles(platform: string, jobId: string) {
    const cached = jobProfileByPlatform[platform];
    if (cached) {
      setError(null);
      if (jobProfile[jobId] === undefined) {
        const first = cached.find((p) => p.default) ?? cached[0];
        if (first) setJobProfile((s) => ({ ...s, [jobId]: first.id }));
      }
      return;
    }
    try {
      const res = await fetch(`/api/integrations/buffer/profiles?platform=${encodeURIComponent(platform)}`);
      const body = (await res.json()) as { ok?: boolean; profiles?: BufferProfileView[]; error?: string };
      if (res.ok && body.ok && body.profiles) {
        setJobProfileByPlatform((p) => ({ ...p, [platform]: body.profiles! }));
        const first = body.profiles.find((x) => x.default) ?? body.profiles[0];
        if (first) setJobProfile((s) => ({ ...s, [jobId]: first.id }));
        setError(null);
      } else {
        setError(body.error ?? "VervAI couldn't complete this action. Your content is safe. [Try again]");
      }
    } catch {
      setError("VervAI couldn't complete this action. Your content is safe. [Try again]");
    }
  }

  async function sendJob(job: QueueJob, mode: "now" | "schedule") {
    if (!job.outputId) {
      setError("This job has no draft to send.");
      return;
    }
    const profileId = jobProfile[job.id];
    if (!profileId) {
      setError("Pick a Buffer profile to send to.");
      return;
    }
    const scheduledAt = mode === "schedule" ? jobSchedule[job.id] : undefined;
    if (mode === "schedule" && !scheduledAt) {
      setError("Choose a date/time to schedule.");
      return;
    }
    setSendingJobId(job.id);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/agent/queue/publish", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          outputId: job.outputId,
          platform: job.platform,
          confirm: true,
          mode: "send",
          profileIds: [profileId],
          ...(scheduledAt ? { scheduledAt } : {})
        })
      });
      const body = (await res.json()) as { ok?: boolean; error?: string; scheduled?: boolean };
      if (!res.ok || !body.ok) {
        setError(body.error ?? "VervAI couldn't publish this post. Your draft is still available. [Review draft] [Try again]");
        return;
      }
      setSuccess(body.scheduled ? "Scheduled with Buffer — it will post at the chosen time." : "Sent to Buffer.");
      await fetchQueue();
    } catch {
      setError("VervAI couldn't publish this post. Your draft is still available. [Review draft] [Try again]");
    } finally {
      setSendingJobId(null);
    }
  }

  const hasAny = (data?.publishable.length ?? 0) > 0 || (data?.jobs.length ?? 0) > 0;

  return (
    <Card>
      <CardHeader
        title="Publish queue"
        description={
          data?.channelsConnected
            ? "Queued drafts, awaiting your approval to send to Buffer."
            : data?.hasApiKey
              ? "Agent scheduling is live via your Buffer API key. Connect a Buffer account to also send from here by hand."
              : "Nothing is published from here automatically. Connect a Buffer account to enable sends."
        }
        action={
          <button
            type="button"
            onClick={fetchQueue}
            disabled={loading}
            className="btn text-xs disabled:opacity-50"
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        }
      />

      {success && (
        <div role="status" className="border-b border-theme-divider bg-green-50 px-5 py-2 text-sm text-green-800">
          {success}
        </div>
      )}

      {loading && (
        <div className="space-y-3 px-5 py-6">
          <div className="h-4 w-3/4 animate-pulse rounded bg-neutral-100" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-neutral-100" />
        </div>
      )}

      {!loading && error && <p className="px-5 py-4 text-sm text-red-600">{error}</p>}

      {!loading && !error && data && (
        <>
          {/* Not-connected banner: honest, exact, and always shown */}
          {!data.channelsConnected && (
            <div className="border-b border-theme-divider px-5 py-3">
              <p className="text-xs text-theme-text-secondary">
                <span className="badge bg-neutral-200 text-neutral-600">no Buffer account</span>{" "}
                {data.hasApiKey
                  ? "Scheduling to the queue works (automate) via your Buffer API key. Manual sends from below need a connected Buffer account."
                  : data.notConnectedMessage}
              </p>
            </div>
          )}

          {!hasAny ? (
            <EmptyState
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-5" aria-hidden="true">
                  <path d="M3 3v18h18" />
                  <path d="M7 14l3-3 3 3 5-6" />
                </svg>
              }
              title="Publish queue is empty"
              description="Your content library is empty. Add a source to give VervAI something to work with."
            />
          ) : (
            <div className="divide-y divide-theme-divider">
              {/* Drafts not yet queued */}
              {data.publishable.length > 0 && (
                <div className="px-5 py-4">
                  <p className="text-xs font-medium text-theme-text-secondary">Ready drafts (not queued)</p>
                  <ul className="mt-2 space-y-3">
                    {data.publishable.map((d) => (
                      <li key={d.id} className="rounded-lg border border-theme-divider p-3">
                        <div className="flex items-center justify-between gap-3">
                          <span className="badge bg-primary-100 text-primary-500">
                            {FORMAT_LABEL[d.format as OutputFormat] ?? d.format}
                          </span>
                          <span className="text-xs text-theme-text-secondary">
                            {new Date(d.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                          </span>
                        </div>
                        <p className="mt-2 line-clamp-2 text-sm text-theme-text-secondary">{d.preview}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <select
                            value={draftPlatform[d.id] ?? "linkedin"}
                            onChange={(e) => setDraftPlatform((p) => ({ ...p, [d.id]: e.target.value }))}
                            className="rounded-lg border border-theme-divider bg-theme-bg-paper px-2 py-1 text-xs"
                            aria-label={`Platform for draft ${d.id.slice(0, 8)}`}
                          >
                            {PLATFORMS.map((p) => (
                              <option key={p} value={p}>{p}</option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => queueDraft(d.id)}
                            disabled={confirmingId === d.id}
                            className="btn btn-primary text-xs disabled:opacity-50"
                          >
                            {confirmingId === d.id ? "Queuing…" : "Queue for approval"}
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Existing jobs */}
              {data.jobs.length > 0 && (
                <div className="px-5 py-4">
                  <p className="text-xs font-medium text-theme-text-secondary">Queued &amp; prior jobs</p>
                  <ul className="mt-2 space-y-3">
                    {data.jobs.map((j) => {
                      const canSend = data.channelsConnected && j.status === "scheduled" && !j.externalId && j.platform !== "newsletter";
                      const profiles = jobProfileByPlatform[j.platform];
                      return (
                        <li key={j.id} className="rounded-lg border border-theme-divider p-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="badge bg-neutral-100 text-neutral-500">{j.platform}</span>
                              <span className="text-xs text-theme-text-secondary">{j.statusLabel}</span>
                            </div>
                            <span className="text-xs text-theme-text-secondary">
                              {new Date(j.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                            </span>
                          </div>
                          {j.preview && <p className="mt-2 line-clamp-2 text-sm text-theme-text-secondary">{j.preview}</p>}

                          {/* Dispatched to Buffer (future-scheduled): show the real state */}
                          {j.status === "scheduled" && j.externalId && j.scheduledAt && (
                            <p className="mt-2 text-xs text-theme-text-secondary">
                              <span className="badge bg-primary-100 text-primary-500">with Buffer</span>{" "}
                              scheduled for {new Date(j.scheduledAt).toLocaleString()}
                            </p>
                          )}
                          {j.errorMessage && j.status === "failed" && (
                            <p className="mt-2 text-xs text-red-600">Failed: {j.errorMessage}</p>
                          )}
                          {j.blockReason && !data.channelsConnected && (
                            <p className="mt-2 text-xs text-theme-text-secondary">{j.blockReason}</p>
                          )}

                          {/* Manual-approval Send controls — only when a real
                              Buffer channel is connected and the job is pending */}
                          {canSend && (
                            <div className="mt-3 border-t border-theme-divider pt-3">
                              {profiles ? (
                                <div className="flex flex-wrap items-center gap-2">
                                  <select
                                    value={jobProfile[j.id] ?? ""}
                                    onChange={(e) => setJobProfile((s) => ({ ...s, [j.id]: e.target.value }))}
                                    className="rounded-lg border border-theme-divider bg-theme-bg-paper px-2 py-1 text-xs"
                                    aria-label={`Buffer profile for ${j.platform}`}
                                  >
                                    {profiles.length === 0 ? (
                                      <option value="">No connected {j.platform} profile</option>
                                    ) : (
                                      profiles.map((p) => (
                                        <option key={p.id} value={p.id}>
                                          {p.username ?? `Profile ${p.id.slice(0, 6)}`}
                                        </option>
                                      ))
                                    )}
                                  </select>
                                  <input
                                    type="datetime-local"
                                    value={jobSchedule[j.id] ?? ""}
                                    onChange={(e) => setJobSchedule((s) => ({ ...s, [j.id]: e.target.value }))}
                                    className="rounded-lg border border-theme-divider bg-theme-bg-paper px-2 py-1 text-xs"
                                    aria-label="Schedule time"
                                  />
                                  {profiles.length === 0 ? (
                                    <span className="text-xs text-theme-text-secondary">
                                      Connect a {j.platform} profile in Buffer to send here.
                                    </span>
                                  ) : (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => sendJob(j, "now")}
                                        disabled={sendingJobId === j.id || !jobProfile[j.id]}
                                        className="btn btn-primary text-xs disabled:opacity-50"
                                      >
                                        {sendingJobId === j.id ? "Sending…" : "Send now"}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => sendJob(j, "schedule")}
                                        disabled={sendingJobId === j.id || !jobProfile[j.id]}
                                        className="btn text-xs disabled:opacity-50"
                                      >
                                        Schedule
                                      </button>
                                    </>
                                  )}
                                </div>
                              ) : (
                                <div className="flex flex-wrap items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => loadProfiles(j.platform, j.id)}
                                    className="btn text-xs"
                                  >
                                    Load {j.platform} profiles
                                  </button>
                                  <span className="text-xs text-theme-text-secondary">
                                    Real send requires a connected profile — loaded from Buffer, never guessed.
                                  </span>
                                </div>
                              )}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div className="border-t border-theme-divider px-5 py-3">
            <p className="text-xs text-theme-text-secondary">{data.note}</p>
          </div>

          {/* Repurpose an existing Buffer post back through the pipeline */}
          <div className="border-t border-theme-divider">
            <CardHeader
              title="Repurpose a Buffer post"
              description="Start a fresh VervAI run from a post you already posted — its text becomes the new source."
            />
            <BufferPostPicker
              onRepurposed={(info) => {
                setSuccess("Repurpose started — the new run is loading in the agent workspace.");
                void fetchQueue();
                router.push(`/agent?run=${info.runId}`);
              }}
            />
          </div>
        </>
      )}
    </Card>
  );
}