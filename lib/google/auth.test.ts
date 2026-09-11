import { describe, expect, it, afterEach, vi, beforeEach } from "vitest";
import {
  buildGoogleAuthAuthorizeUrl,
  exchangeCodeForIdToken,
  googleAuthRedirectUri,
  GOOGLE_AUTH_SCOPES
} from "./auth";
import { GoogleOAuthError } from "@/lib/youtube/oauth";

const ORIGINAL_APP_URL = process.env.NEXT_PUBLIC_APP_URL;
const ORIGINAL_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const ORIGINAL_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

afterEach(() => {
  vi.restoreAllMocks();
  for (const [k, v] of [
    ["NEXT_PUBLIC_APP_URL", ORIGINAL_APP_URL],
    ["GOOGLE_CLIENT_ID", ORIGINAL_CLIENT_ID],
    ["GOOGLE_CLIENT_SECRET", ORIGINAL_CLIENT_SECRET]
  ] as const) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

beforeEach(() => {
  process.env.GOOGLE_CLIENT_ID = "test-client-id";
  process.env.GOOGLE_CLIENT_SECRET = "test-client-secret";
});

describe("googleAuthRedirectUri", () => {
  it("builds a /api/auth/google/callback URI from a pinned public origin", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://verv-ai.vercel.app";
    const request = new Request("https://verv-ai.vercel.app/some/other/path");
    expect(googleAuthRedirectUri(request)).toBe("https://verv-ai.vercel.app/api/auth/google/callback");
  });

  it("normalizes a trailing-slash NEXT_PUBLIC_APP_URL", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://verv-ai.vercel.app/";
    const request = new Request("https://verv-ai.vercel.app/x");
    expect(googleAuthRedirectUri(request)).toBe("https://verv-ai.vercel.app/api/auth/google/callback");
  });

  it("falls back to the request origin when the env var is unset", () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    const request = new Request("http://localhost:3000/api/auth/google/connect");
    expect(googleAuthRedirectUri(request)).toBe("http://localhost:3000/api/auth/google/callback");
  });
});

describe("buildGoogleAuthAuthorizeUrl", () => {
  it("includes OIDC scopes, state, nonce, and the code response type", () => {
    const url = buildGoogleAuthAuthorizeUrl({
      redirectUri: "https://verv-ai.vercel.app/api/auth/google/callback",
      state: "abc123",
      nonce: "n-xyz"
    });
    const parsed = new URL(url);
    expect(parsed.origin).toBe("https://accounts.google.com");
    expect(parsed.pathname).toBe("/o/oauth2/v2/auth");
    expect(parsed.searchParams.get("client_id")).toBe("test-client-id");
    expect(parsed.searchParams.get("redirect_uri")).toBe(
      "https://verv-ai.vercel.app/api/auth/google/callback"
    );
    expect(parsed.searchParams.get("response_type")).toBe("code");
    expect(parsed.searchParams.get("scope")).toBe(GOOGLE_AUTH_SCOPES);
    expect(parsed.searchParams.get("state")).toBe("abc123");
    expect(parsed.searchParams.get("nonce")).toBe("n-xyz");
    expect(parsed.searchParams.get("prompt")).toBe("select_account");
  });

  it("throws a config-missing error without GOOGLE_CLIENT_ID", () => {
    delete process.env.GOOGLE_CLIENT_ID;
    expect(() =>
      buildGoogleAuthAuthorizeUrl({
        redirectUri: "https://verv-ai.vercel.app/api/auth/google/callback",
        state: "s",
        nonce: "n"
      })
    ).toThrow(GoogleOAuthError);
  });
});

describe("exchangeCodeForIdToken", () => {
  it("returns the id_token on a successful token request", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ id_token: "jwt.id.token", access_token: "at", token_type: "Bearer", expires_in: 3600 }), {
        status: 200,
        headers: { "content-type": "application/json" }
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const { id_token } = await exchangeCodeForIdToken("the-code", "https://verv-ai.vercel.app/api/auth/google/callback");

    expect(id_token).toBe("jwt.id.token");
    const [, opts] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(String(opts.method)).toBe("POST");
    const body = new URLSearchParams(String(opts.body));
    expect(body.get("grant_type")).toBe("authorization_code");
    expect(body.get("code")).toBe("the-code");
    expect(body.get("redirect_uri")).toBe("https://verv-ai.vercel.app/api/auth/google/callback");
    expect(body.get("client_id")).toBe("test-client-id");
    expect(body.get("client_secret")).toBe("test-client-secret");
  });

  it("surfaces Google's JSON error on a non-2xx response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ error: "invalid_grant", error_description: "Code expired." }), {
          status: 400,
          headers: { "content-type": "application/json" }
        })
      )
    );
    await expect(
      exchangeCodeForIdToken("bad-code", "https://verv-ai.vercel.app/api/auth/google/callback")
    ).rejects.toThrow(/Code expired./);
  });

  it("throws config-missing without secrets", async () => {
    delete process.env.GOOGLE_CLIENT_SECRET;
    await expect(
      exchangeCodeForIdToken("code", "https://verv-ai.vercel.app/api/auth/google/callback")
    ).rejects.toThrow(GoogleOAuthError);
  });

  it("rejects a response that lacks an id_token", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ access_token: "at" }), {
          status: 200,
          headers: { "content-type": "application/json" }
        })
      )
    );
    await expect(
      exchangeCodeForIdToken("code", "https://verv-ai.vercel.app/api/auth/google/callback")
    ).rejects.toThrow(/id_token/);
  });
});