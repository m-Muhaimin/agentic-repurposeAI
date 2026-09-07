import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { computeDailySpend, computeErrorRate } from "@/lib/billing/spend";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const [spend, errorRate] = await Promise.all([
    computeDailySpend(user.id),
    computeErrorRate(user.id)
  ]);

  return NextResponse.json({
    spend,
    errorRate
  });
}
