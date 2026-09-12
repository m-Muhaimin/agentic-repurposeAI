"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { trackClient } from "@/lib/billing/usage-client";
import { EVENTS } from "@/lib/analytics/event-names";
import type { OutputFormat } from "@/lib/ai/prompts";
import { exportOutput } from "@/lib/export";
import CopyButton from "./copy-button";
import SegmentedControl from "./segmented-control";

type Mode = "preview" | "edit";

export default function OutputEditor({
  outputId,
  format,
  initialContent
}: {
  outputId: string;
  format: OutputFormat;
  initialContent: string;
}) {
  const [mode, setMode] = useState<Mode>("preview");
  const [draft, setDraft] = useState(initialContent);
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const dirty = draft !== initialContent;
  const wordCount = draft.trim() ? draft.trim().split(/\s+/).length : 0;

  useEffect(() => {
    void trackClient(EVENTS.DRAFT_OPENED, { outputId });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- purpose: once per open
  }, []);

  function switchMode(next: Mode) {
    setMode(next);
    setMessage(null);
    setError(null);
  }

  async function handleSave() {
    if (!draft.trim()) {
      setError("The output can't be empty.");
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/outputs/${outputId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: draft })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Could not save changes.");
      }
      setMessage("Saved. The draft was updated.");
      setMode("preview");
      void trackClient(EVENTS.SAVE_BUTTON_CLICKED, { outputId });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRegenerate() {
    setRegenerating(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/outputs/${outputId}/regenerate`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Could not regenerate this draft.");
      }
      const data = await res.json();
      setDraft(data.content);
      setMode("preview");
      setMessage("Regenerated. A fresh draft was saved.");
      void trackClient(EVENTS.REGENERATION_USED, { outputId });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setRegenerating(false);
    }
  }

  function handleDiscard() {
    setDraft(initialContent);
    setError(null);
    setMessage(null);
    setMode("preview");
  }

  function handleExport() {
    const file = exportOutput(draft, format);
    const blob = new Blob([file.content], { type: file.mime });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = file.filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  function handleLinkedInShare() {
    const url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.href)}`;
    window.open(url, "_blank", "noopener");
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-theme-divider px-6 py-4">
        <SegmentedControl
          ariaLabel="Preview or edit the draft"
          value={mode}
          onChange={switchMode}
          options={[
            { id: "preview", label: "Preview" },
            { id: "edit", label: "Edit" }
          ]}
        />
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleRegenerate}
            disabled={saving || regenerating}
            className="btn btn-text-primary btn-sm"
          >
            <span className="flex items-center gap-1.5">
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
                <path d="M21 12a9 9 0 1 1-9-9c2.5 0 4.7 1 6.3 2.6L21 8.5" />
                <path d="M21 3v5.5H15.5" />
              </svg>
              {regenerating ? "Regenerating…" : "Regenerate"}
            </span>
          </button>
          <CopyButton text={draft} />
          <button
            type="button"
            onClick={handleExport}
            disabled={saving || regenerating}
            className="btn btn-outline-primary btn-sm shrink-0"
          >
            <span className="flex items-center gap-1.5">
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
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <path d="M7 10l5 5 5-5" />
                <path d="M12 15V3" />
              </svg>
              Export
            </span>
          </button>
          <button
            type="button"
            onClick={handleLinkedInShare}
            disabled={saving || regenerating}
            className="btn btn-outline-primary btn-sm shrink-0"
          >
            <span className="flex items-center gap-1.5">
              <svg
                viewBox="0 0 24 24"
                fill="currentColor"
                className="size-4"
                aria-hidden="true"
              >
                <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.07 2.07 0 1 1 0-4.14 2.07 2.07 0 0 1 0 4.14zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z" />
              </svg>
              Post to LinkedIn
            </span>
          </button>
        </div>
      </div>

      {(dirty || message || error) && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center gap-2 border-b border-theme-divider px-6 py-2.5"
        >
          {dirty ? (
            <p className="flex items-center gap-2 text-sm text-amber-700">
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
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v4" />
                <path d="M12 16h.01" />
              </svg>
              Unsaved changes — save or discard when you&apos;re done.
            </p>
          ) : message ? (
            <p className="flex items-center gap-2 text-sm text-green-600">
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
                <path d="M20 6 9 17l-5-5" />
              </svg>
              {message}
            </p>
          ) : error ? (
            <p className="flex items-center gap-2 text-sm text-red-600">
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
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v4" />
                <path d="M12 16h.01" />
              </svg>
              {error}
            </p>
          ) : null}
        </div>
      )}

      <div className="px-6 py-6">
        {mode === "preview" ? (
          <div className="md-preview">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{draft}</ReactMarkdown>
          </div>
        ) : (
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={20}
            spellCheck={false}
            aria-label="Edit output (markdown)"
            className="form-control resize-y font-mono text-sm"
          />
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-theme-divider px-6 py-4">
        <p className="text-sm text-theme-text-secondary">
          {mode === "edit" ? `${wordCount} words` : "Generated from your recording with VervAI"}
        </p>
        {mode === "edit" ? (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleDiscard}
              disabled={saving || regenerating}
              className="btn btn-text-primary btn-sm"
            >
              Discard
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || regenerating}
              className="btn btn-primary btn-sm"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        ) : (
          message && (
            <div className="flex items-center gap-3">
              <Link href="/library" className="btn btn-outline-primary btn-sm">
                Back to library
              </Link>
            </div>
          )
        )}
      </div>
    </div>
  );
}