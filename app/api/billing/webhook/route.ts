import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import {
  applyPaddleEvent,
  getPaddleConfig,
  type PaddleWebhookEvent,
  verifyPaddleSignature
} from "@/lib/billing/paddle";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const rawBody = await req.text();
  const config = getPaddleConfig();
  if (!config) {
    return NextResponse.json({ error: "Billing is not configured yet" }, { status: 401 });
  }

  if (!verifyPaddleSignature(rawBody, req.headers.get("paddle-signature"), { secret: config.webhookSecret })) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: PaddleWebhookEvent;
  try {
    event = JSON.parse(rawBody) as PaddleWebhookEvent;
  } catch {
    return NextResponse.json({ error: "Invalid webhook body" }, { status: 400 });
  }

  try {
    // Writes are idempotent (upsert keyed on provider_subscription_id) so
    // Paddle retries are safe; always ack with 200 once applied.
    await applyPaddleEvent(createServiceClient(), event);
  } catch (err) {
    console.error("[billing/webhook]", event.event_id, err);
    return NextResponse.json({ error: "Webhook handling failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}