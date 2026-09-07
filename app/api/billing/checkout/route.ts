import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  PAID_PLAN_IDS,
  type PaidPlanId,
  PaddleNotConfiguredError,
  createCheckoutSession,
  getPaddleConfig,
  priceIdForPlan
} from "@/lib/billing/paddle";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { plan } = (await req.json().catch(() => ({}))) as { plan?: string };
  if (!plan || !(PAID_PLAN_IDS as readonly string[]).includes(plan)) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }
  const planId = plan as PaidPlanId;

  if (!getPaddleConfig()) {
    return NextResponse.json({ error: "Billing is not configured yet" }, { status: 503 });
  }
  const priceId = priceIdForPlan(planId);
  if (!priceId) {
    return NextResponse.json({ error: "That plan is not available yet" }, { status: 503 });
  }

  try {
    const session = await createCheckoutSession({ plan: planId, userId: user.id, priceId });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    if (err instanceof PaddleNotConfiguredError) {
      return NextResponse.json({ error: "Billing is not configured yet" }, { status: 503 });
    }
    console.error("[billing/checkout]", err);
    return NextResponse.json({ error: "Could not start checkout" }, { status: 500 });
  }
}