// Stage 2 memory, built carefully:
//  - Brand voice is EXPLICIT, user-editable fields (tone / forbidden phrases /
//    examples). Never auto-mutated.
//  - User edits to drafts are stored as edit_signals, NOT profile rewrites.
//    A signal only reaches the profile through the confidence-gated confirm
//    surface (see /api/agent/preferences). This is the Section 7 confirm loop:
//    compute confidence, gate the automatic write, ask the user.

import { createServiceClient } from "@/lib/supabase/server";
import type { BrandVoiceProfile, EditSignal, SignalKind } from "@/types/agent";

export interface AgentPreferences {
  autoMode: "assist" | "execute" | "automate";
  brand: BrandVoiceProfile;
  brandSamples: string | null;
  editSignals: EditSignal[];
}

// Default when the table doesn't exist yet (schema_agentic.sql not applied) —
// everything degenerates to "no memory", same degrade-gracefully convention as
// getUserPrompts in lib/prompts.ts.
const MISSING_TABLE_PATTERN =
  /could not find the\s*\w*\s*["']?[\w.]*v4_agent_preferences|does\s*not\s*exist|PGRST205|42P01/i;

function isPrefsUnavailable(err: unknown): boolean {
  if (err && typeof err === "object") {
    const message = (err as { message?: unknown }).message;
    return MISSING_TABLE_PATTERN.test(typeof message === "string" ? message : String(err));
  }
  return err != null && MISSING_TABLE_PATTERN.test(String(err));
}

export async function getAgentPreferences(userId: string): Promise<AgentPreferences | null> {
  try {
    const service = createServiceClient();
    const { data, error } = await service
      .from("v4_agent_preferences")
      .select("auto_mode, brand_tone, brand_forbidden_phrases, brand_examples, brand_samples, edit_signals")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) {
      if (isPrefsUnavailable(error)) return null;
      throw error;
    }
    if (!data) return null;

    return {
      autoMode: data.auto_mode,
      brand: {
        tone: data.brand_tone ?? "",
        forbiddenPhrases: Array.isArray(data.brand_forbidden_phrases) ? data.brand_forbidden_phrases : [],
        examples: Array.isArray(data.brand_examples) ? data.brand_examples : []
      },
      brandSamples: data.brand_samples,
      editSignals: Array.isArray(data.edit_signals) ? (data.edit_signals as unknown as EditSignal[]) : []
    };
  } catch (err) {
    if (isPrefsUnavailable(err)) return null;
    throw err;
  }
}

// Convenience used by the planner: brand voice (empty profile when unset).
export async function getUserBrandVoice(userId: string): Promise<BrandVoiceProfile> {
  const prefs = await getAgentPreferences(userId);
  return prefs?.brand ?? { tone: "", forbiddenPhrases: [], examples: [] };
}

// Creates the row when missing (upsert by user_id). The row itself is safe to
// create — only its mutable fields are gated.
export async function ensureAgentPreferences(userId: string): Promise<void> {
  try {
    const service = createServiceClient();
    await service
      .from("v4_agent_preferences")
      .upsert({ user_id: userId }, { onConflict: "user_id", ignoreDuplicates: true });
  } catch {
    // Never break the app because memory is unavailable.
  }
}

// Append a signal to the capped history. Pure — the write side wraps it so the
// append/cap logic is unit-testable without Supabase. Deliberately keeps the
// newest ~12 signals (a bounded memory: the agent leans on recency, not a
// growing journal).
export function appendSignal(signals: EditSignal[], signal: EditSignal, cap = 12): EditSignal[] {
  return [...signals, signal].slice(-cap);
}

// Record a durable, user-scoped, RLS-protected signal (the write is a per-user
// row update, so it is protected by the v4_agent_preferences policies — the
// caller is the authenticated user via the confirm/gate routes or a service
// write keyed to the user). Append-only history, capped; NEVER a profile
// rewrite by itself.
export async function recordSignal(userId: string, signal: EditSignal): Promise<void> {
  try {
    const service = createServiceClient();
    const prefs = await getAgentPreferences(userId);
    const signals = prefs?.editSignals ?? [];
    const next = appendSignal(signals, signal);
    await service
      .from("v4_agent_preferences")
      .upsert({ user_id: userId, edit_signals: next }, { onConflict: "user_id" });
  } catch {
    // Best-effort memory; a failed signal write never surfaces to the user.
  }
}

// Record a structured signal from a user edit. This is append-only history,
// capped to ~12 recent signals. NOT a profile rewrite.
export async function recordEditSignal(userId: string, signal: EditSignal): Promise<void> {
  await recordSignal(userId, { ...signal, kind: "edit" });
}

// Record an explicit preference the user changed (mode or a brand field). The
// preference itself is written by the PUT /api/agent/preferences route; this is
// the durable signal of the change, so the P5 strategist can see what the user
// tends to move.
export async function recordPreferenceSignal(
  userId: string,
  field: string,
  detail: string
): Promise<void> {
  await recordSignal(userId, {
    kind: "preference",
    outputId: field,
    whatChanged: detail,
    at: new Date().toISOString()
  });
}

// Record a per-angle decision at the human approval gate: the user kept or
// rejected an idea. The title is the durable handle (ideas are re-scored/ranked,
// so a stable-by-title signal survives re-ranking).
export async function recordAngleDecision(
  userId: string,
  ideaTitle: string,
  decision: "approved" | "rejected"
): Promise<void> {
  await recordSignal(userId, {
    kind: "angle_decision",
    outputId: ideaTitle,
    whatChanged: decision,
    at: new Date().toISOString()
  });
}

// Read the user's recent signals — the context the agent (and the P5 strategy
// agent) builds from. Filtered by kind and capped so a caller asks for exactly
// the slice it needs.
export async function getRecentSignals(
  userId: string,
  kind?: SignalKind,
  limit = 12
): Promise<EditSignal[]> {
  const prefs = await getAgentPreferences(userId);
  if (!prefs) return [];
  const signals = kind ? prefs.editSignals.filter((s) => s.kind === kind) : prefs.editSignals;
  return signals.slice(-limit);
}

// Confidence-gated application of signals → actual profile changes. Mirrors the
// roadmap's "confidence-score/confirm loop": never touch the profile
// automatically.
interface SignalSuggestion {
  type: "tone" | "forbidden" | "example";
  suggestion: string;
  confidence: number; // 0..1
  evidence: EditSignal[];
}

export function suggestFromSignals(signals: EditSignal[], minConfidence = 0.6): SignalSuggestion[] {
  if (signals.length < 2) return [];
  const out: SignalSuggestion[] = [];

  // If the same output got edited repeatedly, propose a tone-level note.
  const byOutput = new Map<string, EditSignal[]>();
  for (const s of signals) {
    byOutput.set(s.outputId, [...(byOutput.get(s.outputId) ?? []), s]);
  }
  for (const [outputId, edits] of byOutput) {
    if (edits.length >= 2) {
      out.push({
        type: "tone",
        suggestion: `Output ${outputId.slice(0, 8)} was edited ${edits.length} times — consider a tone refinement.`,
        confidence: Math.min(0.95, 0.5 + edits.length * 0.15),
        evidence: edits
      });
    }
  }

  // Aggregate the most common change themes.
  const buckets = new Map<string, number>();
  for (const s of signals) {
    const key = s.whatChanged.split(/\s+/).slice(0, 4).join(" ").toLowerCase();
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  for (const [theme, count] of buckets) {
    if (count >= 2 && theme.length > 4) {
      out.push({
        type: "forbidden",
        suggestion: `You regularly change drafts around "${theme}" — flag as a forbidden or preferred pattern?`,
        confidence: Math.min(0.9, 0.5 + count * 0.1),
        evidence: signals.filter((s) => s.whatChanged.toLowerCase().includes(theme.split(" ")[0]))
      });
    }
  }

  return out.filter((s) => s.confidence >= minConfidence);
}