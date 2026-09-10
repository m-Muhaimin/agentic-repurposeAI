// Stage 4 (BYOB): token freshness. getFreshAccessToken returns a usable access
// token, proactively refreshing it via Buffer's refresh_token grant when the
// stored expiry is about to pass — and NEVER fabricates one: no connection →
// null, refresh rejected → throws (surfaces as job `failed`), stale token with
// no way to refresh → flagged, and the refreshed pair is re-encrypted + saved.

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

let behavior: Record<string, unknown> = {};
const upserts: { payload: unknown }[] = [];
const updates: { payload: unknown }[] = [];
let fetches: string[] = [];

function chain() {
  const algorithm = {
    table: "" as string,
    eq() {
      return this;
    },
    select() {
      return this;
    },
    maybeSingle() {
      const s = (behavior[this.table] as Record<string, unknown>) ?? {};
      return { data: s.data ?? null, error: s.error ?? null };
    },
    upsert(payload: unknown) {
      upserts.push({ payload });
      return { error: behavior["upsert_error"] ?? null };
    },
    update(payload: unknown) {
      updates.push({ payload });
      return { error: behavior["update_error"] ?? null };
    }
  };
  return {
    from(table: string) {
      const fresh = { ...algorithm };
      fresh.table = table;
      return fresh;
    }
  };
}

const fakeService = { from: (t: string) => chain().from(t) };
vi.mock("@/lib/supabase/server", () => ({ createServiceClient: () => fakeService }));

// crypto passthrough so we can assert the ciphertext that lands in the DB.
vi.mock("./crypto", () => ({
  encryptSecret: (s: string) => `ENC:${s}`,
  decryptSecret: (s: string) => (typeof s === "string" && s.startsWith("ENC:") ? s.slice(4) : s)
}));

import {
  getFreshAccessToken,
  getApiKey,
  saveApiKey,
  deleteApiKey,
  getConnection,
  connectionHasOAuth,
  saveConnection
} from "./connections";

const TOKEN_URL = "https://auth.buffer.com/token";

function stubTokenResponse(body: { access_token?: string; refresh_token?: string; expires_in?: number; error?: string }) {
  const failed = Boolean(body.error);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string | URL, init?: RequestInit) => {
      fetches.push(String(url));
      fetches.push(String(init?.body ?? ""));
      return {
        ok: !failed,
        status: failed ? 400 : 200,
        json: async () => body,
        text: async () => ""
      } as Response;
    })
  );
}

function connectionRow(overrides: Record<string, unknown>) {
  return {
    data: {
      id: "c1",
      user_id: "u1",
      buffer_account_id: "1",
      buffer_username: "muhai",
      access_token: "ENC:tok-1",
      refresh_token: "ENC:refr-1",
      access_token_expires_at: null,
      created_at: "2026-09-07T00:00:00.000Z",
      updated_at: "2026-09-07T00:00:00.000Z",
      ...overrides
    }
  };
}

beforeEach(() => {
  behavior = {};
  upserts.length = 0;
  fetches = [];
  // refreshAccessToken reads client credentials at call time — provide a
  // throwaway pair so the real refresh grant path is exercised, not the
  // config_missing guard.
  process.env.BUFFER_CLIENT_ID = "test-client-id";
  process.env.BUFFER_CLIENT_SECRET = "test-client-secret";
  vi.unstubAllGlobals();
});

afterEach(() => {
  delete process.env.BUFFER_CLIENT_ID;
  delete process.env.BUFFER_CLIENT_SECRET;
  vi.unstubAllGlobals();
});

describe("getFreshAccessToken — token freshness", () => {
  it("returns null when the user has no connection", async () => {
    behavior["buffer_connections"] = { data: null };
    expect(await getFreshAccessToken("u1")).toBeNull();
  });

  it("returns the stored token untouched when it is still valid", async () => {
    behavior["buffer_connections"] = connectionRow({
      access_token_expires_at: new Date(Date.now() + 3600_000).toISOString()
    });
    const fresh = await getFreshAccessToken("u1");
    expect(fresh).toEqual({ token: "tok-1", refreshed: false });
    expect(fetches).toEqual([]); // no network at all
  });

  it("does not refresh when Buffer gave no expiry info (token as-is)", async () => {
    behavior["buffer_connections"] = connectionRow({});
    const fresh = await getFreshAccessToken("u1");
    expect(fresh).toEqual({ token: "tok-1", refreshed: false });
    expect(fetches).toEqual([]);
  });

  it("refreshes when the token is expired and persists the rotated pair (encrypted)", async () => {
    // First read: expired token. After the refresh+save, re-read: fresh token.
    let reads = 0;
    behavior["buffer_connections"] = {
      get data() {
        reads += 1;
        if (reads === 1) {
          return connectionRow({
            access_token_expires_at: new Date(Date.now() - 5000).toISOString(),
            access_token: "ENC:tok-1",
            refresh_token: "ENC:refr-1"
          }).data;
        }
        return connectionRow({
          access_token: "ENC:tok-2",
          refresh_token: "ENC:refr-2",
          access_token_expires_at: new Date(Date.now() + 86_400_000).toISOString()
        }).data;
      }
    };
    stubTokenResponse({ access_token: "tok-2", refresh_token: "refr-2", expires_in: 86_400 });

    const fresh = await getFreshAccessToken("u1");
    expect(fresh).toEqual({ token: "tok-2", refreshed: true });
    // The grant really was the refresh flow, not a code exchange.
    expect(fetches.join("|")).toContain("grant_type=refresh_token");
    const saved = upserts[0].payload as Record<string, unknown>;
    expect(saved.user_id).toBe("u1");
    expect(saved.access_token).toBe("ENC:tok-2");
    expect(saved.refresh_token).toBe("ENC:refr-2");
    expect(saved.access_token_expires_at).toBeTruthy();
  });

  it("never replays a single-use refresh token when Buffer omits a new one", async () => {
    let reads = 0;
    behavior["buffer_connections"] = {
      get data() {
        reads += 1;
        if (reads === 1) {
          return connectionRow({
            access_token_expires_at: new Date(Date.now() - 5000).toISOString(),
            access_token: "ENC:tok-1",
            refresh_token: "ENC:refr-1"
          }).data;
        }
        return connectionRow({ access_token: "ENC:tok-2", refresh_token: null }).data;
      }
    };
    stubTokenResponse({ access_token: "tok-2", expires_in: 86_400 });

    await getFreshAccessToken("u1");
    const saved = upserts[0].payload as Record<string, unknown>;
    // A missing refresh_token in the rotation response is stored as null —
    // the old one has already been consumed and MUST NOT be replayed.
    expect(saved.refresh_token).toBeNull();
  });

  it("surfaces the stale token with refreshed:false when there is no way to refresh", async () => {
    behavior["buffer_connections"] = connectionRow({
      access_token_expires_at: new Date(Date.now() - 5000).toISOString(),
      refresh_token: null
    });
    const fresh = await getFreshAccessToken("u1");
    expect(fresh).toEqual({ token: "tok-1", refreshed: false });
    expect(fetches).toEqual([]);
  });

  it("throws on a rejected refresh (caller marks the job failed — no retry loop)", async () => {
    behavior["buffer_connections"] = connectionRow({
      access_token_expires_at: new Date(Date.now() - 5000).toISOString()
    });
    stubTokenResponse({ error: "invalid_grant" });
    await expect(getFreshAccessToken("u1")).rejects.toThrow(/refresh failed/i);
    expect(upserts).toEqual([]);
  });
});

describe("Buffer API key (MCP connector credential)", () => {
  it("returns null for a user with no API key", async () => {
    behavior["buffer_connections"] = { data: null };
    expect(await getApiKey("u1")).toBeNull();
  });

  it("returns the decrypted key when one is stored", async () => {
    behavior["buffer_connections"] = { data: { api_key: "ENC:kp-1" } };
    expect(await getApiKey("u1")).toBe("kp-1");
  });

  it("saves the key encrypted and does not need OAuth columns to be real", async () => {
    behavior["buffer_connections"] = { data: null };
    await saveApiKey("u1", "  kp-new  ");
    const saved = upserts[0].payload as Record<string, unknown>;
    expect(saved.user_id).toBe("u1");
    expect(saved.api_key).toBe("ENC:kp-new");
    expect(saved.access_token).toBe("");
    expect(saved.buffer_account_id).toBe("api-key");
    expect(saved.buffer_username).toBe("Buffer API key");
  });

  it("keeps an existing OAuth connection when only the API key is added", async () => {
    behavior["buffer_connections"] = {
      data: connectionRow({ access_token: "ENC:tok-1", refresh_token: "ENC:refr-1" }).data
    };
    await saveApiKey("u1", "kp-2");
    const saved = upserts[0].payload as Record<string, unknown>;
    expect(saved.api_key).toBe("ENC:kp-2");
    expect(saved.access_token).toBe("ENC:tok-1");
    expect(saved.refresh_token).toBe("ENC:refr-1");
    expect(saved.buffer_account_id).toBe("1");
  });

  it("removes the key with an update (OAuth connection untouched)", async () => {
    await deleteApiKey("u1");
    expect(updates[0].payload).toEqual({ api_key: null });
  });

  it("saveConnection preserves an existing API key (OAuth connect must not wipe MCP credentials)", async () => {
    behavior["buffer_connections"] = {
      data: { api_key: "ENC:kp-keep", access_token: "", refresh_token: null, access_token_expires_at: null }
    };
    await saveConnection(
      "u1",
      { access_token: "tok-9", refresh_token: "refr-9", expires_in: 86_400 },
      { id: "9", username: "acc" }
    );
    const saved = upserts[0].payload as Record<string, unknown>;
    expect(saved.access_token).toBe("ENC:tok-9");
    expect(saved.api_key).toBe("ENC:kp-keep");
  });
});

describe("connectionHasOAuth + api-key-only rows", () => {
  it("treats an empty access_token (api-key-only row) as NOT an OAuth connection", async () => {
    expect(connectionHasOAuth({ accessToken: "" })).toBe(false);
    expect(connectionHasOAuth({ accessToken: "tok" })).toBe(true);
  });

  it("getConnection never tries to decrypt a blank access_token", async () => {
    behavior["buffer_connections"] = {
      data: { ...connectionRow({}).data, access_token: "", api_key: "ENC:kp-1" }
    };
    const conn = await getConnection("u1");
    expect(conn).not.toBeNull();
    expect(conn!.accessToken).toBe("");
    expect(conn!.apiKey).toBe("kp-1");
  });

  it("getFreshAccessToken returns null for an api-key-only row (manual send stays OAuth-gated)", async () => {
    behavior["buffer_connections"] = {
      data: { ...connectionRow({}).data, access_token: "", refresh_token: null }
    };
    expect(await getFreshAccessToken("u1")).toBeNull();
    expect(fetches).toEqual([]);
  });
});