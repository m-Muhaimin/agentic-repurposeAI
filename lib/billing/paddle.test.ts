import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { createHmac } from "crypto";
import {
  getPaddleConfig,
  isPaddleConfigured,
  priceIdForPlan,
  purchasedPlanIds,
  planForPriceId,
  verifyPaddleSignature,
  createCheckoutSession,
  PaddleNotConfiguredError,
  subscriptionStateForEvent,
  userIdFromEvent,
  applyPaddleEvent,
  type PaddleWebhookEvent
} from "@/lib/billing/paddle";

const SECRET = "pdl_ntfset_testsecret";
const T0 = Math.floor(Date.now() / 1000);

function sign(body: string, secret = SECRET, ts = T0): string {
  return `ts=${ts};h1=${createHmac("sha256", secret).update(`${ts}:${body}`).digest("hex")}`;
}

function clearPaddleEnv() {
  for (const k of Object.keys(process.env)) if (k.startsWith("PADDLE_")) delete process.env[k];
}

function setPaddleEnv(good: Record<string, string>) {
  clearPaddleEnv();
  Object.assign(process.env, good);
}

function subscriptionEvent(overrides: Partial<PaddleWebhookEvent["data"]> = {}): PaddleWebhookEvent {
  return {
    event_id: `evt_${Math.random().toString(36).slice(2)}`,
    event_type: "subscription.updated",
    occurred_at: new Date().toISOString(),
    data: {
      id: "sub_123",
      status: "active",
      custom_data: { user_id: "user-1", plan: "pro" },
      items: [{ price: { id: "pri_pro" }, quantity: 1 }],
      current_billing_period: { starts_at: "2026-09-01T00:00:00Z", ends_at: "2026-10-01T00:00:00Z" },
      ...overrides
    }
  };
}

interface Call {
  table: string;
  op: "upsert" | "insert";
  row: Record<string, unknown>;
  opts?: Record<string, unknown>;
}

function makeServiceMock(behavior: {
  upsertError?: Error | null;
  insertError?: (row: Record<string, unknown>) => Error | null;
} = {}) {
  const calls: Call[] = [];
  const service = {
    from: (table: string) => ({
      upsert: async (row: Record<string, unknown>, opts?: Record<string, unknown>) => {
        calls.push({ table, op: "upsert", row, opts });
        return { error: behavior.upsertError ?? null };
      },
      insert: async (row: Record<string, unknown>) => {
        calls.push({ table, op: "insert", row });
        return { error: behavior.insertError ? behavior.insertError(row) : null };
      }
    })
  };
  return { service: service as any, calls };
}

describe("lib/billing/paddle", () => {
  afterEach(clearPaddleEnv);

  describe("getPaddleConfig / isPaddleConfigured", () => {
    it("returns null when API key or webhook secret is missing", () => {
      expect(getPaddleConfig()).toBeNull();
      expect(isPaddleConfigured()).toBe(false);
    });

    it("returns config with production base by default", () => {
      setPaddleEnv({ PADDLE_API_KEY: "pdl_test_key", PADDLE_WEBHOOK_SECRET: "s3cr3t" });
      const config = getPaddleConfig();
      expect(config?.baseUrl).toBe("https://api.paddle.com");
      expect(config?.apiVersion).toBe("1");
    });

    it("uses sandbox base + custom version when set", () => {
      setPaddleEnv({
        PADDLE_API_KEY: "pdl_sk",
        PADDLE_WEBHOOK_SECRET: "s3cr3t",
        PADDLE_ENV: "sandbox",
        PADDLE_API_VERSION: "2024-10-30"
      });
      const config = getPaddleConfig();
      expect(config?.baseUrl).toBe("https://sandbox-api.paddle.com");
      expect(config?.apiVersion).toBe("2024-10-30");
    });
  });

  describe("plan <-> price id mapping", () => {
    it("returns null price ids when unset", () => {
      expect(priceIdForPlan("pro")).toBeNull();
      expect(purchasedPlanIds()).toEqual([]);
      expect(planForPriceId("pri_anything")).toBeNull();
    });

    it("maps each configured price id to its plan", () => {
      setPaddleEnv({
        PADDLE_API_KEY: "k",
        PADDLE_WEBHOOK_SECRET: "s",
        PADDLE_PRICE_ID_CREATOR: "pri_creator",
        PADDLE_PRICE_ID_PRO: "pri_pro",
        PADDLE_PRICE_ID_STUDIO: "pri_studio"
      });
      expect(purchasedPlanIds()).toEqual(["creator", "pro", "studio"]);
      expect(priceIdForPlan("pro")).toBe("pri_pro");
      expect(planForPriceId("pri_studio")).toBe("studio");
      expect(planForPriceId("pri_unknown")).toBeNull();
    });
  });

  describe("verifyPaddleSignature", () => {
    const body = JSON.stringify({ event_id: "evt_1", event_type: "x" });

    it("accepts a valid signature", () => {
      expect(verifyPaddleSignature(body, sign(body), { secret: SECRET, now: T0 })).toBe(true);
    });

    it("rejects a tampered body", () => {
      expect(verifyPaddleSignature(body + "x", sign(body), { secret: SECRET, now: T0 })).toBe(false);
    });

    it("rejects a tampered h1", () => {
      const header = sign(body).replace(/h1=.*$/, "h1=deadbeef");
      expect(verifyPaddleSignature(body, header, { secret: SECRET, now: T0 })).toBe(false);
    });

    it("rejects a missing or malformed header", () => {
      expect(verifyPaddleSignature(body, null, { secret: SECRET, now: T0 })).toBe(false);
      expect(verifyPaddleSignature(body, "ts=abc", { secret: SECRET, now: T0 })).toBe(false);
    });

    it("rejects a signature outside the replay window", () => {
      expect(verifyPaddleSignature(body, sign(body, SECRET, T0 - 60), { secret: SECRET, now: T0 })).toBe(false);
      expect(
        verifyPaddleSignature(body, sign(body, SECRET, T0 - 60), { secret: SECRET, now: T0, toleranceSeconds: 120 })
      ).toBe(true);
    });

    it("rejects when no secret is available", () => {
      setPaddleEnv({ PADDLE_API_KEY: "k" });
      expect(verifyPaddleSignature(body, sign(body), {})).toBe(false);
    });
  });

  describe("createCheckoutSession", () => {
    it("throws PaddleNotConfiguredError when not configured", async () => {
      await expect(
        createCheckoutSession({ priceId: "pri_pro", userId: "user-1", plan: "pro" })
      ).rejects.toBeInstanceOf(PaddleNotConfiguredError);
    });

    it("returns transaction id + checkout url from Paddle", async () => {
      setPaddleEnv({ PADDLE_API_KEY: "pdl_test_key", PADDLE_WEBHOOK_SECRET: SECRET, PADDLE_ENV: "sandbox" });
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: { id: "txn_1", checkout: { url: "https://checkout.paddle.com/xyz" } } })
      });
      vi.stubGlobal("fetch", fetchMock);

      const session = await createCheckoutSession({ priceId: "pri_pro", userId: "user-1", plan: "pro" });
      expect(session).toEqual({ transactionId: "txn_1", url: "https://checkout.paddle.com/xyz" });

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe("https://sandbox-api.paddle.com/transactions");
      expect(init.headers.Authorization).toBe("Bearer pdl_test_key");
      expect(init.headers["Paddle-Version"]).toBe("1");
      expect(JSON.parse(init.body)).toMatchObject({
        items: [{ price_id: "pri_pro", quantity: 1 }],
        collection_mode: "automatic",
        custom_data: { user_id: "user-1", plan: "pro" }
      });
      vi.unstubAllGlobals();
    });

    it("throws with detail on a Paddle error response", async () => {
      setPaddleEnv({ PADDLE_API_KEY: "pdl_test_key", PADDLE_WEBHOOK_SECRET: SECRET });
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 401,
          json: async () => ({ error: { detail: "bad key" } })
        })
      );
      await expect(createCheckoutSession({ priceId: "pri_pro", userId: "user-1", plan: "pro" })).rejects.toThrow(
        "bad key"
      );
      vi.unstubAllGlobals();
    });

    it("throws when Paddle returns no checkout url", async () => {
      setPaddleEnv({ PADDLE_API_KEY: "pdl_test_key", PADDLE_WEBHOOK_SECRET: SECRET });
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: { id: "txn_1" } }) })
      );
      await expect(createCheckoutSession({ priceId: "pri_pro", userId: "user-1", plan: "pro" })).rejects.toThrow(
        /checkout URL/
      );
      vi.unstubAllGlobals();
    });
  });

  describe("subscriptionStateForEvent", () => {
    beforeEach(() => setPaddleEnv({ PADDLE_PRICE_ID_PRO: "pri_pro" }));

    it("maps transaction.completed to an active state", () => {
      const event = subscriptionEvent({
        id: undefined,
        subscription_id: "sub_123"
      });
      event.event_type = "transaction.completed";
      const state = subscriptionStateForEvent(event);
      expect(state).toEqual({ planId: "pro", status: "active", subscriptionId: "sub_123" });
    });

    it("maps subscription statuses and resolves the plan from items", () => {
      expect(subscriptionStateForEvent(subscriptionEvent({ status: "past_due" }))?.status).toBe("past_due");
      expect(subscriptionStateForEvent(subscriptionEvent({ status: "paused" }))?.status).toBe("paused");
      expect(subscriptionStateForEvent(subscriptionEvent({ status: "canceled" }))).toMatchObject({
        status: "canceled",
        planId: "pro"
      });
      expect(subscriptionStateForEvent(subscriptionEvent())).toMatchObject({ status: "active", planId: "pro" });
    });

    it("returns null for event types we ignore", () => {
      const event = subscriptionEvent();
      event.event_type = "subscription.reminder";
      expect(subscriptionStateForEvent(event)).toBeNull();
    });

    it("returns null state fields when a status is unmapped", () => {
      expect(subscriptionStateForEvent(subscriptionEvent({ status: "unknown" }))?.status).toBeNull();
    });
  });

  describe("userIdFromEvent", () => {
    it("reads user_id from custom_data", () => {
      expect(userIdFromEvent(subscriptionEvent())).toBe("user-1");
      expect(userIdFromEvent(subscriptionEvent({ custom_data: null }))).toBeNull();
    });
  });

  describe("applyPaddleEvent", () => {
    beforeEach(() => setPaddleEnv({ PADDLE_PRICE_ID_PRO: "pri_pro" }));

    it("upserts the subscription and activates the profile", async () => {
      const { service, calls } = makeServiceMock();
      const result = await applyPaddleEvent(service, subscriptionEvent());

      expect(result.handled).toBe(true);
      const subUpsert = calls.find((c) => c.table === "subscriptions" && c.op === "upsert");
      expect(subUpsert?.row).toMatchObject({
        user_id: "user-1",
        provider: "paddle",
        provider_subscription_id: "sub_123",
        plan: "pro",
        status: "active"
      });
      expect(subUpsert?.opts).toEqual({ onConflict: "provider_subscription_id", ignoreDuplicates: false });

      const profileUpsert = calls.find((c) => c.table === "profiles" && c.op === "upsert");
      expect(profileUpsert?.row).toMatchObject({ user_id: "user-1", plan: "pro", plan_status: "active" });

      const audit = calls.find((c) => c.table === "subscription_events" && c.op === "insert");
      expect(audit?.row).toMatchObject({
        type: "subscription.updated",
        user_id: "user-1",
        paddle_event_id: expect.stringMatching(/^evt_/)
      });
    });

    it("downgrades to beta on cancellation", async () => {
      const { service, calls } = makeServiceMock();
      await applyPaddleEvent(service, subscriptionEvent({ status: "canceled" }));

      const profileUpsert = calls.find((c) => c.table === "profiles" && c.op === "upsert");
      expect(profileUpsert?.row).toMatchObject({ plan: "beta", plan_status: "cancelled" });
    });

    it("flags past_due/paused without dropping the plan", async () => {
      const { service, calls } = makeServiceMock();
      await applyPaddleEvent(service, subscriptionEvent({ status: "paused" }));

      const profileUpsert = calls.find((c) => c.table === "profiles" && c.op === "upsert");
      expect(profileUpsert?.row).toMatchObject({ plan: "pro", plan_status: "cancelled" });
    });

    it("is a no-op without a user_id", async () => {
      const { service, calls } = makeServiceMock();
      const result = await applyPaddleEvent(service, subscriptionEvent({ custom_data: null }));
      expect(result.handled).toBe(false);
      expect(calls).toHaveLength(0);
    });

    it("ignores event types we don't act on", async () => {
      const { service, calls } = makeServiceMock();
      const event = subscriptionEvent();
      event.event_type = "payout.created";
      const result = await applyPaddleEvent(service, event);
      expect(result.handled).toBe(false);
      expect(calls).toHaveLength(0);
    });

    it("treats duplicate deliveries as success (dedupe via paddle_event_id)", async () => {
      const { service } = makeServiceMock({
        insertError: (row) =>
          row.paddle_event_id
            ? new Error('duplicate key value violates unique constraint "subscription_events_paddle_event_idx"')
            : null
      });
      const result = await applyPaddleEvent(service, subscriptionEvent());
      expect(result.handled).toBe(true);
    });

    it("falls back to inserting the audit row without paddle_event_id pre-migration", async () => {
      let firstAttempt = true;
      const { service, calls } = makeServiceMock({
        insertError: (row) => {
          if (row.paddle_event_id && firstAttempt) {
            firstAttempt = false;
            return new Error(
              'Skipped the column "paddle_event_id" which has the error "Could not find the \'paddle_event_id\' column of \'subscription_events\' in the schema cache"'
            );
          }
          return null;
        }
      });
      const result = await applyPaddleEvent(service, subscriptionEvent());
      expect(result.handled).toBe(true);
      const audits = calls.filter((c) => c.table === "subscription_events");
      expect(audits).toHaveLength(2);
      expect(audits[1].row.paddle_event_id).toBeUndefined();
    });

    it("rethrows a subscription upsert failure (fail open on activation)", async () => {
      const { service } = makeServiceMock({ upsertError: new Error("db down") });
      await expect(applyPaddleEvent(service, subscriptionEvent())).rejects.toThrow(/subscriptions upsert failed/);
    });
  });
});