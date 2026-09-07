import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getFreshAccessToken } from "@/lib/buffer/connections";
import { fetchProfiles, platformToBufferService, type BufferProfile } from "@/lib/buffer/client";
import { NOT_CONNECTED_MESSAGE } from "@/lib/agent/publish";
import { log } from "@/lib/logger";

// GET /api/integrations/buffer/profiles?platform=linkedin
//
// Lists the caller's connected Buffer profiles, optionally narrowed to ONE
// platform via its Buffer "service" id. Backs the per-platform profile selector
// in the Publish queue send controls. Uses a refresh-if-expired token so a
// stale access_token doesn't silently fail profile resolution.

export async function GET(request: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const url = new URL(request.url);
  const platform = url.searchParams.get("platform") ?? undefined;

  const fresh = await getFreshAccessToken(user.id);
  if (!fresh) {
    return NextResponse.json({ ok: false, error: NOT_CONNECTED_MESSAGE, code: "PUBLISH_NOT_CONNECTED" }, { status: 404 });
  }

  try {
    const profiles = await fetchProfiles(fresh.token);
    const serviceId = platform ? platformToBufferService(platform as Parameters<typeof platformToBufferService>[0]) : null;
    const matches = serviceId ? profiles.filter((p) => p.service === serviceId) : profiles;
    const view = matches.map((p: BufferProfile) => ({
      id: p.id,
      service: p.service,
      username: p.service_username ?? null,
      avatar: (p as { avatar?: string }).avatar ?? null,
      default: Boolean((p as { default?: boolean }).default)
    }));
    if (platform && serviceId === null) {
      // Honest: no Buffer service backs this platform (e.g. newsletter).
      log.info("buffer.profiles_unmapped_platform", { user_id: user.id, platform });
    }
    return NextResponse.json({ ok: true, platform: serviceId, profiles: view });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not load Buffer profiles.";
    log.warn("buffer.profiles_failed", { user_id: user.id, message });
    return NextResponse.json({ ok: false, error: message, code: "PROFILES_FAILED" }, { status: 502 });
  }
}