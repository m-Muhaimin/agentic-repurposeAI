"use client";

import { useCallback, useEffect, useState } from "react";
import type { AgentMode } from "@/types/agent";

// Shared "repurpose an existing Buffer post" picker — used by the run detail
// ("Start from a post you already posted") and the publish queue. Real data via
// /api/agent/posts (MCP list_posts); starting a repurpose creates a
// transcript-style source + agent run via /api/agent/repurpose.

interface BufferPostView {
  id: string;
  status: string;
  text: string;
  preview: string;
  channelName: string;
  channelService: string | null;
  dueAt: string | null;
  sentAt: string | null;
  createdAt: string | null;
}

export default function BufferPostPicker({
  mode,
  onRepurposed,
  onError
}: {
  mode?: AgentMode;
  onRepurposed: (info: { runId: string; sourceId: string }) => void;
  onError?: (message: string) => void;
}) {
  const [posts, setPosts] = useState<BufferPostView[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/agent/posts");
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.ok) {
        setPosts(null);
        setError(body?.error ?? "Couldn't load Buffer posts.");
        return;
      }
      setPosts(body.posts as BufferPostView[]);
      setError(null);
    } catch {
      setPosts(null);
      setError("VervAI couldn't reach Buffer. Your content is safe. Try again.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function repurpose(post: BufferPostView) {
    setBusyId(post.id);
    setError(null);
    try {
      const res = await fetch("/api/agent/repurpose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId: post.id, mode })
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.ok || !body?.run) {
        setError(body?.error ?? "Couldn't start the repurpose run.");
        onError?.(body?.error ?? "Couldn't start the repurpose run.");
        return;
      }
      onRepurposed({ runId: body.run.id, sourceId: body.sourceId });
    } catch {
      setError("VervAI couldn't complete this action. Your content is safe. Try again.");
    } finally {
      setBusyId(null);
    }
  }

  if (error) {
    return (
      <div>
        <p className="text-sm text-theme-text-secondary">
          {error}{" "}
          <button type="button" onClick={() => void load()} className="text-xs text-primary-500 hover:text-primary-700">
            Retry
          </button>
        </p>
      </div>
    );
  }

  if (posts === null) {
    return <p className="text-sm text-theme-text-secondary">Loading Buffer posts…</p>;
  }

  if (posts.length === 0) {
    return <p className="text-sm text-theme-text-secondary">No Buffer posts found to repurpose yet.</p>;
  }

  return (
    <ul className="divide-y divide-theme-divider">
      {posts.map((p) => (
        <li key={p.id} className="flex items-start justify-between gap-3 px-5 py-3">
          <div className="min-w-0">
            <p className="line-clamp-2 text-sm text-theme-text-secondary">{p.text}</p>
            <p className="mt-1 text-xs text-theme-text-secondary">
              {p.channelName}
              {p.sentAt ? ` · sent ${new Date(p.sentAt).toLocaleString(undefined, { month: "short", day: "numeric" })}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void repurpose(p)}
            disabled={busyId === p.id}
            className="btn btn-outline-primary btn-sm shrink-0 disabled:opacity-50"
          >
            {busyId === p.id ? "Repurposing…" : "Repurpose"}
          </button>
        </li>
      ))}
    </ul>
  );
}