// Regenerates types/supabase.ts from the live Supabase project.
//
// Cross-platform replacement for the old  `db:types`  one-liner (which used
// `$SUPABASE_PROJECT_ID` shell syntax — broken under npm's cmd.exe shell).
//
// Resolution order for the project reference:
//   1. SUPABASE_PROJECT_ID env var
//   2. derived from NEXT_PUBLIC_SUPABASE_URL (https://<ref>.supabase.co)
//
// Auth: requires SUPABASE_ACCESS_TOKEN (Personal Access Token,
// https://supabase.com/dashboard/account/tokens) OR an already-authenticated
// `supabase login` on this machine. The access token is read from .env.local
// or process env and never written into the generated file.
//
// Run: npm run db:types

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");

function loadEnv() {
  const vars = { ...process.env };
  const envPath = path.join(root, ".env.local");
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !(m[1] in vars)) vars[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
  return vars;
}

const env = loadEnv();

const projectId =
  env.SUPABASE_PROJECT_ID ??
  env.NEXT_PUBLIC_SUPABASE_URL?.match(/^https?:\/\/([a-z0-9-]+)\.supabase\.co/)?.[1];

if (!projectId) {
  console.error(
    "Cannot determine the Supabase project reference.\n" +
      "Set SUPABASE_PROJECT_ID (or NEXT_PUBLIC_SUPABASE_URL) in .env.local / env."
  );
  process.exit(2);
}

if (!env.SUPABASE_ACCESS_TOKEN) {
  console.warn(
    "SUPABASE_ACCESS_TOKEN not set — falling back to the CLI's stored login " +
      "(runs `supabase login` first if this fails)."
  );
}

// On Windows the CLI is a .cmd shim that only node spawn via a shell; plain
// child_process spawn of *.[cm]d fails with EINVAL. shell: true handles that
// and lets PATH resolve the command on every OS.
const childEnv = { ...env, FORCE_COLOR: "0" };
if (env.SUPABASE_ACCESS_TOKEN) childEnv.SUPABASE_ACCESS_TOKEN = env.SUPABASE_ACCESS_TOKEN;

const args = ["gen", "types", "typescript", "--project-id", projectId];
const res = spawnSync("supabase", args, {
  cwd: root,
  env: childEnv,
  encoding: "utf8",
  shell: true,
  stdio: ["ignore", "pipe", "pipe"],
});

if (res.error) {
  console.error(`Could not run the supabase CLI: ${res.error.message}`);
  console.error("Install it globally (npm i -g supabase) or add it to PATH.");
  process.exit(2);
}
if (res.status !== 0 || !res.stdout) {
  console.error(`supabase gen types failed (exit ${res.status ?? "?"}):\n${res.stderr || res.stdout}`);
  process.exit(1);
}

writeFileSync(path.join(root, "types", "supabase.ts"), res.stdout, "utf8");
console.log(`Wrote types/supabase.ts for project ${projectId}.`);