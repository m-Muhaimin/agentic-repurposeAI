import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { resolvePlan } from "@/lib/billing/entitlements";
import { buildScaleSurface } from "@/lib/agent/scale";
import { getApiKey } from "@/lib/buffer/connections";
import { publishingChannelsConnected } from "@/lib/agent/publish";

// GET /api/agent/scale — the P13 read-only scale surface.
//
// Server-side only: resolves the user's actual plan (never trusts the client),
// checks the real Buffer MCP config (per-user API key) + the real OAuth publish
// connection, and returns a pure, structural summary of the permission model —
// including which autopilot doors actually exist for this user.

export async function GET() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const service = createServiceClient();

  const [plan, hasMcpApiKey, channelsConnected] = await Promise.all([
    resolvePlan(user.id),
    getApiKey(user.id),
    publishingChannelsConnected(user.id, service)
  ]);
  const surface = buildScaleSurface(Boolean(hasMcpApiKey));

  return NextResponse.json({
    ok: true,
    planId: plan.id,
    planName: plan.name,
    ...surface,
    channelsConnected
  });
}