import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolvePlan } from "@/lib/billing/entitlements";
import { buildScaleSurface } from "@/lib/agent/scale";

// GET /api/agent/scale — the P13 read-only scale surface.
//
// Server-side only: resolves the user's actual plan (never trusts the client)
// and returns a pure, structural summary of the permission model plus the
// honest assertion that no autopilot door exists in this build.

export async function GET() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const plan = await resolvePlan(user.id);
  const surface = buildScaleSurface();

  return NextResponse.json({
    ok: true,
    planId: plan.id,
    planName: plan.name,
    ...surface
  });
}