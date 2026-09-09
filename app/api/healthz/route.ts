import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// Liveness + readiness probe for uptime monitors. Public by design — it
// deliberately returns no user data and leaks no secrets.

export async function GET() {
  let db: "ok" | "degraded" = "ok";
  try {
    const service = createServiceClient();
    // Lightweight reachability check — a head query with a tiny timeout so the
    // probe never hangs an uptime monitor for more than a couple seconds.
    const check = await Promise.race([
      service.from("sources").select("id", { count: "exact", head: true }),
      new Promise<{ error: { code: string } }>((resolve) =>
        setTimeout(() => resolve({ error: { code: "TIMEOUT" } }), 3000)
      )
    ]);
    if (check.error && check.error.code !== "PGRST116") {
      db = "degraded";
    }
  } catch {
    db = "degraded";
  }

  const region = process.env.VERCEL_REGION ?? null;
  const commit = process.env.VERCEL_GIT_COMMIT_SHA ?? null;

  return NextResponse.json(
    {
      status: db === "ok" ? "ok" : "degraded",
      ok: db === "ok",
      service: "verv-ai-backend",
      version: "0.1.0",
      db,
      region,
      commit,
      time: new Date().toISOString()
    },
    { status: db === "ok" ? 200 : 503 }
  );
}