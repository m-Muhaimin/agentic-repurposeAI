import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolvePlan } from "@/lib/billing/entitlements";
import { getUsageSnapshot, maxInputSecondsFor } from "@/lib/billing/usage";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const plan = await resolvePlan(user.id);
  const snapshot = await getUsageSnapshot(user.id, plan);

  return NextResponse.json({
    usage: {
      plan: snapshot.planId,
      planName: snapshot.planName,
      used: snapshot.jobsUsed,
      limit: snapshot.jobsLimit,
      remaining: snapshot.jobsRemaining,
      percent: snapshot.percent,
      atLimit: snapshot.atLimit,
      resetAt: snapshot.resetAt,
      windowLabel: snapshot.windowLabel,
      maxInputMinutes: plan.limits.maxInputMinutes,
      maxInputSeconds: maxInputSecondsFor(plan),
      maxOutputsPerJob: plan.limits.maxOutputsPerJob,
      maxRegenerationsPerJob: plan.limits.maxRegenerationsPerJob
    }
  });
}