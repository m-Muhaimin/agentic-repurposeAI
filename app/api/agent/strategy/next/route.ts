import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { resolvePlan } from "@/lib/billing/entitlements";
import { getUsageSnapshot } from "@/lib/billing/usage";
import { getRecentSignals } from "@/lib/agent/memory";
import { aggregateMonthlySpend, type MonthlyAgentSpend } from "@/lib/agent/spend";
import { buildCandidates, toStrategyIdea, type StrategyIdea, type StrategyResult } from "@/lib/agent/strategy";
import type { OutputFormat } from "@/types/agent";
import { log } from "@/lib/logger";

// POST /api/agent/strategy/next — the P5 strategy agent (V1→V2 gate).
//
// Answers "what should I publish next?" WITHOUT requiring the user to pick a
// source first. It derives candidates server-side from the user's OWN data
// (sources with ready transcripts, existing v4_content_ideas with their P3
// scores, edit/angle signals, recent outputs, available plan budget), picks a
// recommendation deterministically (buildCandidates), adds ONE bounded
// LLM-assisted rationale, and persists an append-only snapshot. The
// recommendation carries `sourceId` + `mode` so the existing runs POST
// (`{ sourceId, mode }`) can hand "publish next" straight into the
// orchestrator — the strategy never forks that flow.

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const MODEL = "gemini-3.6-flash";

// Single, bounded LLM call — NO retry loop. Advisory only: it writes a
// natural-language rationale grounded in the deterministic result; it can
// never override the decision. On failure we fall back to a deterministic
// rationale that restates the facts (never fabricates numbers).
async function writeRationale(res: StrategyResult, mode: "MISSING_SOURCES" | "BUDGET" | "READY"): Promise<string> {
  try {
    const model = genAI.getGenerativeModel({
      model: MODEL,
      generationConfig: { temperature: 0.4, maxOutputTokens: 300 }
    });
    const rec = res.recommended;
    const headroom = res.headroom;
    const maxReasons = rec?.reasons.slice(0, 4) ?? [];

    const prompt = `You are the publish strategist inside a repurposing tool. The candidate
ranking below was computed deterministically from the user's real data (source
transcripts, objective idea scores, their edit/angle decisions, their recent
formats, and their plan budget). Write 1-2 short, plain paragraphs of rationale
for the recommended next action. Do NOT invent metrics or outcomes. Ground every
claim ONLY in the facts provided. No markdown.

Context:
- State: ${mode}
${rec ? `- Recommended source: ${rec.sourceTitle}\n- Best angle: ${rec.angleTitle ?? "(none yet — planner will derive)"}\n- Recommended formats: ${rec.formats.length ? rec.formats.join(", ") : "all three available"}\n- Objective priority: ${rec.score}\n- Deterministic reasons: ${maxReasons.join(" ")}` : "- No recommendation (no runnable source, or monthly budget exhausted)."}
- Monthly job budget: ${headroom.jobsLimit === null ? "unlimited" : `${headroom.jobsUsed} of ${headroom.jobsLimit} used, ${headroom.jobsRemaining} remaining`}.
- Per-run agent budget: ${headroom.perRunAgent.maxSteps} steps / ${headroom.perRunAgent.maxCostUnits} cost units / ${headroom.perRunAgent.maxRuntimeSeconds}s runtime.`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    if (text.length < 10) throw new Error("empty rationale");
    return text;
  } catch {
    // Bounded: a failed advisory call degrades to a deterministic, factual
    // restatement — it never blocks the recommendation itself.
    return deterministicRationale(res);
  }
}

function deterministicRationale(res: StrategyResult): string {
  const rec = res.recommended;
  const headroom = res.headroom;
  if (!rec) {
    return headroom.atLimit
      ? `No next action: your monthly job budget is exhausted (${headroom.jobsUsed} of ${headroom.jobsLimit} used). It resets at the start of next month.`
      : "No next action: none of your sources has a ready transcript yet. Create or finish transcribing a source first.";
  }
  return `Publish next from "${rec.sourceTitle}"${rec.angleTitle ? ` around the angle "${rec.angleTitle}"` : ""} as ${rec.formats.length ? rec.formats.join(", ") : "your usual formats"}. It ranks highest on your objective scores and recent behaviour. You have ${headroom.jobsRemaining === null ? "no monthly cap" : `${headroom.jobsRemaining} job${headroom.jobsRemaining === 1 ? "" : "s"} left this month`}; a run here stays within your ${headroom.perRunAgent.maxSteps}-step budget.`;
}

// GET /api/agent/strategy/next — passive read of the latest strategy snapshot
// + a fresh deterministic recomputation of buildCandidates (no LLM call, no
// write). The strategy panel loads passively from this; only the "Publish next"
// button triggers a POST to refresh the rationale.
export async function GET() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const service = createServiceClient();
  const userId = user.id;

  const plan = await resolvePlan(userId);
  const usage = await getUsageSnapshot(userId, plan);
  const now = new Date();

  // Sources
  let sourcesOut: Array<{ id: string; title: string; hasTranscript: boolean }> = [];
  try {
    const { data: sources } = await service
      .from("sources")
      .select("id, title, status, transcript")
      .eq("user_id", userId);
    sourcesOut = (sources ?? []).map((s: { id: string; title: string | null; status: string; transcript: string | null }) => ({
      id: s.id,
      title: s.title ?? "Untitled source",
      hasTranscript: (s.status === "done" || s.status === "failed") && Boolean(s.transcript && s.transcript.trim())
    }));
  } catch {
    sourcesOut = [];
  }

  // Ideas + runs → StrategyIdea[]
  let ideas: StrategyIdea[] = [];
  try {
    const [{ data: runs }, { data: ideaRows }] = await Promise.all([
      service.from("v4_agent_runs").select("id, source_id").eq("user_id", userId),
      service.from("v4_content_ideas").select("id, run_id, title, suggested_formats, evaluation").eq("user_id", userId)
    ]);
    const sourceByRun: Record<string, string> = {};
    for (const r of (runs ?? []) as Array<{ id: string; source_id: string }>) sourceByRun[r.id] = r.source_id;
    ideas = (ideaRows ?? [])
      .map((row: { run_id: string; title: string; suggested_formats: unknown; evaluation: unknown }) =>
        toStrategyIdea(row, sourceByRun)
      )
      .filter((i: StrategyIdea) => i.sourceId);
  } catch {
    ideas = [];
  }

  // Recent output formats
  const seen = new Set<string>();
  let recentFormats: string[] = [];
  try {
    const { data: outputs } = await service
      .from("outputs")
      .select("format")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);
    recentFormats = (outputs ?? [])
      .map((o: { format: string }) => o.format)
      .filter((f: string) => {
        if (seen.has(f)) return false;
        seen.add(f);
        return true;
      });
  } catch {
    recentFormats = [];
  }

  const signals = await getRecentSignals(userId);
  const agentBudget = plan.limits.agent;

  // P9: Query monthly agent runs for the spend summary (service-role, never
  // trust client-supplied data). Aggregates real token counts + cost units.
  let monthlySpend: MonthlyAgentSpend | null = null;
  try {
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
    const { data: monthRuns } = await service
      .from("v4_agent_runs")
      .select("input_tokens, output_tokens, cost_units, status")
      .eq("user_id", userId)
      .gte("created_at", monthStart);
    monthlySpend = aggregateMonthlySpend(monthRuns ?? []);
  } catch {
    monthlySpend = null;
  }

  const result = buildCandidates({
    sources: sourcesOut,
    ideas,
    signals,
    recentFormats: recentFormats as OutputFormat[],
    budget: { jobsLimit: plan.limits.maxJobsPerMonth, jobsUsed: usage.jobsUsed, agent: agentBudget }
  });

  // Fetch the latest snapshot (if any) for its LLM rationale. Ordered by
  // created_at desc; we only need one row.
  let latestRationale: string | null = null;
  let strategyId: string | null = null;
  try {
    const { data: snap } = await service
      .from("v4_content_strategies")
      .select("id, body, created_at")
      .eq("user_id", userId)
      .eq("source", "planner")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (snap?.body) {
      strategyId = snap.id;
      // The body contains the rationale as the last newline-separated block
      // after the metadata lines. Extract it.
      const lines = snap.body.split("\n");
      const metaPrefixes = ["Recommendation:", "Budget:", "Per-run:"];
      const rationaleStart = lines.findIndex((line: string) => !metaPrefixes.some((p) => line.startsWith(p)));
      latestRationale = rationaleStart >= 0 ? lines.slice(rationaleStart).join("\n").trim() : snap.body;
    }
  } catch {
    // No snapshot yet — that's fine.
  }

  return NextResponse.json({
    ok: true,
    strategyId,
    recommended: result.recommended,
    ranked: result.ranked,
    exclusions: result.exclusions,
    headroom: result.headroom,
    rationale: latestRationale,
    monthlySpend
  });
}

export async function POST() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const service = createServiceClient();
  const userId = user.id;

  // Server-side plan + budget resolution (never trust client-supplied plan).
  const plan = await resolvePlan(userId);
  const usage = await getUsageSnapshot(userId, plan);

  // 1) Sources the user can actually run (owner-scoped read; a source is ready
  //    when it carries a transcript, matching the runs POST gate).
  const { data: sources, error: srcErr } = await service
    .from("sources")
    .select("id, title, status, transcript")
    .eq("user_id", userId);
  if (srcErr) {
    log.error("agent.strategy_next_sources_failed", new Error(srcErr.message), { user_id: userId });
    return NextResponse.json({ error: "Failed to load sources." }, { status: 500 });
  }
  const sourcesOut = (sources ?? []).map((s: { id: string; title: string | null; status: string; transcript: string | null }) => ({
    id: s.id,
    title: s.title ?? "Untitled source",
    hasTranscript: (s.status === "done" || s.status === "failed") && Boolean(s.transcript && s.transcript.trim())
  }));

  // 2) The user's ideas with their P3 scores, mapped run → source. Missing
  //    agent tables degrade to "no ideas yet" (a sources-only recommendation),
  //    never a 500 — same graceful-grace convention as the runs/strategy reads.
  let ideas: StrategyIdea[] = [];
  try {
    const [{ data: runs }, { data: ideaRows }] = await Promise.all([
      service.from("v4_agent_runs").select("id, source_id").eq("user_id", userId),
      service.from("v4_content_ideas").select("id, run_id, title, suggested_formats, evaluation").eq("user_id", userId)
    ]);
    const sourceByRun: Record<string, string> = {};
    for (const r of (runs ?? []) as Array<{ id: string; source_id: string }>) sourceByRun[r.id] = r.source_id;
    ideas = (ideaRows ?? [])
      .map((row: { run_id: string; title: string; suggested_formats: unknown; evaluation: unknown }) =>
        toStrategyIdea(row, sourceByRun)
      )
      .filter((i: StrategyIdea) => i.sourceId);
  } catch {
    ideas = [];
  }

  // 3) Recent output formats (what the user has actually produced).
  const seen = new Set<string>();
  let recentFormats: string[] = [];
  try {
    const { data: outputs } = await service
      .from("outputs")
      .select("format")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);
    recentFormats = (outputs ?? [])
      .map((o: { format: string }) => o.format)
      .filter((f: string) => {
        if (seen.has(f)) return false;
        seen.add(f);
        return true;
      });
  } catch {
    recentFormats = [];
  }

  // 4) Signals (edit + angle decisions).
  const signals = await getRecentSignals(userId);

  // 5) Budget (jobs read is display-grade, matching the base app).
  const agentBudget = plan.limits.agent;

  // P9: Monthly agent spend summary (service-role query).
  const postNow = new Date();
  let monthlySpendPost: MonthlyAgentSpend | null = null;
  try {
    const monthStart = new Date(Date.UTC(postNow.getUTCFullYear(), postNow.getUTCMonth(), 1)).toISOString();
    const { data: monthRuns } = await service
      .from("v4_agent_runs")
      .select("input_tokens, output_tokens, cost_units, status")
      .eq("user_id", userId)
      .gte("created_at", monthStart);
    monthlySpendPost = aggregateMonthlySpend(monthRuns ?? []);
  } catch {
    monthlySpendPost = null;
  }

  const result = buildCandidates({
    sources: sourcesOut,
    ideas,
    signals,
    recentFormats: recentFormats as OutputFormat[],
    budget: { jobsLimit: plan.limits.maxJobsPerMonth, jobsUsed: usage.jobsUsed, agent: agentBudget }
  });

  const mode = result.recommended ? "READY" : result.headroom.atLimit ? "BUDGET" : "MISSING_SOURCES";
  const rationale = await writeRationale(result, mode);

  // 6) Persist an append-only, user-scoped, RLS-protected snapshot. Reuses the
  //    existing v4_content_strategies table's `planner` source enum — no new
  //    parallel storage, no schema change. A timestamped title keeps each
  //    snapshot distinct under the (user_id, title) unique constraint.
  let strategyId: string | null = null;
  const title = `Next publish — ${new Date().toISOString()}`;
  const body = [
    `Recommendation: ${result.recommended ? `${result.recommended.sourceTitle} (${result.recommended.angleTitle ?? "fresh angles"})` : "none"}.`,
    `Budget: ${usage.jobsUsed}/${plan.limits.maxJobsPerMonth ?? "∞"} jobs used this month.`,
    `Per-run: ${agentBudget.maxSteps} steps / ${agentBudget.maxCostUnits} cost.`,
    rationale
  ].join("\n");
  const { data: inserted, error: insErr } = await service
    .from("v4_content_strategies")
    .insert({ user_id: userId, title, body, source: "planner" })
    .select("id")
    .maybeSingle();
  if (insErr) {
    // Best-effort persistence — never surface a strategy failure to the user
    // as a recommendation failure (same degrade-gracefully convention as memory).
    log.warn("agent.strategy_snapshot_failed", { user_id: userId, error: insErr.message });
  } else {
    strategyId = inserted?.id ?? null;
  }

  log.info("agent.strategy_next_ok", {
    user_id: userId,
    sources: sourcesOut.length,
    ready: sourcesOut.filter((s: { hasTranscript: boolean }) => s.hasTranscript).length,
    ideas: ideas.length,
    recommended: result.recommended?.sourceId ?? null,
    at_limit: result.headroom.atLimit
  });

  return NextResponse.json({
    ok: true,
    strategyId,
    recommended: result.recommended,
    ranked: result.ranked,
    exclusions: result.exclusions,
    headroom: result.headroom,
    rationale,
    monthlySpend: monthlySpendPost
  });
}
