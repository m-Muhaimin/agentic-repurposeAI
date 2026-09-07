"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

function youtubeHandle(channelTitle: string): string {
  const slug = channelTitle.toLowerCase().replace(/[^a-z0-9]/g, "");
  return slug ? `@${slug}` : "";
}

export default function ConnectionsYoutube({
  connection
}: {
  connection: { channelTitle: string; createdAt: string } | null;
}) {
  const router = useRouter();
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connectedDate = connection?.createdAt
    ? new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(
        new Date(connection.createdAt)
      )
    : null;

  async function handleDisconnect() {
    setDisconnecting(true);
    setError(null);
    try {
      const res = await fetch("/api/integrations/youtube/disconnect", { method: "DELETE" });
      if (!res.ok) throw new Error("Could not disconnect.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not disconnect.");
      setDisconnecting(false);
    }
  }

  return (
    <section className="flex flex-col rounded-lg border border-theme-divider bg-theme-bg-paper p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-base font-semibold">YouTube</h2>
        {connection ? (
          <span className="flex items-center gap-1.5 badge bg-neutral-900 text-white">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-3.5"
              aria-hidden="true"
            >
              <path d="M20 6 9 17l-5-5" />
            </svg>
            Connected
          </span>
        ) : (
          <span className="badge bg-neutral-100 text-neutral-600">Not connected</span>
        )}
      </div>

      {connection ? (
        <div className="mt-4 flex flex-1 flex-col">
          <p className="font-display text-lg font-semibold text-theme-text-primary">
            {connection.channelTitle}
          </p>
          <p className="mt-0.5 text-sm text-theme-text-secondary">
            {youtubeHandle(connection.channelTitle)}
            {connectedDate ? ` · Connected ${connectedDate}` : ""}
          </p>
          <p className="mt-3 text-sm text-theme-text-secondary">
            Repurpose videos straight from their authorized captions — no download or transcription
            step.
          </p>
          {error && (
            <p role="alert" className="mt-3 text-sm text-red-600">
              {error}
            </p>
          )}
          <div className="mt-6 flex items-center gap-3">
            <button
              type="button"
              onClick={() => void handleDisconnect()}
              disabled={disconnecting}
              className="btn btn-outline-primary btn-sm disabled:opacity-50"
            >
              {disconnecting ? "Disconnecting…" : "Disconnect"}
            </button>
<Link href="/upload" className="text-xs text-primary-500 underline underline-offset-2">
              Upload instead
            </Link>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-1 flex-col">
          <p className="text-sm text-theme-text-secondary">
            Connect your YouTube channel to import videos and access authorized captions for
            repurposing.
          </p>
          <a href="/api/integrations/youtube/connect" className="btn btn-primary mt-6 self-start">
            Connect YouTube
          </a>
        </div>
      )}
    </section>
  );
}