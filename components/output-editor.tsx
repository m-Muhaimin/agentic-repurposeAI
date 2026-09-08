"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { trackClient } from "@/lib/billing/usage-client";
import { EVENTS } from "@/lib/analytics/event-names";
import CopyButton from "./copy-button";
import SegmentedControl from "./segmented-control";

type Mode = "preview" | "edit";

export default function OutputEditor({
  outputId,
  initialContent
}: {
  outputId: string;
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