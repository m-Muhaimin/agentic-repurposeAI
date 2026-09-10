// Buffer MCP connector (streamable HTTP JSON-RPC). These tests pin the wire
// contract: initialize handshake → initialized notification → tools/call, the
// Bearer Authorization header with the per-user Buffer API key, session id
// propagation, structuredContent extraction, and honest error mapping (401/403,
// rate-limit with Retry-After, tool-level isError).

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

let requests: Array<{ path: string; headers: Record<string, string>; body: unknown }> = [];
const canned = new Map<string, unknown>();

type FakeResponse = {
  ok: boolean;
  status: number;
  headers: { get: (name: string) => string | null };
  text: () => Promise<string>;
};

function mcpResponse(
  payload: unknown,
  opts: { status?: number; sessionId?: string; contentType?: string } = {}
): FakeResponse {
  const headers = {
    get: (name: string) => {
      const lower = name.toLowerCase();
      if (lower === "content-type") return opts.contentType ?? "application/json";
      if (lower === "mcp-session-id") return opts.sessionId ?? null;
      if (lower === "retry-after") return opts.status === 429 ? "30" : null;
      return null;
    }
  };
  return {
    ok: (opts.status ?? 200) < 400,
    status: opts.status ?? 200,
    headers,
    text: async () => (payload === null ? "" : JSON.stringify(payload))
  };
}

function stubFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}"));
      requests.push({
        path: String(url),
        headers: (init?.headers as Record<string, string>) ?? {},
        body
      });

      const method = (body as { method?: string }).method ?? "";
      if (method === "initialize") {
        return mcpResponse(
          {
            jsonrpc: "2.0",
            id: 1,
            result: {
              protocolVersion: "2025-06-18",
              capabilities: { tools: {} },
              serverInfo: { name: "buffer-test", version: "1" }
            }
          },
          { sessionId: "sess-1" }
        );
      }
      if (method === "notifications/initialized") {
        return mcpResponse(null, { status: 202 });
      }
      if (method === "tools/call") {
        const call = body as { params: { name: string } };
        const result = canned.get(call.params.name) ?? canned.get("default");
        return mcpResponse({
          jsonrpc: "2.0",
          id: 2,
          result: { content: [{ type: "text", text: JSON.stringify(result) }] }
        });
      }
      return mcpResponse({ jsonrpc: "2.0", id: 0, error: { code: -32601, message: "method not found" } }, { status: 200 });
    })
  );
}

function init() {
  requests = [];
  canned.clear();
  canned.set("default", {});
  stubFetch();
}

import {
  BufferMcpError,
  callMcpTool,
  mcpCreatePost,
  mcpGetAccount,
  mcpGetPost,
  mcpListPosts
} from "./mcp";

beforeEach(init);
afterEach(() => vi.unstubAllGlobals());

describe("callMcpTool — handshake + tool call", () => {
  it("runs initialize → initialized → tools/call with the API key in the Authorization header", async () => {
    canned.set("get_account", { account: { email: "me@example.com" }, organizations: [{ id: "org1", name: "Team" }] });

    const data = await callMcpTool("k-secret", "get_account", {});

    expect(data).toEqual({ account: { email: "me@example.com" }, organizations: [{ id: "org1", name: "Team" }] });
    expect(requests).toHaveLength(3);
    expect(requests[0].body).toMatchObject({ id: 1, method: "initialize" });
    expect(requests[1].body).toMatchObject({ method: "notifications/initialized" });
    expect(requests[2].body).toMatchObject({ id: 2, method: "tools/call", params: { name: "get_account" } });
    // The API key is the connector credential — never the OAuth token.
    expect(requests[0].headers["Authorization"]).toBe("Bearer k-secret");
    expect(requests[2].headers["Authorization"]).toBe("Bearer k-secret");
    // Session id from initialize is echoed on later calls.
    expect(requests[1].headers["Mcp-Session-Id"]).toBe("sess-1");
    expect(requests[2].headers["Mcp-Session-Id"]).toBe("sess-1");
  });

  it("throws not_configured without any network call when the API key is blank", async () => {
    await expect(callMcpTool("  ", "get_account")).rejects.toMatchObject({
      name: "BufferMcpError",
      code: "not_configured"
    });
    await expect(callMcpTool("", "get_account")).rejects.toMatchObject({ code: "not_configured" });
    expect(requests).toHaveLength(0);
  });

  it("surfaces a 401/403 as buffer_error (key rejected)", async () => {
    canned.set("default", {});
    // Override initialize with a rejection so we can pin the auth-failure path.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => mcpResponse({ jsonrpc: "2.0", id: 1, error: { code: -32000, message: "nope" } }, { status: 401 }))
    );
    await expect(callMcpTool("k-bad", "get_account", {})).rejects.toMatchObject({
      name: "BufferMcpError",
      code: "buffer_error"
    });
  });

  it("maps 429 to rate_limited with a Retry-After budget", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => mcpResponse(null, { status: 429 })));
    try {
      await callMcpTool("k", "get_account", {});
      expect.unreachable();
    } catch (err) {
      const e = err as BufferMcpError;
      expect(e.code).toBe("rate_limited");
      expect(e.retryAfterMs).toBe(30_000);
    }
  });

  it("throws buffer_error when the tool result carries isError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string | URL, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body ?? "{}"));
        if ((body as { method?: string }).method === "tools/call") {
          return mcpResponse({ jsonrpc: "2.0", id: 2, result: { isError: true, content: [{ type: "text", text: "boom" }] } });
        }
        return mcpResponse({ jsonrpc: "2.0", id: 1, result: {} }, { sessionId: "s" });
      })
    );
    await expect(callMcpTool("k", "create_post", {})).rejects.toThrow(/boom/);
  });
});

describe("typed wrappers normalize Buffer shapes", () => {
  it("mcpGetAccount handles get_account payloads (with or without account wrapper)", async () => {
    canned.set("get_account", { account: { email: "a@b.co" }, organizations: [{ id: "o1", name: "n" }] });
    await expect(mcpGetAccount("k")).resolves.toMatchObject({ email: "a@b.co", organizations: [{ id: "o1", name: "n" }] });

    canned.set("get_account", { email: "flat@b.co", organizations: [{ id: "o2", name: null }] });
    await expect(mcpGetAccount("k")).resolves.toMatchObject({ email: "flat@b.co", organizations: [{ id: "o2", name: null }] });
  });

  it("mcpListPosts flattens a { posts: [...] } payload and reads dates/metrics", async () => {
    canned.set("list_posts", {
      posts: [
        {
          id: "p1",
          status: "sent",
          text: "hello",
          channel: { id: "ch1", service: "twitter" },
          sentAt: "2026-09-01T10:00:00Z",
          metrics: { totalCount: 12 }
        }
      ]
    });
    const posts = await mcpListPosts("k", { organizationId: "o1", includeMetrics: true });
    expect(posts[0]).toMatchObject({ id: "p1", status: "sent", text: "hello" });
    expect(posts[0].sentAt).toBe("2026-09-01T10:00:00Z");
    expect(posts[0].metrics).toEqual({ totalCount: 12 });
    // includeMetrics was forwarded to the tool args.
    const callBody = requests[2].body as { params: { arguments: Record<string, unknown> } };
    expect(callBody.params.arguments.includeMetrics).toBe(true);
  });

  it("mcpGetPost falls back to scheduledAt for dueAt", async () => {
    canned.set("get_post", { id: "p9", status: "draft", scheduledAt: "2026-09-05T08:00:00Z" });
    const post = await mcpGetPost("k", "p9");
    expect(post.dueAt).toBe("2026-09-05T08:00:00Z");
  });

  it("mcpCreatePost sends mode addToQueue and returns the created post id", async () => {
    canned.set("create_post", { id: "p-new", status: "scheduled", text: "queued body", dueAt: "2026-09-06T09:00:00Z" });
    const post = await mcpCreatePost("k", { channelId: "ch1", text: "queued body", mode: "addToQueue" });
    expect(post.id).toBe("p-new");
    expect(post.dueAt).toBe("2026-09-06T09:00:00Z");

    const callBody = requests[2].body as { params: { arguments: Record<string, unknown> } };
    expect(callBody.params.arguments).toMatchObject({ channelId: "ch1", text: "queued body", mode: "addToQueue" });
  });
});