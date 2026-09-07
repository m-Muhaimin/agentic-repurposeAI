// Agentic schema + RLS verification against the live Supabase project.
//
// Confirms the V4_ tables from supabase/schema_agentic.sql exist with RLS
// enabled, then exercises the exact row shapes the agent orchestrator and API
// routes rely on — using BOTH the service client (what the worker uses to
// claim/advance runs) and a throwaway user client (what the API routes use to
// read/approve). Also re-asserts cross-user isolation for agent runs + steps.
// Every created user/row is cleaned up regardless of pass/fail.
//
// Run: npm run verify:agentic   (reads .env.local for Supabase URL/anon/service keys)

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(here, "..", ".env.local");

function loadEnv() {
  const vars = { ...process.env };
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !vars[m[1]]) vars[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
  return vars;
}

const env = loadEnv();
const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !ANON || !SERVICE) {
  console.error(
    "Missing env vars — need NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY," +
      " SUPABASE_SERVICE_ROLE_KEY (script reads them from .env.local or process.env)."
  );
  process.exit(2);
}

// Service client bypasses RLS (admin, mirrors lib/supabase service role use).
const admin = createClient(URL, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } });
const anonClient = (email, password) =>
  createClient(URL, ANON, { auth: { autoRefreshToken: false, persistSession: false } });

let passed = 0;
let failed = 0;
const check = (name, ok, detail) => {
  if (ok) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
};

const ts = Date.now();
const A = { email: `agent-a-${ts}@example.test`, password: `pwA-${ts}-Zz9` };
const B = { email: `agent-b-${ts}@example.test`, password: `pwB-${ts}-Yy8` };

let sourceId = null;
let runId = null;
let outputId = null;
const createdUserIds = [];

async function signIn(user) {
  const client = anonClient(user.email, user.password);
  const { data, error } = await client.auth.signInWithPassword(user);
  if (error) throw new Error(`signIn ${user.email}: ${error.message}`);
  return { client, id: data.user.id };
}

async function main() {
  // Schema presence is proven implicitly by every CRUD check below (a missing
  // table surfaces as "relation does not exist"), and RLS by the cross-user
  // isolation block — those pass only if row-level security is actually on.

  console.log("Creating two throwaway users…");
  for (const u of [A, B]) {
    const created = await admin.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true
    });
    if (created.error) throw new Error(`createUser ${u.email}: ${created.error.message}`);
    createdUserIds.push(created.data.user.id);
  }

  const { client: a, id: aId } = await signIn(A);
  const { client: b, id: bId } = await signIn(B);
  console.log(`  user A = ${aId.slice(0, 8)}…  user B = ${bId.slice(0, 8)}…`);

  console.log("V2/V4 row shapes (what the orchestrator + routes write):");
  const { data: srcA, error: srcErr } = await a
    .from("sources")
    .insert({
      user_id: aId,
      title: "agentic-e2e-test",
      storage_path: `${aId}/agentic-e2e-test.tsx`,
      source_type: "transcript",
      status: "done"
    })
    .select()
    .single();
  check("A can insert a done source (prep for a run)", !srcErr && srcA?.id, srcErr?.message);
  sourceId = srcA?.id;

  const { data: run, error: runErr } = await a
    .from("v4_agent_runs")
    .insert({
      user_id: aId,
      source_id: sourceId,
      mode: "assist",
      status: "created"
    })
    .select()
    .single();
  check("A can create a v4_agent_run (status created)", !runErr && run?.id, runErr?.message);
  runId = run?.id;

  const { data: claimed, error: claimErr } = await admin
    .from("v4_agent_runs")
    .update({ status: "planning", attempt: 1, transcript_snapshot: "hello world transcript", started_at: new Date().toISOString() })
    .eq("id", runId)
    .eq("status", "created")
    .select()
    .single();
  check(
    "service client can claim created run → planning (orchestrator pattern)",
    !claimErr && claimed?.status === "planning",
    claimErr?.message
  );

  const { error: stepErr } = await admin.from("v4_agent_steps").insert({
    run_id: runId,
    user_id: aId,
    kind: "planning",
    status: "done",
    label: "plan",
    input: { sources: [sourceId] },
    output: { angles: 3 },
    started_at: new Date().toISOString(),
    finished_at: new Date().toISOString()
  });
  check("service client can record a step (kind planning)", !stepErr, stepErr?.message);

  const badKind = await admin
    .from("v4_agent_steps")
    .insert({ run_id: runId, user_id: aId, kind: "banana", status: "done" });
  check(
    "invalid step kind is rejected (check constraint)",
    Boolean(badKind.error),
    badKind.error?.message
  );

  const { data: idea, error: ideaErr } = await a
    .from("v4_content_ideas")
    .insert({
      run_id: runId,
      user_id: aId,
      title: "Three ways to structure a hook",
      suggested_formats: ["linkedin_post", "newsletter"],
      quotes: ["ritual before magic"],
      rationale: "core insight from the transcript",
      approved: true,
      sort_order: 0
    })
    .select()
    .single();
  check("A can insert a v4_content_idea (gate row)", !ideaErr && idea?.id, ideaErr?.message);

  const { data: pref, error: prefErr } = await a
    .from("v4_agent_preferences")
    .insert({
      user_id: aId,
      auto_mode: "assist",
      brand_tone: "direct and warm"
    })
    .select()
    .single();
  check("A can insert v4_agent_preferences (unique user_id)", !prefErr && pref?.id, prefErr?.message);

  const { data: dist, error: distErr } = await a
    .from("v4_distribution_jobs")
    .insert({ user_id: aId, run_id: runId, platform: "linkedin", status: "draft" })
    .select()
    .single();
  check("A can insert a v4_distribution_job (draft)", !distErr && dist?.id, distErr?.message);

  const { data: strat, error: stratErr } = await a
    .from("v4_content_strategies")
    .insert({ user_id: aId, title: "Weekly heuristic", body: "shorts on hooks, newsletter on process", source: "heuristic" })
    .select()
    .single();
  check("A can insert a v4_content_strategy (heuristic)", !stratErr && strat?.id, stratErr?.message);

  const { data: outA, error: outErr } = await a
    .from("outputs")
    .insert({ source_id: sourceId, user_id: aId, format: "newsletter", content: "draft body" })
    .select()
    .single();
  check("A can insert their own output (agent drafts reuse outputs)", !outErr && outA?.id, outErr?.message);
  outputId = outA?.id;

  const { data: distFull, error: distFullErr } = await a
    .from("v4_distribution_jobs")
    .insert({ user_id: aId, run_id: runId, output_id: outputId, platform: "x", status: "published", published_at: new Date().toISOString() })
    .select()
    .single();
  check("distribution job can reference an output", !distFullErr && distFull?.id, distFullErr?.message);

  console.log("State transitions + evaluation persistence:");
  const { data: done, error: doneErr } = await admin
    .from("v4_agent_runs")
    .update({
      status: "done",
      plan: { angles: [{ title: "t", approved: true }] },
      output_ids: [outputId],
      step_count: 4,
      input_tokens: 1200,
      output_tokens: 800,
      cost_units: 0.02,
      finished_at: new Date().toISOString()
    })
    .eq("id", runId)
    .select()
    .single();
  check(
    "service client can finish run → done with plan/output_ids/cost (orchestrator pattern)",
    !doneErr && done?.status === "done" && Array.isArray(done.output_ids) && done.output_ids.length === 1,
    doneErr?.message
  );

  const { data: evalRow, error: evalErr } = await a
    .from("v4_content_ideas")
    .update({ evaluation: { score: 0.82, weak: false, flags: ["ok"] } })
    .eq("id", idea.id)
    .select()
    .single();
  check("A can persist a draft evaluation on their idea", !evalErr && evalRow?.evaluation?.score === 0.82, evalErr?.message);

  const { data: steps, error: stepsErr } = await a.from("v4_agent_steps").select("kind, status").eq("run_id", runId);
  check(
    "A can read their own run's step timeline",
    !stepsErr && Array.isArray(steps) && steps.some((s) => s.kind === "planning"),
    stepsErr?.message
  );

  console.log("Cross-user isolation for agent tables:");
  const bRuns = await b.from("v4_agent_runs").select("id").eq("id", runId);
  check("B cannot read A's agent run", Array.isArray(bRuns.data) && bRuns.data.length === 0, bRuns.error?.message);
  const bSteps = await b.from("v4_agent_steps").select("id").eq("run_id", runId);
  check("B cannot read A's agent steps", Array.isArray(bSteps.data) && bSteps.data.length === 0, bSteps.error?.message);
  const bIdeas = await b.from("v4_content_ideas").select("id").eq("run_id", runId);
  check("B cannot read A's content ideas", Array.isArray(bIdeas.data) && bIdeas.data.length === 0, bIdeas.error?.message);
  const bPref = await b.from("v4_agent_preferences").select("id").eq("user_id", aId);
  check("B cannot read A's preferences", Array.isArray(bPref.data) && bPref.data.length === 0, bPref.error?.message);
  const bDist = await b.from("v4_distribution_jobs").select("id").eq("user_id", aId);
  check("B cannot read A's distribution jobs", Array.isArray(bDist.data) && bDist.data.length === 0, bDist.error?.message);
  const bStrat = await b.from("v4_content_strategies").select("id").eq("user_id", aId);
  check("B cannot read A's strategies", Array.isArray(bStrat.data) && bStrat.data.length === 0, bStrat.error?.message);

  const updRun = await b.from("v4_agent_runs").update({ status: "cancelled" }).eq("id", runId).select();
  check("B cannot update A's agent run", !updRun.error && Array.isArray(updRun.data) && updRun.data.length === 0, updRun.error?.message);

  console.log("Cleanup cascade:");
  const delA = await admin.auth.admin.deleteUser(aId);
  check("admin can delete user A", !delA.error, delA.error?.message);
  const remaining = await admin.from("v4_agent_runs").select("id").eq("id", runId);
  check("A's agent runs cascade-delete when the user is deleted", Array.isArray(remaining.data) && remaining.data.length === 0);
}

try {
  await main();
} catch (err) {
  failed += 1;
  console.log(`FAIL  unexpected error: ${err instanceof Error ? err.message : String(err)}`);
} finally {
  for (const uid of createdUserIds) {
    const del = await admin.auth.admin.deleteUser(uid);
    if (del.error && !/user not found/i.test(del.error.message)) {
      console.warn(`  cleanup: could not delete user ${uid}: ${del.error.message}`);
    }
  }
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
}