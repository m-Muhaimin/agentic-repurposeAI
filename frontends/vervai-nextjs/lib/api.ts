/**
 * Typed fetch-through-proxy client for the root VervAI backend.
 *
 * All /api/* fetches go same-origin (proxied by next.config.mjs rewrites to
 * VAPI_ORIGIN). The browser's sb-<project-ref>-auth-token cookie is forwarded
 * by the proxy, so the backend sees a valid session. No Authorization header,
 * no Supabase keys over the wire.
 *
 * Error convention: every non-2xx response body is { error: string, ...extras }.
 * ApiError is thrown by apiFetch so callers can surface the backend's own
 * wording verbatim (never invent messages or fabricate states).
 */

import type {
  SourceRow,
  OutputFormat,
  AgentRunRow,
  DistributionJobRow,
  IdeaRow,
} from "@/lib/data";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export class ApiError extends Error {
  constructor(
    public status: number,
    public code?: string,
    public retryAfter?: number,
    public body?: Record<string, unknown>,
  ) {
    super(body?.error ? String(body.error) : `HTTP ${status}`);
    this.name = "ApiError";
  }
}

/** Backend sources list response: { sources: SourceRow[], jobs: JobInfo[] } */
export interface SourcesResponse {
  sources: SourceRow[];
  jobs: JobInfo[];
}

export interface JobInfo {
  id: string;
  source_id: string;
  status: "queued" | "running";
  started_at: string | null;
}

/** POST /api/repurpose success body. */
export interface EnqueueResult {
  ok: true;
  jobId: string;
  idempotent: boolean;
  usage: UsageSnapshot;
}

/** POST /api/repurpose RPC-limited failure body (ok:false). */
export interface EnqueueRejected {
  ok: false;
  error: string;
  code: string;
  used: number;
  limit: number;
  remaining: number;
  percent: number;
  resetAt: string;
}

export type EnqueueResponse = EnqueueResult | EnqueueRejected;

export interface UsageSnapshot {
  plan: string;
  planName: string;
  used: number;
  limit: number;
  remaining: number;
  percent: number;
  atLimit: boolean;
  resetAt: string;
  windowLabel: string;
  maxInputMinutes: number;
  maxInputSeconds: number;
  maxOutputsPerJob: number;
  maxRegenerationsPerJob: number;
}

export interface UsageResponse {
  usage: UsageSnapshot;
}

export interface SpendResponse {
  spend: Record<string, unknown>;
  errorRate: Record<string, unknown>;
}

export interface RunListResponse {
  runs: Array<AgentRunRow & { sourceTitle: string }>;
}

export interface RunDetailResponse {
  run: AgentRunRow;
  ideas: IdeaRow[];
  steps: Array<{ id: string; kind: string; created_at: string; payload: Record<string, unknown> | null }>;
  outputs: Array<{ id: string; format: OutputFormat; content: string; created_at: string }>;
  signals: Array<{ kind: string; payload: Record<string, unknown>; created_at: string }>;
  monthlySpend: Record<string, unknown> | null;
}

export interface ApproveRequest {
  approval: "approved" | "rejected";
  ideas: Array<{ id: string; approved: boolean; title?: string; description?: string }>;
}

export interface ApproveResponse {
  ok: true;
  status: "executing" | "cancelled";
}

export interface QueueResponse {
  ok: true;
  publishable: Array<{ id: string; runId: string; format: OutputFormat; preview: string; created_at: string }>;
  jobs: Array<DistributionJobRow & { preview: string; format: OutputFormat }>;
  channelsConnected: boolean;
  notConnectedMessage: string | null;
  historyWindowMs: number;
  note: string;
}

export interface PublishQueueRequest {
  outputId: string;
  platform: "linkedin" | "x" | "newsletter" | "youtube_shorts" | "tiktok" | "instagram";
  confirm: true;
  mode?: "queue" | "send";
  profileIds?: string[];
  scheduledAt?: string;
}

export interface PublishQueueResponse {
  ok: true;
  job: DistributionJobRow;
  status: "scheduled" | "published";
  channelsConnected: boolean;
  publishBlockedMessage: string | null;
}

export interface PublishSendResponse {
  ok: true;
  updateId: string;
  channelsConnected: boolean;
}

export type PublishResponse = PublishQueueResponse | PublishSendResponse;

// Notification record — mirrors backend camelCase row.
export interface NotificationRecord {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  severity: string;
  entityType: string | null;
  entityId: string | null;
  actionUrl: string | null;
  metadata: Record<string, unknown> | null;
  dedupeKey: string;
  expiresAt: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationsResponse {
  notifications: NotificationRecord[];
  nextCursor: string | null;
  unreadCount: number;
}

export interface PreferencesResponse {
  autoMode: "assist" | "execute" | "automate";
  brand: {
    tone: string;
    forbiddenPhrases: string[];
    examples: string[];
  };
  brandSamples: string | null;
  suggestions: Array<{ field: string; value: string; confidence: number }>;
}

export interface PutPreferencesRequest {
  autoMode?: "assist" | "execute" | "automate";
  tone?: string;
  forbiddenPhrases?: string[];
  examples?: string[];
  brandSamples?: string | null;
}

export interface ConfirmPreferenceRequest {
  field: "tone";
  value: string;
}

export interface CheckoutRequest {
  plan: "creator" | "pro" | "studio";
}

export interface CheckoutResponse {
  url: string;
}

export interface ExportAccountResponse {
  exportedAt: string;
  userId: string;
  sources: Array<Record<string, unknown>>;
  outputs: Array<Record<string, unknown>>;
  jobs: Array<Record<string, unknown>>;
  prompts: Array<Record<string, unknown>>;
}

// ---------------------------------------------------------------------------
// Low-level fetch
// ---------------------------------------------------------------------------

interface ApiFetchInit extends Omit<RequestInit, "body"> {
  body?: unknown;
}

async function apiFetch<T>(
  path: string,
  init?: ApiFetchInit,
): Promise<T> {
  const headers = new Headers(init?.headers);
  const body = init?.body;

  if (body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const fetchInit: RequestInit = {
    ...init,
    headers,
    credentials: "same-origin",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  };

  const r = await fetch(path, fetchInit);

  // Rate-limit: surface Retry-After.
  if (r.status === 429 && r.headers.has("Retry-After")) {
    const retryAfter = Number(r.headers.get("Retry-After"));
    const errorBody = (await r.json().catch(() => ({}))) as Record<string, unknown>;
    throw new ApiError(r.status, (errorBody.code as string) ?? "RATE_LIMITED", retryAfter, errorBody);
  }

  if (!r.ok) {
    const errorBody = (await r.json().catch(() => ({}))) as Record<string, unknown>;
    throw new ApiError(
      r.status,
      (errorBody.code as string) ?? undefined,
      undefined,
      errorBody,
    );
  }

  if (r.headers.get("content-type")?.startsWith("text/event-stream")) {
    return r as unknown as T;
  }

  return r.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** GET /api/sources → { sources, jobs }. */
export async function getSources(): Promise<SourcesResponse> {
  return apiFetch("/api/sources");
}

/** POST /api/repurpose → { ok, jobId, … } or { ok:false, error, code, … }. */
export async function enqueueRepurpose(
  sourceId: string,
  formats?: OutputFormat[],
  idempotencyKey?: string,
): Promise<EnqueueResponse> {
  return apiFetch("/api/repurpose", {
    method: "POST",
    body: { sourceId, formats, idempotencyKey },
  });
}

/** POST /api/process { jobId } — SSE; returns the raw Response for the caller
 * to read as a stream. */
export async function processJob(jobId: string): Promise<Response> {
  return fetch("/api/process", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jobId }),
    credentials: "same-origin",
  });
}

/** PATCH /api/outputs/[id] { content }. */
export async function editOutput(id: string, content: string): Promise<{ ok: true }> {
  return apiFetch(`/api/outputs/${id}`, {
    method: "PATCH",
    body: { content },
  });
}

/** POST /api/outputs/[id]/regenerate → { content }. */
export async function regenerateOutput(id: string): Promise<{ content: string }> {
  return apiFetch(`/api/outputs/${id}/regenerate`, {
    method: "POST",
  });
}

/** DELETE /api/sources/[id] → { ok:true }. */
export async function deleteSource(id: string): Promise<{ ok: true }> {
  return apiFetch(`/api/sources/${id}`, { method: "DELETE" });
}

/** GET /api/prompts → { brand_voice, overrides }. */
export async function getPrompts(): Promise<{
  brand_voice: string;
  overrides: Record<OutputFormat, string>;
}> {
  return apiFetch("/api/prompts");
}

/** POST /api/prompts { format, prompt } → { ok, saved? } or { ok, restored:true }. */
export async function savePrompt(
  format: OutputFormat | "brand_voice",
  prompt: string,
): Promise<{ ok: true; saved?: { format: OutputFormat | "brand_voice"; prompt: string }; restored?: boolean }> {
  return apiFetch("/api/prompts", {
    method: "POST",
    body: { format, prompt },
  });
}

/** POST /api/prompts/analyze-voice → { ok, voice? } or { ok:false, code }. */
export async function analyzeBrandVoice(): Promise<
  | { ok: true; voice: string }
  | { ok: false; code: string; samples: number }
> {
  return apiFetch("/api/prompts/analyze-voice", { method: "POST" });
}

/** GET /api/usage → { usage }. */
export async function getUsage(): Promise<UsageResponse> {
  return apiFetch("/api/usage");
}

/** GET /api/usage/spend → { spend, errorRate }. */
export async function getSpend(): Promise<SpendResponse> {
  return apiFetch("/api/usage/spend");
}

/** POST /api/billing/checkout { plan } → { url }. */
export async function checkout(plan: "creator" | "pro" | "studio"): Promise<CheckoutResponse> {
  return apiFetch("/api/billing/checkout", {
    method: "POST",
    body: { plan },
  });
}

/** POST /api/events { name, properties? } → { ok:true }. */
export async function trackEvent(
  name: string,
  properties?: Record<string, unknown>,
): Promise<{ ok: true }> {
  return apiFetch("/api/events", {
    method: "POST",
    body: { name, properties },
  });
}

/** GET /api/notifications?limit&cursor&unreadOnly&type → { notifications, nextCursor, unreadCount }. */
export async function getNotifications(params?: {
  limit?: number;
  cursor?: string;
  unreadOnly?: boolean;
  type?: string;
}): Promise<NotificationsResponse> {
  const search = new URLSearchParams();
  if (params?.limit !== undefined) search.set("limit", String(params.limit));
  if (params?.cursor !== undefined) search.set("cursor", params.cursor);
  if (params?.unreadOnly !== undefined) search.set("unreadOnly", String(params.unreadOnly));
  if (params?.type !== undefined) search.set("type", params.type);
  const q = search.size > 0 ? `?${search.toString()}` : "";
  return apiFetch(`/api/notifications${q}`);
}

/** POST /api/notifications/[id]/read → { ok:true }. */
export async function markNotificationRead(id: string): Promise<{ ok: true }> {
  return apiFetch(`/api/notifications/${id}/read`, { method: "POST" });
}

/** POST /api/notifications/read-all → { ok:true, marked? }. */
export async function markAllNotificationsRead(): Promise<{ ok: true; marked?: number }> {
  return apiFetch("/api/notifications/read-all", { method: "POST" });
}

/** POST /api/agent/runs { sourceId, mode? } → 201 { ok:true, run }. */
export async function createRun(
  sourceId: string,
  mode?: "assist" | "execute" | "automate",
): Promise<{ ok: true; run: AgentRunRow }> {
  return apiFetch("/api/agent/runs", {
    method: "POST",
    body: { sourceId, mode },
  });
}

/** GET /api/agent/runs → { runs } (augmented with sourceTitle). */
export async function getRunList(): Promise<RunListResponse> {
  return apiFetch("/api/agent/runs");
}

/** GET /api/agent/runs/[id] → { run, ideas, steps, outputs, signals, monthlySpend }. */
export async function getRunDetail(id: string): Promise<RunDetailResponse> {
  return apiFetch(`/api/agent/runs/${id}`);
}

/** POST /api/agent/runs/[id]/approve { approval, ideas } → { ok:true, status }. */
export async function approveRun(
  id: string,
  approval: "approved" | "rejected",
  ideas: Array<{ id: string; approved: boolean; title?: string; description?: string }>,
): Promise<ApproveResponse> {
  return apiFetch(`/api/agent/runs/${id}/approve`, {
    method: "POST",
    body: { approval, ideas },
  });
}

/** POST /api/agent/runs/[id]/cancel → { ok:true, status }. */
export async function cancelRun(id: string): Promise<{ ok: true; status: string }> {
  return apiFetch(`/api/agent/runs/${id}/cancel`, { method: "POST" });
}

/** POST /api/agent/process { runId } — SSE; returns raw Response. */
export async function processRun(runId: string): Promise<Response> {
  return fetch("/api/agent/process", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ runId }),
    credentials: "same-origin",
  });
}

/** GET /api/agent/preferences → { autoMode, brand, brandSamples, suggestions }. */
export async function getPreferences(): Promise<PreferencesResponse> {
  return apiFetch("/api/agent/preferences");
}

/** PUT /api/agent/preferences { autoMode?, tone?, … } → { ok:true }. */
export async function putPreferences(req: PutPreferencesRequest): Promise<{ ok: true }> {
  return apiFetch("/api/agent/preferences", {
    method: "PUT",
    body: req,
  });
}

/** POST /api/agent/preferences/confirm { field:"tone", value } → { ok:true }. */
export async function confirmPreference(req: ConfirmPreferenceRequest): Promise<{ ok: true }> {
  return apiFetch("/api/agent/preferences/confirm", {
    method: "POST",
    body: req,
  });
}

/** GET /api/agent/queue → { ok, publishable, jobs, channelsConnected, … }. */
export async function getQueue(): Promise<QueueResponse> {
  return apiFetch("/api/agent/queue");
}

/** POST /api/agent/queue/publish { outputId, platform, confirm:true, mode?, … }. */
export async function publishToQueue(
  req: PublishQueueRequest,
): Promise<PublishResponse> {
  return apiFetch("/api/agent/queue/publish", {
    method: "POST",
    body: req,
  });
}

/** GET /api/agent/observe → { ok, funnel, spend, … }. */
export async function getObserve(): Promise<{
  ok: true;
  funnel: Record<string, unknown>;
  spend: Record<string, unknown>;
  estimatedCostUsd: string | null;
  strategyDocs: number;
  lastStrategyAt: string | null;
  publishingConnected: boolean;
  engagementAvailable: boolean;
  hasAnyData: boolean;
  historyWindowMs: number;
  note: string;
}> {
  return apiFetch("/api/agent/observe");
}

/** GET /api/agent/scale → { ok, planId, planName, … }. */
export async function getScale(): Promise<{
  ok: true;
  planId: string;
  planName: string;
  permissions: Record<string, unknown>;
}> {
  return apiFetch("/api/agent/scale");
}

/** GET /api/agent/posts?status= → { ok, posts }. */
export async function getBufferPosts(status?: string): Promise<{
  ok: true;
  posts: Array<{
    id: string;
    status: string;
    text: string;
    preview: string;
    channelName: string;
    channelService: string;
    dueAt: string | null;
    sentAt: string | null;
    createdAt: string;
  }>;
}> {
  const q = status ? `?status=${encodeURIComponent(status)}` : "";
  return apiFetch(`/api/agent/posts${q}`);
}

/** POST /api/agent/repurpose { postId, mode? } → 201 { ok:true, sourceId, run }. */
export async function repurposeBufferPost(
  postId: string,
  mode?: "assist" | "execute" | "automate",
): Promise<{ ok: true; sourceId: string; run: AgentRunRow }> {
  return apiFetch("/api/agent/repurpose", {
    method: "POST",
    body: { postId, mode },
  });
}

/** POST /api/agent/metrics/refresh → { ok:true, … }. */
export async function refreshMetrics(): Promise<{
  ok: true;
  jobs: Array<{ id: string; status: string; error?: string }>;
}> {
  return apiFetch("/api/agent/metrics/refresh", { method: "POST" });
}

/** GET /api/agent/runs/[id]/graph → { graph:{ nodes, edges } }. */
export async function getRunGraph(id: string): Promise<{
  graph: { nodes: Array<Record<string, unknown>>; edges: Array<Record<string, unknown>> };
}> {
  return apiFetch(`/api/agent/runs/${id}/graph`);
}

/** GET /api/agent/strategy → { strategies }. */
export async function getStrategies(): Promise<{
  strategies: Array<{ id: string; title: string; body: string; source: string; created_at: string }>;
}> {
  return apiFetch("/api/agent/strategy");
}

/** POST /api/agent/strategy → { ok:true, strategyId, body }. */
export async function regenerateStrategy(): Promise<{
  ok: true;
  strategyId: string;
  body: string;
}> {
  return apiFetch("/api/agent/strategy", { method: "POST" });
}

/** GET /api/agent/strategy/next → { ok, strategyId, recommended, ranked, … }. */
export async function getStrategyNext(): Promise<{
  ok: true;
  strategyId: string | null;
  recommended: Record<string, unknown> | null;
  ranked: Array<Record<string, unknown>>;
  exclusions: Array<string>;
  headroom: Record<string, unknown>;
  rationale: string | null;
  monthlySpend: Record<string, unknown> | null;
}> {
  return apiFetch("/api/agent/strategy/next");
}

/** POST /api/agent/strategy/next → same shape, fresh rationale. */
export async function refreshStrategyNext(): Promise<{
  ok: true;
  strategyId: string | null;
  recommended: Record<string, unknown> | null;
  ranked: Array<Record<string, unknown>>;
  exclusions: Array<string>;
  headroom: Record<string, unknown>;
  rationale: string | null;
  monthlySpend: Record<string, unknown> | null;
}> {
  return apiFetch("/api/agent/strategy/next", { method: "POST" });
}

/** GET /api/account/export → { exportedAt, userId, sources, outputs, jobs, prompts }. */
export async function exportAccount(): Promise<ExportAccountResponse> {
  return apiFetch("/api/account/export");
}

/** PATCH /api/account/delete → { ok:true }. */
export async function deleteAccount(): Promise<{ ok: true }> {
  return apiFetch("/api/account/delete", { method: "PATCH" });
}

/** GET /api/integrations/youtube/status → { connected, channelId, channelTitle }. */
export async function getYoutubeStatus(): Promise<{
  connected: boolean;
  channelId: string;
  channelTitle: string;
}> {
  return apiFetch("/api/integrations/youtube/status");
}

/** GET /api/integrations/youtube/videos → { videos }. */
export async function getYoutubeVideos(): Promise<{
  videos: Array<{ id: string; title: string; thumbnails: Record<string, string> }>;
}> {
  return apiFetch("/api/integrations/youtube/videos");
}

/** DELETE /api/integrations/youtube/disconnect → { ok:true }. */
export async function disconnectYoutube(): Promise<{ ok: true }> {
  return apiFetch("/api/integrations/youtube/disconnect", { method: "DELETE" });
}

/** GET /api/integrations/drive/status → { connected, email, name }. */
export async function getDriveStatus(): Promise<{
  connected: boolean;
  email: string;
  name: string;
}> {
  return apiFetch("/api/integrations/drive/status");
}

/** DELETE /api/integrations/drive/disconnect → { ok:true }. */
export async function disconnectDrive(): Promise<{ ok: true }> {
  return apiFetch("/api/integrations/drive/disconnect", { method: "DELETE" });
}

/** GET /api/integrations/buffer/profiles?platform= → { ok, platform, profiles }. */
export async function getBufferProfiles(platform?: string): Promise<{
  ok: true;
  platform: string | null;
  profiles: Array<{ id: string; service: string; username: string; avatar: string | null; default: boolean }>;
}> {
  const q = platform ? `?platform=${encodeURIComponent(platform)}` : "";
  return apiFetch(`/api/integrations/buffer/profiles${q}`);
}

/** GET /api/integrations/buffer/api-key → { ok, hasApiKey }. */
export async function getBufferApiKey(): Promise<{ ok: true; hasApiKey: boolean }> {
  return apiFetch("/api/integrations/buffer/api-key");
}

/** PUT /api/integrations/buffer/api-key { apiKey } → { ok, hasApiKey:true }. */
export async function setBufferApiKey(apiKey: string): Promise<{ ok: true; hasApiKey: true }> {
  return apiFetch("/api/integrations/buffer/api-key", {
    method: "PUT",
    body: { apiKey },
  });
}

/** DELETE /api/integrations/buffer/api-key → { ok, hasApiKey:false }. */
export async function deleteBufferApiKey(): Promise<{ ok: true; hasApiKey: false }> {
  return apiFetch("/api/integrations/buffer/api-key", { method: "DELETE" });
}

/** DELETE /api/integrations/buffer/disconnect → { ok:true }. */
export async function disconnectBuffer(): Promise<{ ok: true }> {
  return apiFetch("/api/integrations/buffer/disconnect", { method: "DELETE" });
}

/** GET /api/integrations/debug → { env, google, buffer, redirectUris, hint }. */
export async function getIntegrationsDebug(): Promise<{
  env: { nextPublicAppUrl: string | null; requestOrigin: string; effectiveBase: string };
  google: { clientId: boolean; clientSecret: boolean };
  buffer: { clientId: boolean; clientSecret: boolean; encryptionKey: boolean; youtubeEncryptionKey: boolean };
  redirectUris: { youtube: string; drive: string; buffer: string };
  hint: string;
}> {
  return apiFetch("/api/integrations/debug");
}

/** GET /api/recommendations?sourceId= → { recommendations, objective, sourceId }. */
export async function getRecommendations(sourceId: string): Promise<{
  recommendations: Array<Record<string, unknown>>;
  objective: { kind: string; label: string };
  sourceId: string;
}> {
  return apiFetch(`/api/recommendations?sourceId=${encodeURIComponent(sourceId)}`);
}

/** Error-message helper — surfaces the backend's own wording, or a safe fallback. */
export function getErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    return err.body?.error ? String(err.body.error) : `Request failed (${err.status})`;
  }
  if (err instanceof Error) return err.message;
  return "An unexpected error occurred";
}
