import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const raw = fs.readFileSync(path.join(root, ".env.local"), "utf8");
const env = {};
for (const line of raw.split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^"|"$/g, "").trim();
}
const s = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
async function probeTable(name) {
  const { data, error } = await s.from(name).select("*").limit(1);
  if (error) return { name, exists: false, hint: error.message };
  return { name, exists: true, sample: data };
}
for (const t of ["v4_strategies", "v4_content_strategies", "v4_content_ideas", "sources", "v4_agent_runs"]) {
  console.log(JSON.stringify(await probeTable(t)));
}
