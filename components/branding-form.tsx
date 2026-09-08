"use client";

import { useState } from "react";
import Link from "next/link";
import {
  BRAND_VOICE_KEY,
  FORMATS,
  FORMAT_DESCRIPTIONS,
  FORMAT_LABELS,
  PROMPTS,
  type OutputFormat,
  type PromptKey
} from "@/lib/ai/prompts";
import type { UserPromptMap } from "@/lib/prompts";
import PageHeader from "@/components/page-header";

type Status = { ok: boolean; text: string } | null;

function StatusNote({ status, tone }: { status: Status; tone: "muted" | "error" }) {
  if (!status) return null;
  return (
    <p
      className={`text-xs ${tone === "error" ? "text-red-600" : "text-theme-text-secondary"} ${
        status.ok ? "" : "text-red-600"
      }`}
      role={status.ok ? "status" : "alert"}
    >
      {status.text}
    </p>
  );
}

export default function BrandingForm({ initial }: { initial: UserPromptMap }) {
  const allKeys = [...FORMATS, BRAND_VOICE_KEY] as PromptKey[];

  const [values, setValues] = useState<Record<PromptKey, string>>(() => {
    const v = {} as Record<PromptKey, string>;
    for (const k of allKeys) v[k] = initial[k] ?? "";
    return v;
  });
  const [saved, setSaved] = useState<Record<PromptKey, string>>(() => ({ ...values }));
  const [saving, setSaving] = useState<PromptKey | null>(null);
  const [status, setStatus] = useState<{ key: PromptKey; value: Status } | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [confirmAnalyze, setConfirmAnalyze] = useState(false);
  const [analyzeStatus, setAnalyzeStatus] = useState<{ ok: boolean; text: string; needsContent?: boolean } | null>(
    null
  );

  async function analyzeMyContent() {
    setAnalyzing(true);
    setAnalyzeStatus(null);
    try {
      const res = await fetch("/api/prompts/analyze-voice", { method: "POST" });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; code?: string; error?: string; voice?: string } | null;
      if (!res.ok || !data) {
        setAnalyzeStatus({ ok: false, text: data?.error ?? "Could not analyze your content. Try again." });
        return;
      }
      if (data.code === "NOT_ENOUGH_DATA") {
        setAnalyzeStatus({
          ok: false,
          needsContent: true,
          text: "Not enough drafts yet to model your voice on — create something first, then come back."
        });
        return;
      }
      const voice = typeof data.voice === "string" ? data.voice.trim() : "";
      if (!voice) throw new Error("Analysis came back empty — try again.");
      setValues((prev) => ({ ...prev, [BRAND_VOICE_KEY]: voice }));
      setConfirmAnalyze(false);
      setAnalyzeStatus({
        ok: true,
        text: "Voice drafted from your drafts — review it, then save if you like it."
      });
    } catch (err) {
      setAnalyzeStatus({
        ok: false,
        text: err instanceof Error ? err.message : "Could not analyze your content. Try again."
      });
    } finally {
      setAnalyzing(false);
    }
  }

  const dirty = (k: PromptKey) => (values[k] ?? "") !== (saved[k] ?? "");

  async function save(k: PromptKey, value: string) {
    setSaving(k);
    setStatus(null);
    try {
      const res = await fetch("/api/prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format: k, prompt: value })
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error((data?.error as string | undefined) ?? "Could not save your prompt.");
      }
      setSaved((prev) => ({ ...prev, [k]: value.trim() }));
      setStatus({ key: k, value: { ok: true, text: value.trim() ? "Saved." : "Restored to default." } });
    } catch (err) {
      setStatus({
        key: k,
        value: { ok: false, text: err instanceof Error ? err.message : "Something went wrong." }
      });
    } finally {
      setSaving(null);
    }
  }

  function renderFooter(k: PromptKey) {
    const isSaving = saving === k;
    const customized = Boolean((saved[k] ?? "").trim());
    const currentStatus = status?.key === k ? status.value : null;
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-theme-divider px-5 py-3">
        <div className="flex items-center gap-2">
          <span
            className={`badge ${
              customized ? "bg-primary-100 text-primary-700" : "bg-neutral-100 text-neutral-600"
            }`}
          >
            {customized ? "Customised" : "Follows default"}
          </span>
          <StatusNote status={currentStatus} tone={currentStatus?.ok ? "muted" : "error"} />
        </div>
        <div className="flex items-center gap-3">
          {customized && (
            <button
              type="button"
              onClick={() => {
                setValues((prev) => ({ ...prev, [k]: "" }));
                save(k, "");
              }}
              disabled={saving !== null}
              className="btn btn-text-primary btn-sm disabled:opacity-50"
            >
              Restore default
            </button>
          )}
          <button
            type="button"
            onClick={() => save(k, values[k])}
            disabled={saving !== null || !dirty(k)}
            className="btn btn-primary btn-sm disabled:opacity-50"
          >
            {isSaving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="workspace py-8 lg:py-10">
      <PageHeader
        title="Brand &amp; Voice"
        description="Teach VervAI how you sound. Your voice and content preferences are applied whenever you create a draft."
      />

      <div className="grid items-start gap-4 lg:grid-cols-2">
      {/* Brand voice (applies to every format) */}
      <section className="rounded-lg border border-theme-divider bg-theme-bg-paper lg:col-span-2">
        <div className="border-b border-theme-divider px-5 py-4">
          <h2 className="font-display text-base font-semibold">Your voice</h2>
          <p className="mt-0.5 text-xs text-theme-text-secondary">
            Describe your tone, personality, grammar, and the way you communicate. Layered on top of
            every draft.
          </p>
          {confirmAnalyze ? (
            <div className="mt-3 rounded-lg border border-primary-500/30 bg-primary-500/5 p-3">
              <p className="text-xs text-theme-text-secondary">
                This reads a few of your existing drafts and writes a voice description for you. It
                never auto-saves — you review it before saving.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void analyzeMyContent()}
                  disabled={analyzing}
                  className="btn btn-primary btn-sm disabled:opacity-50"
                >
                  {analyzing ? "Analyzing your drafts…" : "Analyze my drafts"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmAnalyze(false)}
                  disabled={analyzing}
                  className="btn btn-sm disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setConfirmAnalyze(true);
                setAnalyzeStatus(null);
              }}
              disabled={analyzing}
              className="btn btn-outline-primary btn-sm mt-3 disabled:opacity-50"
            >
              {analyzing ? "Analyzing your drafts…" : "Draft my voice from my content"}
            </button>
          )}
          {analyzeStatus && (
            <p
              className={`mt-2 text-xs ${analyzeStatus.ok ? "text-green-600" : "text-red-600"}`}
              role={analyzeStatus.ok ? "status" : "alert"}
            >
              {analyzeStatus.text}
              {analyzeStatus.needsContent && (
                <>
                  {" "}
                  <Link href="/upload" className="underline underline-offset-2 hover:text-primary-700">
                          Create something
                        </Link>
                </>
              )}
            </p>
          )}
        </div>
        <div className="px-5 py-4">
          <textarea
            rows={5}
            value={values[BRAND_VOICE_KEY]}
            onChange={(e) => setValues((prev) => ({ ...prev, [BRAND_VOICE_KEY]: e.target.value }))}
            placeholder="e.g. I'm an angel investor documenting the messy middle. Plain-spoken, specific, a little dry humour, no hype words. Refer to me as 'we'."
            className="form-control resize-y"
          />
        </div>
        {renderFooter(BRAND_VOICE_KEY)}
      </section>

      <div className="lg:col-span-2">
        <h2 className="font-display text-base font-semibold">Output preferences</h2>
        <p className="mt-0.5 text-xs text-theme-text-secondary">
          Fine-tune how VervAI writes each type of content. Leave a field blank to follow its
          built-in default.
        </p>
      </div>

      {FORMATS.map((f, i) => (
        <section
          key={f}
          className={`rounded-lg border border-theme-divider bg-theme-bg-paper ${
            i === FORMATS.length - 1 ? "lg:col-span-2" : ""
          }`}
        >
          <div className="border-b border-theme-divider px-5 py-4">
            <h3 className="font-display text-base font-semibold">{FORMAT_LABELS[f as OutputFormat]}</h3>
            <p className="mt-0.5 text-xs text-theme-text-secondary">
              {FORMAT_DESCRIPTIONS[f as OutputFormat]}
            </p>
          </div>
          <div className="px-5 py-4">
            <textarea
              rows={8}
              value={values[f as PromptKey]}
              onChange={(e) => setValues((prev) => ({ ...prev, [f as PromptKey]: e.target.value }))}
              placeholder="Your rules for this format…"
              className="form-control resize-y"
            />
            <details className="group mt-2">
              <summary className="caption cursor-pointer select-none text-theme-text-secondary transition-colors hover:text-theme-text-primary">
                View default prompt for {FORMAT_LABELS[f as OutputFormat]}
              </summary>
              <pre className="mt-2 max-h-32 overflow-auto rounded-lg border border-theme-divider bg-neutral-50 p-3 whitespace-pre-wrap text-xs leading-relaxed text-theme-text-secondary">
                {PROMPTS[f as OutputFormat]}
              </pre>
            </details>
          </div>
          {renderFooter(f as PromptKey)}
        </section>
      ))}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-theme-divider bg-theme-bg-paper px-5 py-4 lg:col-span-2">
        <p className="text-sm text-theme-text-secondary">
          Voice and output preferences are applied the moment a draft is generated.
        </p>
        <Link href="/agent" className="btn btn-outline-primary btn-sm shrink-0">
          Try it — draft something →
        </Link>
      </div>
      </div>
    </div>
  );
}