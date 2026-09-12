// Paddle Billing integration (checkout + webhooks). Server-side only.
//
// Everything here is INERT without the Paddle env vars: when PADDLE_API_KEY /
// PADDLE_WEBHOOK_SECRET are missing, getPaddleConfig() returns null, the
// checkout route answers 503, and the webhook route 401s — the rest of the app
// is untouched. See docs/ or AGENTS.md for what the owner must supply.
//
// Paid-tier model: `profiles.plan` is the ENFORCEMENT source of truth (read by
// lib/billing/entitlements.ts resolvePlan). The `subscriptions` table (migration
// 0004) is the provider-contract record. Webhook activation writes BOTH: profile
// plan for enforcement, subscriptions row for contract truth. Activation updates
// profiles.plan; cancellation downgrades it back to beta.

import { createHmac, timingSafeEqual } from "crypto";

export type PaidPlanId = "creator" | "pro" | "studio";

export const PAID_PLAN_IDS: readonly PaidPlanId[] = ["creator", "pro", "studio"];

export type SubscriptionsStatus = "incomplete" | "active" | "past_due" | "canceled" | "trialing" | "paused";

export interface PaddleConfig {
  apiKey: string;
  webhookSecret: string;
  baseUrl: string;
  apiVersion: string;
}

const PADDLE_PRODUCTION = "https://api.paddle.com";
const PADDLE_SANDBOX = "https://sandbox-api.paddle.com";

// Wall-clock cap on Paddle API calls — tighter than the content clients (5s)
// because checkout creation is user-facing (ARCHITECTURE_FREEZE §3 bounded I/O).
const PADDLE_FETCH_TIMEOUT_MS = 5_000;

export function getPaddleConfig(): PaddleConfig | null {
  const apiKey = process.env.PADDLE_API_KEY;
  const webhookSecret = process.env.PADDLE_WEBHOOK_SECRET;
  if (!apiKey || !webhookSecret) return null;
  return {
    apiKey,
    webhookSecret,
    baseUrl: process.env.PADDLE_ENV === "sandbox" ? PADDLE_SANDBOX : PADDLE_PRODUCTION,
    apiVersion: process.env.PADDLE_API_VERSION ?? "1"
  };
}

export function isPaddleConfigured(): boolean {
  return getPaddleConfig() !== null;
}

// ── Plan <-> price-id mapping ────────────────────────────────────────────────
// Each paid tier must have a catalog price in Paddle; map it here via env so
// price ids never ship in code. Unset prices simply aren't purchasable yet.

export function priceIdForPlan(plan: PaidPlanId): string | null {
  const key = `PADDLE_PRICE_ID_${plan.toUpperCase()}` as keyof NodeJS.ProcessEnv;
  const value = process.env[key];
  return value && value.length > 0 ? value : null;
}

export function purchasedPlanIds(): PaidPlanId[] {
  return PAID_PLAN_IDS.filter((p) => priceIdForPlan(p) !== null);
}

export function planForPriceId(priceId: string): PaidPlanId | null {
  for (const plan of PAID_PLAN_IDS) {
    if (priceIdForPlan(plan) === priceId) return plan;
  }
  return null;
}

// ── Webhook signature verification ───────────────────────────────────────────
// Paddle signs the string `${ts}:${rawBody}` with HMAC-SHA256 keyed on the
// notification-destination secret. Header: `Paddle-Signature: ts=...;h1=...`.
// The raw body must be byte-identical to what Paddle sent (use request.text(),
// never a re-stringified parsed object). Replay window is 5s by default.

export interface VerifyOptions {
  secret?: string;
  now?: number; // unix seconds, for tests
  toleranceSeconds?: number;
}

export function verifyPaddleSignature(
  rawBody: string,
  signatureHeader: string | null,
  opts: VerifyOptions = {}
): boolean {
  const secret = opts.secret ?? process.env.PADDLE_WEBHOOK_SECRET;
  if (!secret || !signatureHeader) return false;

  let ts: string | undefined;
  let h1: string | undefined;
  for (const part of signatureHeader.split(";")) {
    const eq = part.indexOf("=");
    if (eq <= 0) continue;
    const key = part.slice(0, eq);
    const value = part.slice(eq + 1);
    if (key === "ts") ts = value;
    else if (key === "h1") h1 = value;
  }
  if (!ts || !h1) return false;

  const tsSeconds = Number(ts);
  if (!Number.isFinite(tsSeconds)) return false;

  const nowSeconds = opts.now ?? Math.floor(Date.now() / 1000);
  const tolerance = opts.toleranceSeconds ?? 5;
  if (Math.abs(nowSeconds - tsSeconds) > tolerance) return false;

  const signedPayload = `${ts}:${rawBody}`;
  const expected = createHmac("sha256", secret).update(signedPayload, "utf8").digest("hex");

  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(h1, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

// ── Checkout initiation ───────────────────────────────────────────────────────
// Creates an automatic-collection transaction for the requested price id and
// returns the hosted checkout URL. The user's Paddle customer is created by the
// hosted checkout from the email they enter; custom_data carries our user id so
// the webhook can attribute the purchase.

export interface CheckoutSession {
  transactionId: string;
  url: string;
}

export class PaddleNotConfiguredError extends Error {
  constructor() {
    super("Paddle is not configured (PADDLE_API_KEY / PADDLE_WEBHOOK_SECRET missing)");
  }
}

export async function createCheckoutSession(opts: {
  priceId: string;
  userId: string;
  plan: PaidPlanId;
}): Promise<CheckoutSession> {
  const config = getPaddleConfig();
  if (!config) throw new PaddleNotConfiguredError();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort("timeout"), PADDLE_FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(`${config.baseUrl}/transactions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Paddle-Version": config.apiVersion,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        items: [{ price_id: opts.priceId, quantity: 1 }],
        custom_data: { user_id: opts.userId, plan: opts.plan },
        collection_mode: "automatic"
      }),
      signal: controller.signal
    });

    const body = await res.json().catch((err: unknown) => {
      // A timeout abort during the body read must surface as the timeout error
      // too, not as an "unknown" parse failure; other parse failures stay null.
      if (err instanceof Error && err.name === "AbortError") throw err;
      return null;
    });
    if (!res.ok) {
      const detail = body?.error?.detail ?? body?.error ?? body?.message ?? "unknown";
      throw new Error(`Paddle create transaction failed (${res.status}): ${detail}`);
    }

    const data = body?.data;
    const url = data?.checkout?.url;
    if (!data?.id || !url) {
      throw new Error(
        "Paddle transaction did not return a checkout URL — check your default payment link / approved checkout domains."
      );
    }

    return { transactionId: data.id as string, url: url as string };
  } catch (err) {
    // A hung/exceedingly slow Paddle surfaces as a timeout error in the lib's
    // existing plain-Error convention, never a raw AbortError DOMException.
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Paddle API request timed out.");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// ── Webhook event model + state derivation ────────────────────────────────────

export interface PaddleWebhookEvent {
  event_id: string;
  event_type: string;
  occurred_at: string;
  data: {
    id?: string;
    status?: string;
    custom_data?: Record<string, string> | null;
    subscription_id?: string | null;
    items?: Array<{ price?: { id?: string }; quantity?: number }>;
    current_billing_period?: { starts_at?: string; ends_at?: string } | null;
  };
}

// Statuses we subscribe to (migration 0008 widens subscriptions.status with
// 'paused' for this mapping).
export const SUBSCRIPTION_EVENT_TYPES = new Set([
  "subscription.activated",
  "subscription.updated",
  "subscription.trialing",
  "subscription.past_due",
  "subscription.paused",
  "subscription.resumed",
  "subscription.canceled"
]);

export interface SubscriptionStateChange {
  planId: PaidPlanId | null;
  status: SubscriptionsStatus | null;
  subscriptionId: string | null;
}

function statusFromPaddle(status: string | undefined): SubscriptionsStatus | null {
  switch (status) {
    case "active":
    case "resumed":
      return "active";
    case "trialing":
      return "trialing";
    case "past_due":
      return "past_due";
    case "paused":
      return "paused";
    case "canceled":
      return "canceled";
    default:
      return null;
  }
}

function planFromEvent(event: PaddleWebhookEvent): PaidPlanId | null {
  for (const item of event.data.items ?? []) {
    const priceId = item.price?.id;
    if (!priceId) continue;
    const plan = planForPriceId(priceId);
    if (plan) return plan;
  }
  return null;
}

// What a verified event means for our subscription record. Returns null when the
// event type is not something we act on.
export function subscriptionStateForEvent(event: PaddleWebhookEvent): SubscriptionStateChange | null {
  const type = event.event_type;
  const subscriptionId = type.startsWith("subscription.")
    ? (event.data.id ?? event.data.subscription_id ?? null)
    : (event.data.subscription_id ?? null);

  if (type === "transaction.completed") {
    return {
      planId: planFromEvent(event),
      status: statusFromPaddle("active"),
      subscriptionId
    };
  }

  if (!SUBSCRIPTION_EVENT_TYPES.has(type)) return null;

  return {
    planId: planFromEvent(event),
    status: statusFromPaddle(event.data.status),
    subscriptionId
  };
}

export function userIdFromEvent(event: PaddleWebhookEvent): string | null {
  return event.data.custom_data?.user_id ?? null;
}

// ── State application (DB writes) ─────────────────────────────────────────────
// Pure-ish: takes a supabase service client so tests can mock it (same pattern
// as lib/billing/spend.ts). Writes are idempotent — safe against Paddle retries.

import type { SupabaseClient } from "@supabase/supabase-js";

export async function applyPaddleEvent(
  service: SupabaseClient,
  event: PaddleWebhookEvent
): Promise<{
  handled: boolean;
  reason?: string;
  // Notification-ON-ACKNOWLEDGEMENT data: the spec of what to emit is computed
  // here (pure data), but EMISSION happens in the server-only caller (the
  // webhook route) after this returns — paddle.ts must stay client-safe
  // because PAID_PLAN_IDS is imported by client components.
  notification?: { userId: string; type: "subscription.updated" | "payment.failed"; planLabel?: string };
}> {
  const change = subscriptionStateForEvent(event);
  if (!change) return { handled: false, reason: `ignored event type ${event.event_type}` };

  const userId = userIdFromEvent(event);
  if (!userId) return { handled: false, reason: "no user_id in custom_data" };

  const now = new Date().toISOString();

  // 1. Upsert the subscription contract row (keyed how we can identify it).
  if (change.subscriptionId) {
    const row = {
      user_id: userId,
      provider: "paddle",
      provider_subscription_id: change.subscriptionId,
      plan: change.planId ?? undefined,
      status: change.status ?? undefined,
      current_period_start: event.data.current_billing_period?.starts_at ?? undefined,
      current_period_end: event.data.current_billing_period?.ends_at ?? undefined,
      updated_at: now
    };
    const { error } = await service.from("subscriptions").upsert(row, {
      onConflict: "provider_subscription_id",
      ignoreDuplicates: false
    });
    if (error) {
      // Fail open on infra: activation must not silently drop the customer.
      throw new Error(`subscriptions upsert failed: ${error.message}`);
    }
  }

  // 2. Update the enforcement source of truth (profiles.plan).
  const profile =
    change.status === "canceled"
      ? { plan: "beta", plan_status: "cancelled" }
      : change.status === "past_due" || change.status === "paused"
      ? { plan: change.planId ?? undefined, plan_status: "cancelled" }
      : change.planId
      ? { plan: change.planId, plan_status: "active" }
      : null;

  if (profile) {
    const { error } = await service
      .from("profiles")
      .upsert({ user_id: userId, ...profile, updated_at: now }, { onConflict: "user_id" });
    if (error) throw new Error(`profiles upsert failed: ${error.message}`);
  }

  // 2b. Compute the notification spec for the plan/state change — pure data,
  // no side effects (no try/catch needed here). Emission happens in the
  // SERVER-ONLY caller, app/api/billing/webhook/route.ts, after this returns,
  // fail-open there: a notification hiccup must never break webhook
  // acknowledgement, and this file must never import the server-only
  // notifications barrel (it is reachable from client components).
  let notification:
    | { userId: string; type: "subscription.updated" | "payment.failed"; planLabel?: string }
    | undefined;
  if (change.status === "canceled") {
    notification = { userId, type: "subscription.updated", planLabel: change.planId ?? "beta" };
  } else if (change.status === "past_due" || change.status === "paused") {
    notification = { userId, type: "payment.failed" };
  } else if (change.planId) {
    // activation / upgrade (plan_status "active" + plan set) — includes
    // trialing, which the detachment also treats as an activation.
    notification = { userId, type: "subscription.updated", planLabel: change.planId };
  }

  // 3. Audit trail (best-effort; a pre-0008 DB lacks paddle_event_id).
  await insertEventAudit(service, event, userId, now);

  return { handled: true, notification };
}

async function insertEventAudit(
  service: SupabaseClient,
  event: PaddleWebhookEvent,
  userId: string,
  now: string
) {
  const base = {
    subscription_id: event.data.subscription_id ?? event.data.id ?? null,
    user_id: userId,
    type: event.event_type,
    payload: event.data as unknown as Record<string, unknown>,
    created_at: now
  };

  try {
    const { error } = await service
      .from("subscription_events")
      .insert({ ...base, paddle_event_id: event.event_id });
    if (error) {
      // Unique paddle_event_id => already processed a duplicate delivery => no-op.
      // Missing column => pre-0008 schema => retry without the field.
      if (/duplicate key|unique|23505/i.test(error.message)) return;
      if (/could not find the.*paddle_event_id|does not exist|PGRST204|42P01/i.test(error.message)) {
        const { error: retryError } = await service.from("subscription_events").insert(base);
        if (retryError) {
          throw new Error(`subscription_events insert failed: ${retryError.message}`);
        }
      } else {
        throw new Error(`subscription_events insert failed: ${error.message}`);
      }
    }
  } catch {
    // Audit insert must never break webhook acknowledgement.
  }
}