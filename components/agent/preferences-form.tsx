"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardHeader } from "@/components/card";
import SegmentedControl from "@/components/segmented-control";
import { AGENT_MODES, AGENT_MODE_LABEL, type AgentMode } from "@/types/agent";

// Agent preferences form (Stage 2 memory surface). Owns all fetching:
//  - GET  /api/agent/preferences on mount (loading / error states below)
//  - PUT  /api/agent/preferences on Save (mode + brand voice, explicitly edited)
//  - POST /api/agent/preferences/confirm per tone suggestion (the Section 7
//    confirm gate — suggestions are surfaced, never auto-applied)
// The confirm route only accepts `field: "tone"` in V1, so only tone
// suggestions get an apply button; the rest are honest manual-only notes.

// Local mirror of the GET response shape (server is the source of truth).
interface PrefSuggestion {
  type: "tone" | "forbidden" | "example";
  suggestion: string;
  confidence: number;
  evidence: Array<{ kind: string; outputId: string; whatChanged: string; at: string }>;
}

interface PrefsPayload {
  autoMode: AgentMode;
  brand: { tone: string; forbiddenPhrases: string[]; examples: string[] };
  brandSamples: string | null;
  suggestions: PrefSuggestion[];
}

type Status = { ok: boolean; text: string } | null;

// Grounded in lib/agent/permissions.ts capability sets — assist never revises,
// execute adds one bounded auto-revision, automate adds distribute/strategize.
const MODE_DESCRIPTIONS: Record<AgentMode, string> = {
  assist:
    "Plans from your source, waits for your approval on every angle, then drafts and rates the results. It never revises drafts on its own and never publishes.",
  execute:
    "Everything in Guide me, plus one bounded auto-revision pass on drafts it flags as weak. It still never publishes.",
  automate:
    "Everything in Do it with my approval, plus distribution and strategy tools once a channel is connected. Nothing is posted without a human signal to send."
};

function StatusNote({ status }: { status: Status }) {
  if (!status) return null;
  return (
    <p
      className={`text-xs ${status.ok ? "text-green-600" : "text-red-600"}`}
      role={status.ok ? "status" : "alert"}
    >
      {status.text}
    </p>
  );
}

// List editor for the explicit brand-voice arrays (forbidden phrases,
// examples): an add input + removable rows. Entries are trimmed, non-empty,
// and de-duplicated.
function ListEditor({
  items,
  onAdd,
  onRemove,
  placeholder,
  emptyText
}: {
  items: string[];
  onAdd: (value: string) => void;
  onRemove: (index: number) => void;
  placeholder: string;
  emptyText: string;
}) {
  const [draft, setDraft] = useState("");

  function add() {
    const value = draft.trim();
    if (!value || items.includes(value)) {
      setDraft("");
      return;
    }
    onAdd(value);
    setDraft("");
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={placeholder}
          className="form-control py-2.5 text-sm"
        />
        <button
          type="button"
          onClick={add}
          disabled={!draft.trim()}
          className="btn btn-outline-primary btn-sm shrink-0 disabled:opacity-50"
        >
          Add
        </button>
      </div>
      {items.length === 0 ? (
        <p className="caption text-theme-text-secondary">{emptyText}</p>
      ) : (
        <ul className="divide-y divide-theme-divider rounded-lg border border-theme-divider">
          {items.map((item, i) => (
            <li
              key={`${item}-${i}`}
              className="flex items-center justify-between gap-3 px-3 py-2"
            >
              <span className="min-w-0 text-sm text-theme-text-primary">{item}</span>
              <button
                type="button"
                onClick={() => onRemove(i)}
                className="btn btn-text-primary btn-sm shrink-0"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function PreferencesForm() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [autoMode, setAutoMode] = useState<AgentMode>("assist");
  const [tone, setTone] = useState("");
  const [forbidden, setForbidden] = useState<string[]>([]);
  const [examples, setExamples] = useState<string[]>([]);
  const [brandSamples, setBrandSamples] = useState("");
  const [suggestions, setSuggestions] = useState<PrefSuggestion[]>([]);

  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<Status>(null);
  const [confirming, setConfirming] = useState<number | null>(null);
  const [confirmStatus, setConfirmStatus] = useState<Status>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/agent/preferences");
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setLoadError(data?.error ?? "Couldn't load your preferences. Try again.");
        return;
      }
      const body = (await res.json()) as PrefsPayload;
      setAutoMode(body.autoMode ?? "assist");
      setTone(body.brand?.tone ?? "");
      setForbidden(Array.isArray(body.brand?.forbiddenPhrases) ? body.brand.forbiddenPhrases : []);
      setExamples(Array.isArray(body.brand?.examples) ? body.brand.examples : []);
      setBrandSamples(typeof body.brandSamples === "string" ? body.brandSamples : "");
      setSuggestions(Array.isArray(body.suggestions) ? body.suggestions : []);
    } catch {
      setLoadError("Couldn't load your preferences. Try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    setSaving(true);
    setSaveStatus(null);
    try {
      const res = await fetch("/api/agent/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          autoMode,
          tone,
          forbiddenPhrases: forbidden,
          examples,
          brandSamples: brandSamples.trim() ? brandSamples : null
        })
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !data?.ok) {
        setSaveStatus({ ok: false, text: data?.error ?? "Could not save your preferences. Try again." });
        return;
      }
      setSaveStatus({ ok: true, text: "Preferences saved." });
    } catch {
      setSaveStatus({ ok: false, text: "Could not save your preferences. Try again." });
    } finally {
      setSaving(false);
    }
  }

  async function confirmSuggestion(index: number) {
    const s = suggestions[index];
    if (!s || s.type !== "tone") return;
    setConfirming(index);
    setConfirmStatus(null);
    try {
      const res = await fetch("/api/agent/preferences/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field: "tone", value: s.suggestion })
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !data?.ok) {
        setConfirmStatus({ ok: false, text: data?.error ?? "Could not apply the suggestion. Try again." });
        return;
      }
      // The confirmed tone now lives on the server — reflect it locally so the
      // field matches what VervAI will use (never clobbering what the user is
      // mid-typing). The user can tweak it and hit Save.
      setTone((current) => (current.trim() ? current : s.suggestion));
      setConfirmStatus({
        ok: true,
        text: "Applied to your tone — review and adjust it in Brand voice if you want."
      });
    } catch {
      setConfirmStatus({ ok: false, text: "Could not apply the suggestion. Try again." });
    } finally {
      setConfirming(null);
    }
  }

  if (loading) {
    return (
      <Card>
        <div className="space-y-3 px-5 py-6">
          <div className="h-4 w-2/3 animate-pulse rounded bg-neutral-100" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-neutral-100" />
          <div className="h-24 w-full animate-pulse rounded bg-neutral-100" />
          <div className="h-24 w-full animate-pulse rounded bg-neutral-100" />
        </div>
      </Card>
    );
  }

  if (loadError) {
    return (
      <Card>
        <div className="px-5 py-6">
          <p className="text-sm text-red-600" role="alert">
            {loadError}
          </p>
          <button
            type="button"
            onClick={() => void load()}
            className="btn btn-outline-primary btn-sm mt-3"
          >
            Try again
          </button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Autonomy mode */}
      <Card>
        <CardHeader
          title="Autonomy mode"
          description="How much VervAI is allowed to do on its own. Every mode plans, waits for your approval on each angle, then drafts."
        />
        <div className="space-y-3 px-5 py-4">
          <SegmentedControl<AgentMode>
            options={AGENT_MODES.map((m) => ({ id: m, label: AGENT_MODE_LABEL[m] }))}
            value={autoMode}
            onChange={setAutoMode}
            ariaLabel="Autonomy mode"
          />
          <p className="text-xs text-theme-text-secondary">{MODE_DESCRIPTIONS[autoMode]}</p>
        </div>
      </Card>

      {/* Brand voice — explicit, user-edited fields */}
      <Card>
        <CardHeader
          title="Brand voice"
          description="How you want VervAI to sound in every draft. These fields are layered into generation; your edits are never rewritten behind your back."
        />
        <div className="space-y-5 px-5 py-4">
          <div>
            <label htmlFor="pref-tone" className="form-label">
              Tone
            </label>
            <textarea
              id="pref-tone"
              rows={5}
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              placeholder="e.g. Plain-spoken, specific, a little dry humour, no hype words. Refer to me as 'we'."
              className="form-control resize-y"
            />
          </div>

          <div>
            <label htmlFor="pref-forbidden" className="form-label">
              Forbidden phrases
            </label>
            <ListEditor
              items={forbidden}
              onAdd={(v) => setForbidden((prev) => [...prev, v])}
              onRemove={(i) => setForbidden((prev) => prev.filter((_, idx) => idx !== i))}
              placeholder="Add a phrase VervAI should never use…"
              emptyText="None yet."
            />
          </div>

          <div>
            <label htmlFor="pref-examples" className="form-label">
              Examples
            </label>
            <ListEditor
              items={examples}
              onAdd={(v) => setExamples((prev) => [...prev, v])}
              onRemove={(i) => setExamples((prev) => prev.filter((_, idx) => idx !== i))}
              placeholder="Add a sentence that sounds like you…"
              emptyText="None yet."
            />
          </div>

          <div>
            <label htmlFor="pref-brand-samples" className="form-label">
              Brand samples
            </label>
            <textarea
              id="pref-brand-samples"
              rows={4}
              value={brandSamples}
              onChange={(e) => setBrandSamples(e.target.value)}
              placeholder="Optional: paste a few pieces of writing you love (or hate) to anchor VervAI's style."
              className="form-control resize-y"
            />
          </div>
        </div>
      </Card>

      {/* Suggestions — confidence-gated, confirm loop only */}
      <Card>
        <CardHeader
          title="Suggestions from your edits"
          description="Patterns VervAI noticed in how you edit drafts. Nothing here is applied automatically — you confirm each one."
          action={<StatusNote status={confirmStatus} />}
        />
        {suggestions.length === 0 ? (
          <p className="px-5 pb-5 text-sm text-theme-text-secondary">
            No suggestions yet. They appear here as VervAI notices patterns in how you edit your
            drafts — and they are never applied without your say-so.
          </p>
        ) : (
          <ul className="divide-y divide-theme-divider">
            {suggestions.map((s, i) => (
              <li key={`${s.type}-${i}`} className="flex flex-wrap items-start justify-between gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-theme-text-primary">{s.suggestion}</p>
                  <p className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-theme-text-secondary">
                    <span className="badge bg-primary-100 text-primary-500">
                      {Math.round(s.confidence * 100)}% confidence
                    </span>
                    <span>
                      {s.evidence.length} edit{s.evidence.length === 1 ? "" : "s"}
                    </span>
                  </p>
                </div>
                {s.type === "tone" ? (
                  <button
                    type="button"
                    onClick={() => void confirmSuggestion(i)}
                    disabled={confirming !== null}
                    className="btn btn-outline-primary btn-sm shrink-0 disabled:opacity-50"
                  >
                    {confirming === i ? "Applying…" : "Apply to tone"}
                  </button>
                ) : (
                  <p className="shrink-0 text-xs text-theme-text-secondary">
                    Only tone suggestions can be auto-applied in this version — make this change in
                    Brand voice above.
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Save */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-theme-divider bg-theme-bg-paper px-5 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="badge bg-neutral-100 text-neutral-600">
            {AGENT_MODE_LABEL[autoMode]}
          </span>
          <StatusNote status={saveStatus} />
        </div>
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="btn btn-primary btn-sm disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}