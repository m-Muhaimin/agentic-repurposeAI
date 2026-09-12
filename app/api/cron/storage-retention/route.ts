import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { log } from "@/lib/logger";
import { runStorageRetentionSweep } from "@/lib/storage-retention/sweep";

// Vercel Cron → GET /api/cron/storage-retention (see vercel.json), daily 06:00
// UTC. Deliberately NOT in middleware's protectedPaths: cron hits are
// unauthenticated, so the in-route CRON_SECRET header check IS the auth.

export const dynamic = "force-dynamic";

// Compare SHA-256 digests (not the raw strings) so timingSafeEqual always sees
// fixed-length buffers, regardless of secret length.
async function isAuthorized(req: Request): Promise<boolean> {
  const secret = process.env.CRON_SECRET;
  // Vercel Cron sends CRON_SECRET as `Authorization: Bearer <CRON_SECRET>` on
  // every invocation (not a custom header) — strip the prefix, then compare.
  const header = req.headers.get("authorization");
  if (!secret || !header) return false;
  const PREFIX = "Bearer ";
  if (!header.startsWith(PREFIX)) return false;
  const token = header.slice(PREFIX.length);
  if (!token) return false;
  const expected = createHash("sha256").update(secret).digest();
  const actual = createHash("sha256").update(token).digest();
  return timingSafeEqual(expected, actual);
}

export async function GET(req: Request) {
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Storage ops REQUIRE the service role — storage.objects has no delete
    // policy for user clients.
    const summary = await runStorageRetentionSweep({ service: createServiceClient() });
    return NextResponse.json(summary);
  } catch (err) {
    log.error("storage_retention.sweep_failed", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Storage retention sweep failed" },
      { status: 500 }
    );
  }
}