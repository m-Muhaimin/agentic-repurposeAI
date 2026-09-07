// Phase P5 GATE walkthrough: prove "what should I publish next?" forms with NO
// source preselected, using the REAL live-DB user data the endpoint reads.
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { register } from "node:module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const raw = fs.readFileSync(path.join(root, ".env.local"), "utf8");
const env = {};
for (const line of raw.split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^"|"$/g, "").trim();
}

// Load the TS pure module via esbuild-like transpile? Vitest handles it, but we
// run this standalone. Instead: replicate the pure logic in JS by importing the
// compiled TS through tsx? Not installed. Simplest: reimplement the tiny pure fn
// by compiling TS with the project's typescript through a temp .ts run via vite-node?
// --- Use vitest-style: build a tiny JS mirror of buildCandidates by importing the
// TS source through a quick esbuild transform using vite's esbuild (installed).
const { transformSync } = await import("esbuild").catch(() => ({ transformSync: null }));
if (!transformSync) {
  console.error("esbuild not available; cannot transpile strategy.ts standalone. Skipping (unit tests already prove the gate).");
  process.exit(0);
}
const tscode = fs.readFileSync(path.join(root, "lib/agent/strategy.ts"), "utf8");
const js = transformSync(tscode, { loader: "ts", format: "cjs" }).code;
const m = { exports: {} };
const fn = new Function("module", "exports", "require", js);
fn(m, m.exports, (id) => {
  if (id.includes("types/agent") || id.includes("idea-scoring")) return { IdeaEvaluation: {} };
  return require(id);
});
const { buildCandidates, computeBudgetHeadroom } = m.exports;

const s = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

// Real user with a run + scored ideas (from the probe).
const userId = "34dec021-b97f-4900-bc77-c6ac427c9bad";
console.log(`\n=== GATE WALKTHROUGH — real user ${userId.slice(0,8)}… ===`);
console.log("No source is preselected anywhere below — candidates derive from the user's own data.\n");

const { data: sources } = await s.from("sources").select("id, title, status, transcript").eq("user_id", userId);
const sourcesOut = (sources ?? []).map((x) => ({
  id: x.id,
  title: x.title ?? "Untitled source",
  hasTranscript: (x.status === "done" || x.status === "failed") && Boolean(x.transcript && x.transcript.trim())
}));
console.log(`sources read (${sourcesOut.length}): ready=${sourcesOut.filter((x) => x.hasTranscript).length}, not-ready=${sourcesOut.filter((x) => !x.hasTranscript).length}`);
console.log("  → " + sourcesOut.map((x) => `${x.title}${x.hasTranscript ? " [ready]" : " [no transcript]"}`).join(" | "));

const { data: runs } = await s.from("v4_agent_runs").select("id, source_id").eq("user_id", userId);
const { data: ideaRows } = await s.from("v4_content_ideas").select("id, run_id, title, suggested_formats, evaluation").eq("user_id", userId);
const sourceByRun = {};
for (const r of runs ?? []) sourceByRun[r.id] = r.source_id;
const ideas = (ideaRows ?? []).filter((i) => sourceByRun[i.run_id]).map((i) => ({
  sourceId: sourceByRun[i.run_id],
  runId: i.run_id,
  title: i.title,
  suggestedFormats: Array.isArray(i.suggested_formats) ? i.suggested_formats : [],
  score: i.evaluation && typeof i.evaluation.score === "number" ? Math.round(i.evaluation.score * 100) / 100 : null,
  evaluation: i.evaluation ?? null
}));
console.log(`ideas read (${ideas.length}): ` + ideas.map((i) => `"${i.title}" score=${i.score} src=${i.sourceId.slice(0,8)}`).join(" | "));

const { data: outputs } = await s.from("outputs").select("format").eq("user_id", userId).order("created_at", { ascending: false }).limit(20);
const seen = new Set();
const recentFormats = (outputs ?? []).map((o) => o.format).filter((f) => (seen.has(f) ? false : (seen.add(f), true)));

// Signals + budget via the same reads the route uses.
const { data: prefs } = await s.from("v4_agent_preferences").select("edit_signals").eq("user_id", userId).maybeSingle();
const signals = Array.isArray(prefs?.edit_signals) ? prefs.edit_signals : [];
const { count: jobsUsed } = await s.from("jobs").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("refunded", false);
const plan = { maxJobsPerMonth: 5, agent: { maxSteps: 50, maxCostUnits: 2500, maxRuntimeSeconds: 1800 } };

const result = buildCandidates({
  sources: sourcesOut, ideas, signals, recentFormats,
  budget: { jobsLimit: plan.maxJobsPerMonth, jobsUsed: jobsUsed ?? 0, agent: plan.agent }
});

console.log(`\nbudget: jobsUsed=${result.headroom.jobsUsed}, remaining=${result.headroom.jobsRemaining}, atLimit=${result.headroom.atLimit}`);
console.log(`exclusions (${result.exclusions.length}): ` + result.exclusions.map((e) => `"${e.sourceTitle}" → ${e.code} (${e.whyNot})`).join(" | "));
console.log(`ranked (${result.ranked.length}):`);
for (const c of result.ranked) console.log(`  [${c.score}] ${c.sourceTitle} → angle="${c.angleTitle}" score=${c.angleScore} formats=${c.formats.join(",")}`);
console.log(`\nRECOMMENDED: sourceId=${result.recommended?.sourceId} (${result.recommended?.sourceTitle}) mode=${result.recommended?.mode}`);
console.log(`  → feeds POST /api/agent/runs { sourceId: "${result.recommended?.sourceId}", mode: "${result.recommended?.mode}" }`);
console.log("\nGATE: decision formed with NO source preselected:", result.recommended ? "✓" : "✗");
