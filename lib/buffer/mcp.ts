// Buffer MCP connector — talks to Buffer's remote Model Context Protocol server
// (https://mcp.buffer.com/mcp) exactly as documented in "Integrations → MCP",
// so the agent can list channels, read posts, schedule into the queue and pull
// post analytics. This is the "new capabilities via MCP" surface: agent
// scheduling (create_post into the queue), repurpose-from-existing-post
// (get_post → a transcript-style source), and post-metrics for agent evaluation.
//
// It differs from lib/buffer/client.ts (the OAuth GraphQL publish path) in ONE
// meaningful way: the MCP server authenticates with a Buffer API key
// (publish.buffer.com/settings/api) — NOT the auth.buffer.com OAuth access
// token. The two paths are deliberately separate: a human "Send now" keeps
// OAuth GraphQL; agent scheduling/metrics/intake use MCP.
//
// Transport: streamable HTTP (JSON-RPC 2.0 over POST). Each tool call opens a
// fresh session (initialize handshake → tools/call), so a serverless worker
// never has to keep MCP state alive between requests. The API key only appears
// in the Authorization header — never in logs, payloads or URLs.

const MCP_URL = "https://mcp.buffer.com/mcp";
const MCP_PROTOCOL_VERSION = "2025-06-18";

export type BufferMcpErrorCode = "not_configured" | "rate_limited" | "buffer_error";

export class BufferMcpError extends Error {
  code: BufferMcpErrorCode;
  retryAfterMs?: number;
  constructor(message: string, code: BufferMcpErrorCode, retryAfterMs?: number) {
    super(message);
    this.name = "BufferMcpError";
    this.code = code;
    this.retryAfterMs = retryAfterMs;
  }
}

// ── Typed shapes returned by the MCP tools ───────────────────────────────────
export interface BufferOrganization {
  id: string;
  name: string | null;
}

export interface BufferAccount {
  email: string | null;
  name: string | null;
  timezone: string | null;
  currentTime: string | null;
  organizations: BufferOrganization[];
}

export interface BufferChannelMCP {
  id: string;
  name: string | null;
  service: string;
  type: string | null;
  connectionStatus: string | null;
}

export interface BufferPostMCP {
  id: string;
  status: string;
  text: string | null;
  channel: { id: string; name: string | null; service: string | null } | null;
  dueAt: string | null;
  scheduledAt: string | null;
  sentAt: string | null;
  createdAt: string | null;
  publishError: string | null;
  metrics: Record<string, unknown> | null;
}

function retryAfterMs(res: Response): number {
  const header = res.headers.get("retry-after");
  if (!header) return 60_000;
  const secs = Number(header);
  if (!Number.isFinite(secs) || secs <= 0) return 60_000;
  // Cap a long Retry-After so we never spin forever waiting.
  return Math.min(secs, 3600) * 1000;
}

async function readErrorDetail(res: Response): Promise<string> {
  try {
    const text = await res.text();
    if (!text) return "";
    try {
      const json = JSON.parse(text) as { error?: unknown; message?: unknown };
      if (typeof json.message === "string") return json.message;
      return text.slice(0, 240);
    } catch {
      return text.slice(0, 240);
    }
  } catch {
    return "";
  }
}

// Parse a streamable-HTTP SSE response into the JSON-RPC payload it wraps.
// Buffer's MCP server answers tool calls with `event: message\ndata: {...}` and
// terminates with `end_of_stream`; a plain application/json body is also fine.
function parseSse(raw: string): unknown {
  let data = "";
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^data:\s?(.*)$/);
    if (m && m[1]) data += m[1];
  }
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

interface JsonRpcResponse {
  jsonrpc?: string;
  id?: number | string | null;
  result?: unknown;
  error?: { code?: number; message?: string };
}

async function postJson(
  apiKey: string,
  body: Record<string, unknown>,
  sessionId: string | null
): Promise<{ json: JsonRpcResponse | null; sessionId: string | null }> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
    Authorization: `Bearer ${apiKey}`
  };
  if (sessionId) headers["Mcp-Session-Id"] = sessionId;

  const res = await fetch(MCP_URL, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });

  if (res.status === 429) {
    throw new BufferMcpError("Buffer rate limit hit (MCP).", "rate_limited", retryAfterMs(res));
  }
  if (res.status === 401 || res.status === 403) {
    throw new BufferMcpError(`Buffer MCP rejected the API key (${res.status}).`, "buffer_error");
  }
  if (!res.ok) {
    const detail = await readErrorDetail(res);
    throw new BufferMcpError(
      `Buffer MCP request failed (${res.status})${detail ? `: ${detail}` : ""}.`,
      "buffer_error"
    );
  }

  const contentType = res.headers.get("content-type") ?? "";
  const raw = await res.text();
  let json: JsonRpcResponse | null = null;
  if (raw.trim()) {
    const parsed: unknown = contentType.includes("text/event-stream") ? parseSse(raw) : (() => {
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    })();
    json = (parsed ?? null) as JsonRpcResponse | null;
  }
  return { json, sessionId: res.headers.get("mcp-session-id") };
}

function rpcError(message: string, code?: number): BufferMcpError {
  return new BufferMcpError(message || `Buffer MCP error${code ? ` (${code})` : ""}.`, "buffer_error");
}

// Extract the meaningful payload out of an MCP tool result. Structured content
// wins when the server offers it; otherwise the text content (Buffer returns the
// tool's JSON payload as text) is parsed. Never returns a raw string when JSON.
function extractContent(result: { content?: Array<{ type: string; text?: string }>; structuredContent?: unknown }): unknown {
  if (result.structuredContent !== undefined && result.structuredContent !== null) {
    return result.structuredContent;
  }
  const text = (result.content ?? [])
    .filter((c) => c.type === "text" && typeof c.text === "string")
    .map((c) => c.text as string)
    .join("");
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function resultText(result: { content?: Array<{ type: string; text?: string }> }): string | null {
  const text = (result.content ?? [])
    .filter((c) => c.type === "text" && typeof c.text === "string")
    .map((c) => c.text as string)
    .join("");
  return text || null;
}

// ── Generic tool call: initialize → initialized → tools/call ────────────────
export async function callMcpTool(apiKey: string, name: string, args: Record<string, unknown> = {}): Promise<unknown> {
  if (!apiKey || !apiKey.trim()) {
    throw new BufferMcpError("Buffer MCP is not configured — set a Buffer API key.", "not_configured");
  }

  // 1) Session handshake. Server may return an Mcp-Session-Id to reuse.
  const init = await postJson(
    apiKey,
    {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: MCP_PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: { name: "vervai-agent", version: "1.0.0" }
      }
    },
    null
  );
  if (init.json?.error) throw rpcError(init.json.error.message ?? "initialize failed", init.json.error.code);

  // 2) One-way initialized notification (no response). Failed here is fine.
  await postJson(apiKey, { jsonrpc: "2.0", method: "notifications/initialized" }, init.sessionId);

  // 3) The tool call.
  const call = await postJson(
    apiKey,
    {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name, arguments: args ?? {} }
    },
    init.sessionId
  );
  if (call.json?.error) throw rpcError(call.json.error.message ?? `${name} failed`, call.json.error.code);

  const result = call.json?.result as { content?: Array<{ type: string; text?: string }>; structuredContent?: unknown; isError?: boolean } | undefined;
  if (!result) throw rpcError(`Buffer MCP returned no result for ${name}.`);
  if (result.isError) {
    const message = resultText(result as { content?: Array<{ type: string; text?: string }> }) ?? `${name} failed.`;
    throw rpcError(message);
  }
  return extractContent(result);
}

// ── Shape normalizers (tolerant: accept either the plain payload or the
//    *MCP-tool* wrapper keyed by tool name — Buffer's responses vary) ─────────
function pluck<T>(data: unknown, key: string, fallback: T): T {
  if (data && typeof data === "object" && key in (data as Record<string, unknown>)) {
    return (data as Record<string, unknown>)[key] as T;
  }
  return fallback;
}

function normalizeAccount(data: unknown): BufferAccount {
  const obj = (data ?? {}) as Record<string, unknown>;
  const organizations = Array.isArray(obj.organizations)
    ? (obj.organizations as Array<Record<string, unknown>>).map((o) => ({
        id: String(o.id ?? ""),
        name: typeof o.name === "string" ? o.name : null
      }))
    : [];
  const inner = (obj.account ?? {}) as Record<string, unknown>;
  return {
    email: typeof obj.email === "string" || typeof inner.email === "string" ? (String(obj.email ?? inner.email)) : null,
    name: typeof obj.name === "string" || typeof inner.name === "string" ? (String(obj.name ?? inner.name)) : null,
    timezone: typeof obj.timezone === "string" || typeof inner.timezone === "string" ? (String(obj.timezone ?? inner.timezone)) : null,
    currentTime: typeof obj.currentTime === "string" || typeof inner.currentTime === "string" ? (String(obj.currentTime ?? inner.currentTime)) : null,
    organizations
  };
}

function normalizeChannel(data: unknown): BufferChannelMCP {
  const c = (data ?? {}) as Record<string, unknown>;
  return {
    id: String(c.id ?? ""),
    name: typeof c.name === "string" ? c.name : typeof c.displayName === "string" ? c.displayName : null,
    service: String(c.service ?? ""),
    type: typeof c.type === "string" ? c.type : null,
    connectionStatus: typeof c.connectionStatus === "string" ? c.connectionStatus : null
  };
}

function normalizePost(data: unknown): BufferPostMCP {
  const p = (data ?? {}) as Record<string, unknown>;
  const channelRaw = (p.channel ?? {}) as Record<string, unknown>;
  const metricsRaw = p.metrics && typeof p.metrics === "object" ? (p.metrics as Record<string, unknown>) : null;
  return {
    id: String(p.id ?? ""),
    status: String(p.status ?? "draft"),
    text: typeof p.text === "string" ? p.text : null,
    channel: channelRaw && channelRaw.id
      ? { id: String(channelRaw.id), name: typeof channelRaw.name === "string" ? channelRaw.name : null, service: typeof channelRaw.service === "string" ? channelRaw.service : null }
      : null,
    dueAt: typeof p.dueAt === "string" ? p.dueAt : typeof p.scheduledAt === "string" ? p.scheduledAt : null,
    scheduledAt: typeof p.scheduledAt === "string" ? p.scheduledAt : null,
    sentAt: typeof p.sentAt === "string" ? p.sentAt : typeof p.publishedAt === "string" ? p.publishedAt : null,
    createdAt: typeof p.createdAt === "string" ? p.createdAt : null,
    publishError: typeof p.publishError === "string" ? p.publishError : typeof p.error === "string" ? p.error : null,
    metrics: metricsRaw
  };
}

// ── Typed tool wrappers (the surface the agent actually uses) ────────────────

export async function mcpGetAccount(apiKey: string): Promise<BufferAccount> {
  const data = await callMcpTool(apiKey, "get_account", {});
  return normalizeAccount(data);
}

export async function mcpListChannels(apiKey: string, organizationId: string): Promise<BufferChannelMCP[]> {
  const data = await callMcpTool(apiKey, "list_channels", { organizationId });
  const arr = Array.isArray(data) ? data : (pluck(data, "channels", []) as unknown[]);
  return (arr as unknown[]).map(normalizeChannel);
}

export interface McpListPostsOptions {
  organizationId: string;
  channelIds?: string[];
  status?: string[];
  first?: number;
  after?: string;
  includeMetrics?: boolean;
}

export async function mcpListPosts(apiKey: string, opts: McpListPostsOptions): Promise<BufferPostMCP[]> {
  const args: Record<string, unknown> = { organizationId: opts.organizationId };
  if (opts.channelIds && opts.channelIds.length > 0) args.channelIds = opts.channelIds;
  if (opts.status && opts.status.length > 0) args.status = opts.status;
  if (typeof opts.first === "number") args.first = Math.min(Math.max(opts.first, 1), 100);
  if (opts.after) args.after = opts.after;
  if (opts.includeMetrics) args.includeMetrics = true;
  const data = await callMcpTool(apiKey, "list_posts", args);
  const arr = Array.isArray(data) ? data : (pluck(data, "posts", []) as unknown[]);
  return (arr as unknown[]).map(normalizePost);
}

export async function mcpGetPost(apiKey: string, postId: string): Promise<BufferPostMCP> {
  const data = await callMcpTool(apiKey, "get_post", { postId });
  return normalizePost(data);
}

export interface McpCreatePostOptions {
  channelId: string;
  text: string;
  mode?: "addToQueue" | "shareNow" | "shareNext" | "customScheduled";
  dueAt?: string;
  saveToDraft?: boolean;
}

export async function mcpCreatePost(apiKey: string, opts: McpCreatePostOptions): Promise<BufferPostMCP> {
  const args: Record<string, unknown> = {
    channelId: opts.channelId,
    text: opts.text,
    schedulingType: "automatic"
  };
  if (opts.mode) args.mode = opts.mode;
  if (opts.dueAt) args.dueAt = opts.dueAt;
  if (opts.saveToDraft) args.saveToDraft = true;
  const data = await callMcpTool(apiKey, "create_post", args);
  return normalizePost(data);
}

export async function mcpGetAggregatedMetrics(
  apiKey: string,
  opts: { organizationId: string; startDateTime: string; endDateTime: string; channelIds?: string[] }
): Promise<Record<string, unknown>> {
  const args: Record<string, unknown> = {
    organizationId: opts.organizationId,
    startDateTime: opts.startDateTime,
    endDateTime: opts.endDateTime
  };
  if (opts.channelIds && opts.channelIds.length > 0) args.channelIds = opts.channelIds;
  const data = await callMcpTool(apiKey, "get_aggregated_post_metrics", args);
  return (data ?? {}) as Record<string, unknown>;
}