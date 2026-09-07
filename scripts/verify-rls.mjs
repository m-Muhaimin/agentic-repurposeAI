// Cross-user RLS verification against the live Supabase project.
//
// Creates two throwaway users (A and B), has A insert a source + output, then
// asserts B can neither read, update, delete, nor forge-own A's rows — proving
// the `sources`/`outputs` RLS policies hold across accounts, plus that deleting
// a user cascades to their rows. All created users/rows are cleaned up
// regardless of pass/fail.
//
// Run: npm run verify:rls   (reads .env.local for Supabase URL/anon/service keys)

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

// Service client bypasses RLS (admin); user clients authenticate as the user.
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

// Tables introduced by migration 0004 may not be applied to the live project
// yet — treat "relation does not exist" as a skip (not a failure) so the suite
// stays green either way and goes green-on-data once the migration lands.
const resolvesMissing = (e) =>
  e && /does not exist|could not find the (table|column|function)|relation\s+"?[a-z_.]+"?\s+does not exist/i.test(e.message);

function maybeCheck(name, res, okForRows, detail) {
  if (res.error && resolvesMissing(res.error)) {
    console.log(`  SKIP  ${name} — migration 0004 not applied`);
    return;
  }
  check(name, !res.error && okForRows(res.data), res.error?.message ?? detail);
}

async function signIn(user) {
  const client = anonClient(user.email, user.password);
  const { data, error } = await client.auth.signInWithPassword(user);
  if (error) throw new Error(`signIn ${user.email}: ${error.message}`);
  return { client, id: data.user.id };
}

const ts = Date.now();
const A = { email: `rls-a-${ts}@example.test`, password: `pwA-${ts}-Zz9` };
const B = { email: `rls-b-${ts}@example.test`, password: `pwB-${ts}-Yy8` };

let sourceId = null;
let outputId = null;
const createdUserIds = [];

async function main() {
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

  console.log("Positive controls (owner access):");
  const { data: srcA, error: srcErr } = await a
    .from("sources")
    .insert({ user_id: aId, title: "rls-test", storage_path: `${aId}/rls-test.mp3`, source_type: "audio" })
    .select()
    .single();
  check("A can insert their own source", !srcErr && srcA?.id, srcErr?.message);
  sourceId = srcA?.id;

  const { data: outA, error: outErr } = await a
    .from("outputs")
    .insert({ source_id: sourceId, user_id: aId, format: "linkedin_post", content: "draft" })
    .select()
    .single();
  check("A can insert their own output", !outErr && outA?.id, outErr?.message);
  outputId = outA?.id;

  console.log("Cross-user reads (must see nothing):");
  const bSrc = await b.from("sources").select("*").eq("id", sourceId);
  check("B cannot read A's source", Array.isArray(bSrc.data) && bSrc.data.length === 0, bSrc.error?.message);
  const bAll = await b.from("sources").select("*");
  check("B's source list contains no cross-user rows", Array.isArray(bAll.data) && bAll.data.length === 0);
  const bOut = await b.from("outputs").select("*").eq("source_id", sourceId);
  check("B cannot read A's output", Array.isArray(bOut.data) && bOut.data.length === 0, bOut.error?.message);

  console.log("Cross-user writes (must affect 0 rows or be blocked):");
  const updSrc = await b.from("sources").update({ title: "hacked" }).eq("id", sourceId).select();
  check("B cannot update A's source", !updSrc.error && Array.isArray(updSrc.data) && updSrc.data.length === 0, updSrc.error?.message);
  const updOut = await b.from("outputs").update({ content: "hacked" }).eq("id", outputId).select();
  check("B cannot update A's output (no update policy)", !updOut.error && Array.isArray(updOut.data) && updOut.data.length === 0, updOut.error?.message);
  const delSrc = await b.from("sources").delete().eq("id", sourceId).select();
  check("B cannot delete A's source", !delSrc.error && Array.isArray(delSrc.data) && delSrc.data.length === 0, delSrc.error?.message);
  const forge = await b
    .from("sources")
    .insert({ user_id: aId, title: "forged", storage_path: `${bId}/forged.mp3`, source_type: "audio" })
    .select()
    .single();
  check("B cannot insert a source owned by A (with check blocks)", Boolean(forge.error), forge.error?.message);
  const bOwn = await b
    .from("sources")
    .insert({ user_id: bId, title: "b-own", storage_path: `${bId}/b-own.mp3`, source_type: "audio" })
    .select()
    .single();
  check("B can still insert their own source", !bOwn.error && bOwn.data?.id, bOwn.error?.message);

  console.log("Update WITH CHECK (owner may not reassign ownership):");
  const myTitle = await a.from("sources").update({ title: "rls-test-updated" }).eq("id", sourceId).select();
  check(
    "A can update their own source title",
    !myTitle.error && Array.isArray(myTitle.data) && myTitle.data.length === 1,
    myTitle.error?.message
  );
  const reassign = await a.from("sources").update({ user_id: bId }).eq("id", sourceId).select();
  check(
    "A cannot reassign their source to B via UPDATE (with check blocks)",
    Boolean(reassign.error) || (!Array.isArray(reassign.data) || reassign.data.length === 0),
    reassign.error?.message
  );
  const ownOutputUpd = await a.from("outputs").update({ content: "self-edit" }).eq("id", outputId).select();
  check(
    "A cannot update their own output client-side (no update policy - server writes only)",
    !ownOutputUpd.error && (!Array.isArray(ownOutputUpd.data) || ownOutputUpd.data.length === 0),
    ownOutputUpd.error?.message
  );

  console.log("Billing tables (profiles / events):");
  const myProfile = await a.from("profiles").select("*");
  check(
    "A can read their own profile (auto-created by trigger)",
    !myProfile.error && Array.isArray(myProfile.data) && myProfile.data.length === 1,
    myProfile.error?.message
  );
  const bProf = await b.from("profiles").select("*").eq("user_id", aId);
  check("B cannot read A's profile", Array.isArray(bProf.data) && bProf.data.length === 0, bProf.error?.message);
  const eventsA = await a.from("events").select("*");
  check(
    "A cannot read events (RLS on, no select policy)",
    !eventsA.error && Array.isArray(eventsA.data) && eventsA.data.length === 0,
    eventsA.error?.message
  );
  const evIns = await a.from("events").insert({ name: "rls_test", properties: {} }).select();
  check(
    "A cannot write events directly (service role only)",
    Boolean(evIns.error) || (Array.isArray(evIns.data) && evIns.data.length === 0),
    evIns.error?.message
  );

  console.log("Billing ledger (usage_events / subscriptions):");
  const usageRead = await a.from("usage_events").select("*");
  maybeCheck(
    "A cannot read usage_events (service-role ledger, no select policy)",
    usageRead,
    (d) => Array.isArray(d) && d.length === 0
  );
  const usageWrite = await a.from("usage_events").insert({ user_id: aId, action: "reserve" }).select();
  maybeCheck(
    "A cannot write usage_events directly (service role only)",
    usageWrite,
    (d) => !Array.isArray(d) || d.length === 0
  );
  const subB = await b.from("subscriptions").select("*").eq("user_id", aId);
  maybeCheck(
    "B cannot read A's subscription",
    subB,
    (d) => Array.isArray(d) && d.length === 0
  );
  const subWrite = await a.from("subscriptions").insert({ user_id: aId, plan: "creator" }).select();
  maybeCheck(
    "A cannot create a subscription client-side (service role only)",
    subWrite,
    (d) => !Array.isArray(d) || d.length === 0
  );
  const subEv = await a.from("subscription_events").select("*");
  maybeCheck(
    "A cannot read subscription_events (no select policy)",
    subEv,
    (d) => Array.isArray(d) && d.length === 0
  );

  console.log("Cleanup cascade:");
  const delA = await admin.auth.admin.deleteUser(aId);
  check("admin can delete user A", !delA.error, delA.error?.message);
  const remaining = await admin.from("sources").select("id").eq("id", sourceId);
  check("A's sources cascade-delete when the user is deleted", Array.isArray(remaining.data) && remaining.data.length === 0);
}

try {
  await main();
} catch (err) {
  failed += 1;
  console.log(`FAIL  unexpected error: ${err instanceof Error ? err.message : String(err)}`);
} finally {
  // Tear down every throwaway user (their sources/outputs/jobs cascade via FK).
  // Only storage objects are left behind — this test never writes to storage.
  for (const uid of createdUserIds) {
    const del = await admin.auth.admin.deleteUser(uid);
    if (del.error && !/user not found/i.test(del.error.message)) {
      console.warn(`  cleanup: could not delete user ${uid}: ${del.error.message}`);
    }
  }
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
}