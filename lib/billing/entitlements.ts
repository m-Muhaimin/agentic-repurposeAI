// Entitlement resolution: which plan does this user actually have? Reads the
// profiles table (server-side only — the lead writes go through the service
// role; clients can only ever read their own row via RLS).
//
// Missing/invalid profiles resolve to beta and a profile row is lazily upserted
// (defensive: the auth trigger usually creates it, but re-installs and race
// conditions shouldn't strand a user without a plan).

import { createServiceClient } from "@/lib/supabase/server";
import { getPlan, type Plan, type PlanId } from "./plans";

export async function resolvePlan(userId: string): Promise<Plan> {
  let planId: PlanId = "beta";
  try {
    const service = createServiceClient();
    const { data } = await service
      .from("profiles")
      .select("plan")
      .eq("user_id", userId)
      .maybeSingle();
    if (data && data.plan) planId = data.plan;
  } catch {
    // Treat any read error as beta — enforcement must fail open on infra
    // hiccups, never on auth.
  }
  return getPlan(planId);
}

// Ensures a profile row exists (defaults to beta) without ever touching an
// existing one. Used on first enqueue so a fresh signup is always billable.
export async function ensureProfile(userId: string): Promise<Plan> {
  try {
    const service = createServiceClient();
    await service
      .from("profiles")
      .upsert({ user_id: userId }, { onConflict: "user_id", ignoreDuplicates: true });
  } catch {
    // Profile creation must never break the enqueue path.
  }
  return resolvePlan(userId);
}