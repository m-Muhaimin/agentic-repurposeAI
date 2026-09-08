"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import StatusBadge from "@/components/status-badge";
import EmptyState from "@/components/empty-state";
import SegmentedControl from "@/components/segmented-control";
import { PENDING_STATUS, statusLabel } from "@/lib/status";

const FORMAT_LABEL: Record<string, string> = {
  linkedin_post: "LinkedIn post",
  newsletter: "Newsletter section",
  shortform_script: "Short-form script"
};

const SOURCE_TYPE_LABEL: Record<string, string> = {
  audio: "Recording",
  video: "Video",
  youtube: "YouTube",
  transcript: "Transcript"
};

const FILTERS = [
  { id: "all", label: "All" },
  { id: "ready", label: "Ready" },
  { id: "processing", label: "Processing" },
  { id: "failed", label: "Failed" }
] as const;

type FilterId = (typeof FILTERS)[number]["id"];

function matchesFilter(source: Source, filter: FilterId): boolean {
  switch (filter) {
    case "ready":
      return source.status === "done";
    case "processing":
      return PENDING_STATUS.includes(source.status);
    case "failed":
      return source.status === "failed";
    default:
      return true;
  }
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(d);
}

type Output = { id: string; format: string; content: string };
type Source = {
  id: string;
  title: string;
  status: string;
  source_type: string;
  error_message: string | null;
  outputs: Output[] | null;
  created_at: string;
};
type Job = { id: string; source_id: string; status: string; started_at: string | null };

type Progress = { stage: string; pct: number };

// POSTs a job to /api/process and reads the SSE progress stream that comes back,
// so the card can animate a live stage + percentage while the job runs.
async function streamProcess(
  jobId: string,
  onProgress: (p: Progress) => void,
  onDone: () => void,
  onError: (message: string) => void
) {
  try {
    const res = await fetch("/api/process", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId })
    });
    if (!res.ok || !res.body) return;

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    const handleEvent = (raw: string) => {
      let event = "message";
      let data = "";
      for (const line of raw.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) data += line.slice(5).trim();
      }
      if (!data) return;
      let payload: Record<string, unknown>;
      try {
        payload = JSON.parse(data);
      } catch {
        return;
      }
      if (event === "progress") {
        onProgress({ stage: String(payload.stage ?? "Working…"), pct: Number(payload.pct ?? 0) });
      } else if (event === "done") {
        onDone();
      } else if (event === "error") {
        onError(String(payload.error ?? "Processing failed."));
      }
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const chunks = buffer.split("\n\n");
      buffer = chunks.pop() ?? "";
      for (const chunk of chunks) handleEvent(chunk);
    }
    if (buffer.trim()) handleEvent(buffer);
  } catch {
    // Connection dropped — status will surface via the sources refresh.
  }
}

function ProgressBar({ stage, pct }: { stage: string | null; pct: number | null }) {
  const known = pct != null;
  return (
    <div className="mt-4">
      <div className="flex items-center justify-between gap-4 text-xs text-theme-text-secondary">
        <span className="truncate font-medium text-theme-text-primary">{stage}</span>
        {known && <span className="shrink-0 tabular-nums">{pct}%</span>}
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-neutral-200">
        <div
          className={`h-full rounded-full bg-primary-500 ${
            known ? "transition-[width] duration-700 ease-out" : "animate-pulse"
          }`}
          style={{ width: known ? `${Math.max(2, Math.round(pct!))}%` : "12%" }}
        />
      </div>
    </div>
  );
}

export default function SourceList({
  initialSources,
  userId
}: {
  initialSources: Source[];
  userId: string;
}) {
  const [sources, setSources] = useState<Source[]>(initialSources);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [liveProgress, setLiveProgress] = useState<Record<string, Progress>>({});
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [enqueuingId, setEnqueuingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterId>("all");
  const kickedRef = useRef<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    const res = await fetch("/api/sources");
    if (!res.ok) return;
    const data = await res.json() as { sources: Source[]; jobs: Job[] };
    setSources(data.sources ?? []);
    setJobs(data.jobs ?? []);
    // Drop live progress for sources that are no longer in flight (done/failed).
    const pendingIds = new Set(
      (data.sources ?? [])
        .filter((s) => PENDING_STATUS.includes(s.status))
        .map((s) => s.id)
    );
    setLiveProgress((prev) => {
      const next: Record<string, Progress> = {};
      for (const [id, p] of Object.entries(prev)) {
        if (pendingIds.has(id)) next[id] = p;
      }
      return next;
    });
  }, []);

  async function handleDelete(sourceId: string) {
    setDeletingId(sourceId);
    try {
      const res = await fetch(`/api/sources/${sourceId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Could not delete this item.");
      setSources((prev) => prev.filter((s) => s.id !== sourceId));
    } catch {
      void refresh();
    } finally {
      setDeletingId(null);
      setConfirmingId(null);
    }
  }

  // Re-enqueue a source whose last run failed ("Try again"), or a freshly
  // uploaded source whose enqueue was lost. POST /api/repurpose (now accepts
  // `uploaded` and `failed`), then kick the worker with live progress so the
  // card animates immediately. Formats default to all three when omitted.
  async function handleEnqueue(sourceId: string) {
    setEnqueuingId(sourceId);
    setActionError(null);
    try {
      const res = await fetch("/api/repurpose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId })
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "Could not start processing.");
      }
      const data = (await res.json()) as { jobId?: string };
      if (!data.jobId) throw new Error("Could not start processing.");

      kickedRef.current.add(data.jobId);
      void streamProcess(
        data.jobId,
        (p) => setLiveProgress((prev) => ({ ...prev, [sourceId]: p })),
        () =>
          setLiveProgress((prev) => ({ ...prev, [sourceId]: { stage: "Ready", pct: 100 } })),
        () => refresh()
      );
      await refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setEnqueuingId(null);
    }
  }

  // Drive the background worker: kick `queued` jobs, plus `running` jobs whose
  // executor likely timed out (started more than 10 min ago), so nothing is
  // parked forever. Each kick streams live progress back and marks the job done;
  // the worker's atomic claim makes duplicate kicks harmless.
  const kickQueuedJobs = useCallback(
    (jobsToKick: Job[]) => {
      const staleBefore = Date.now() - 10 * 60 * 1000;
      for (const job of jobsToKick) {
        if (kickedRef.current.has(job.id)) continue;
        const isQueued = job.status === "queued";
        const isStaleRunning =
          job.status === "running" &&
          !!job.started_at &&
          new Date(job.started_at).getTime() < staleBefore;
        if (!isQueued && !isStaleRunning) continue;
        kickedRef.current.add(job.id);
        const sourceId = job.source_id;
        void streamProcess(
          job.id,
          (p) => setLiveProgress((prev) => ({ ...prev, [sourceId]: p })),
          () => setLiveProgress((prev) => ({ ...prev, [sourceId]: { stage: "Ready", pct: 100 } })),
          // Worker reported an error event — the source row now carries the
          // failed status + message, so refetch to surface it on the card.
          () => refresh()
        );
      }
    },
    [refresh]
  );

  // Realtime: live status updates when a source is transcribing/generating.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("dashboard-sources")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sources", filter: `user_id=eq.${userId}` },
        () => refresh()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "jobs", filter: `user_id=eq.${userId}` },
        () => refresh()
      )
      .subscribe();

    refresh();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refresh, userId]);

  // Kick processing for any queued jobs we discover.
  useEffect(() => {
    kickQueuedJobs(jobs);
  }, [jobs, kickQueuedJobs]);

  // Polling fallback: while anything is still working, refetch on an interval
  // so the dashboard updates even without Realtime enabled. The source itself
  // is server-rendered, so this only runs after mount.
  const hasPending = sources.some((s) => PENDING_STATUS.includes(s.status)) || jobs.length > 0;
  useEffect(() => {
    if (!hasPending) return;
    const id = setInterval(() => refresh(), 4000);
    return () => clearInterval(id);
  }, [hasPending, refresh]);

  const filteredSources = sources.filter((s) => matchesFilter(s, filter));

  return (
    <div className="flex flex-col gap-6">
      {actionError && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          <span>{actionError}</span>
          <button
            type="button"
            onClick={() => setActionError(null)}
            aria-label="Dismiss"
            className="shrink-0 text-red-400 transition-colors hover:text-red-600"
          >
            &times;
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl<FilterId>
          ariaLabel="Filter content"
          value={filter}
          onChange={setFilter}
          options={FILTERS.map((f) => ({
            id: f.id,
            label: (
              <>
                {f.label}
                <span className="ml-1.5 tabular-nums opacity-60">
                  {sources.filter((s) => matchesFilter(s, f.id)).length}
                </span>
              </>
            )
          }))}
        />
      </div>

      {filteredSources.length === 0 ? (
        sources.length === 0 ? (
          <EmptyState
            icon={
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="size-6"
                aria-hidden="true"
              >
                <path d="m12 2 10 5-10 5L2 7 12 2Z" />
                <path d="m2 17 10 5 10-5" />
                <path d="m2 12 10 5 10-5" />
              </svg>
            }
            title="No content yet"
            description="Repurpose a recording, transcript, or YouTube video and your drafts will live here."
            action={
              <Link href="/upload" className="btn btn-primary mt-2">
                Repurpose content
              </Link>
            }
          />
        ) : (
          <div className="rounded-lg border border-theme-divider bg-theme-bg-paper px-6 py-12 text-center">
            <p className="text-sm text-theme-text-secondary">
              Nothing is{" "}
              {filter === "ready"
                ? "ready yet"
                : filter === "processing"
                  ? "processing"
                  : filter === "failed"
                    ? "currently failed"
                    : "matching this filter"}
              .
            </p>
          </div>
        )
      ) : (
        filteredSources.map((source) => {
        const hasJob = jobs.some((j) => j.source_id === source.id);
        return (
        <div key={source.id} className="rounded-lg border border-theme-divider bg-theme-bg-paper p-5 transition-colors hover:border-primary-200">
          <div className="flex items-center justify-between gap-4">
            <h2 className="truncate font-display text-lg font-semibold text-theme-text-primary">
              {source.title}
            </h2>
            <div className="flex shrink-0 items-center gap-2">
              <StatusBadge status={source.status} />
              <button
                type="button"
                onClick={() => setConfirmingId(source.id)}
                aria-label={`Delete ${source.title}`}
                className="flex size-8 items-center justify-center rounded-lg text-theme-text-secondary transition-colors hover:bg-red-50 hover:text-red-600"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="size-4"
                  aria-hidden="true"
                >
                  <path d="M3 6h18" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                  <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  <path d="M10 11v6M14 11v6" />
                </svg>
              </button>
            </div>
          </div>

          <p className="mt-1 text-xs text-theme-text-secondary">
            {SOURCE_TYPE_LABEL[source.source_type] ?? source.source_type} ·{" "}
            {formatDate(source.created_at)}
            {source.outputs?.length
              ? ` · ${source.outputs.length} draft${source.outputs.length === 1 ? "" : "s"}`
              : ""}{" "}
            · 1 beta job
          </p>

          {source.status === "failed" && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <p role="alert" className="min-w-0 text-sm text-red-600">
                {source.error_message ?? "Processing failed."}
              </p>
              <button
                type="button"
                onClick={() => handleEnqueue(source.id)}
                disabled={!!enqueuingId}
                className="btn btn-outline-primary btn-sm shrink-0"
              >
                {enqueuingId === source.id ? "Retrying…" : "Try again"}
              </button>
            </div>
          )}

          {source.status === "uploaded" && !hasJob && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-theme-text-secondary">
                Saved, but processing never started.
              </p>
              <button
                type="button"
                onClick={() => handleEnqueue(source.id)}
                disabled={!!enqueuingId}
                className="btn btn-outline-primary btn-sm shrink-0"
              >
                {enqueuingId === source.id ? "Starting…" : "Start processing"}
              </button>
            </div>
          )}

          {source.outputs?.length ? (
            <div className="mt-5 flex flex-col gap-3">
              {source.outputs.map((output) => (
                <div
                  key={output.id}
                  className="flex items-center justify-between gap-4 rounded-lg bg-neutral-100 p-3"
                >
                  <p className="caption uppercase tracking-wider text-primary-500">
                    {FORMAT_LABEL[output.format] ?? output.format}
                  </p>
                  <Link
                    href={`/repurpose/${output.id}`}
                    className="btn btn-outline-primary btn-sm shrink-0"
                  >
                    View
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <>
              {PENDING_STATUS.includes(source.status) &&
                !(source.status === "uploaded" && !hasJob) && (
                  <ProgressBar
                    stage={liveProgress[source.id]?.stage ?? (statusLabel(source.status) || "Working…")}
                    pct={liveProgress[source.id]?.pct ?? null}
                  />
                )}
              {!(source.status === "uploaded" && !hasJob) && (
                <p className="mt-4 text-sm text-theme-text-secondary">
                  {source.status === "failed"
                    ? "The recording wasn't processed."
                    : "Drafts are being written — this card updates live."}
                </p>
              )}
            </>
          )}
        </div>
        );
      }))}

      {confirmingId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Confirm deletion"
        >
          <div className="w-full max-w-sm rounded-lg border border-theme-divider bg-theme-bg-paper p-6">
            <h3 className="font-display text-lg font-bold">Delete this content?</h3>
            <p className="mt-2 text-sm text-theme-text-secondary">
              This removes the source, its drafts, and any queued processing. This can&apos;t be
              undone.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmingId(null)}
                disabled={!!deletingId}
                className="btn btn-outline-primary btn-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDelete(confirmingId)}
                disabled={!!deletingId}
                className="btn btn-sm bg-red-600 text-white transition-colors hover:bg-red-700 focus:bg-red-700"
              >
                {deletingId ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}