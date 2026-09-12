// Buffer GraphQL API client for the publish path. Token is passed by callers who
// already decrypted it — tokens never live here, in logs, or on the wire beyond
// the Authorization header Buffer's API requires. Buffer ended its legacy REST
// API (api.bufferapp.com/1) in favour of a single GraphQL endpoint
// (api.buffer.com); the OAuth tokens issued by auth.buffer.com only work there.
//
// Platform → Buffer "service" mapping. Buffer's channel objects carry a `service`
// like "linkedin" | "twitter" | "youtube" | ... Our DistributionPlatform names
// map onto it; `newsletter` has NO Buffer equivalent and is rejected honestly.
// `x` maps to Buffer's legacy "twitter" service id.

import type { DistributionPlatform } from "@/types/agent";

export const BUFFER_API_URL = "https://api.buffer.com";

// Wall-clock cap on a single Buffer API call so a hung provider can't hang the
// request (ARCHITECTURE_FREEZE §3 bounded I/O).
const FETCH_TIMEOUT_MS = 10_000;

// Buffer service id for profile/channel matching. newsletter has no Buffer channel.
const PLATFORM_TO_SERVICE: Partial<Record<DistributionPlatform, string>> = {
  linkedin: "linkedin",
  x: "twitter",
  youtube_shorts: "youtube",
  tiktok: "tiktok",
  instagram: "instagram"
};

export interface BufferProfile {
  id: string;
  service: string;
  service_username?: string;
  avatar?: string;
  isQueuePaused?: boolean;
}

export interface BufferUpdateResult {
  success: boolean;
  update_id?: string;
  errors?: string[];
}

export type BufferClientErrorCode = "not_configured" | "rate_limited" | "buffer_error";

export class BufferClientError extends Error {
  code: BufferClientErrorCode;
  retryAfterMs?: number;
  constructor(message: string, code: BufferClientErrorCode, retryAfterMs?: number) {
    super(message);
    this.name = "BufferClientError";
    this.code = code;
    this.retryAfterMs = retryAfterMs;
  }
}

export function platformToBufferService(platform: DistributionPlatform): string | null {
  return PLATFORM_TO_SERVICE[platform] ?? null;
}

function authHeaders(accessToken: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`
  };
}

// POST a GraphQL operation to api.buffer.com and return `data`. Surfaces HTTP
// errors (rate limits, 401s) and Buffer's typed `errors` array as BufferClientError
// so the caller can fail the job honestly. Calling code composes the query
// strings; all values are embedded from trusted server-side inputs.
async function bufferGraphql<T>(accessToken: string, query: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort("timeout"), FETCH_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(BUFFER_API_URL, {
      method: "POST",
      headers: authHeaders(accessToken),
      body: JSON.stringify({ query }),
      signal: controller.signal
    });
  } catch (err) {
    throw failFromTransport(err);
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 429) {
    throw new BufferClientError("Buffer rate limit hit.", "rate_limited", retryAfterMs(res));
  }
  if (!res.ok) {
    const detail = await parseErrorDetail(res);
    throw new BufferClientError(`Buffer API request failed (${res.status}): ${detail}`, "buffer_error");
  }

  const json = (await res.json()) as { data?: T; errors?: { message?: string }[] };
  if (Array.isArray(json.errors) && json.errors.length > 0) {
    const message = json.errors.map((e) => e.message).filter(Boolean).join(", ") || "unknown error";
    throw new BufferClientError(`Buffer API error: ${message}`, "buffer_error");
  }
  return json.data as T;
}

// List the user's connected channels across every organization they belong to.
// GraphQL needs an organizationId to query channels, so it's a two-step: read
// the account's organizations, then fetch channels for each.
export async function fetchProfiles(accessToken: string): Promise<BufferProfile[]> {
  const accountData = await bufferGraphql<{ account: { organizations: { id: string }[] } }>(
    accessToken,
    `query { account { organizations { id } } }`
  );
  const orgs = accountData?.account?.organizations ?? [];

  const profiles: BufferProfile[] = [];
  for (const org of orgs) {
    const channelsData = await bufferGraphql<{
      channels: { id: string; service: string; name?: string; avatar?: string | null; isQueuePaused?: boolean }[];
    }>(
      accessToken,
      `query {
        channels(input: { organizationId: ${JSON.stringify(org.id)} }) {
          id
          service
          name
          avatar
          isQueuePaused
        }
      }`
    );
    for (const ch of channelsData?.channels ?? []) {
      profiles.push({
        id: ch.id,
        service: ch.service,
        service_username: ch.name,
        avatar: ch.avatar ?? undefined,
        isQueuePaused: ch.isQueuePaused
      });
    }
  }
  return profiles;
}

// Create a post for ONE channel via the createPost mutation. The GraphQL API
// posts to a single channel id per call (no more profile_ids[]), so callers that
// target several channels (INSIDE this function, on behalf of the caller) fan
// out one mutation per channel. An immediate send → `mode: shareNow`; a
// future-scheduled send → `mode: customScheduled` with dueAt.
export async function createUpdate(opts: {
  accessToken: string;
  text: string;
  profileIds: string[];
  scheduledAt?: string;
}): Promise<BufferUpdateResult> {
  if (opts.profileIds.length === 0) {
    throw new BufferClientError("Buffer createUpdate requires at least one channel id.", "buffer_error");
  }

  const updateIds: string[] = [];
  const errors: string[] = [];
  for (const channelId of opts.profileIds) {
    const scheduledSubquery = opts.scheduledAt
      ? `mode: customScheduled, dueAt: ${JSON.stringify(opts.scheduledAt)}`
      : `mode: shareNow`;
    const query = `mutation {
      createPost(input: {
        text: ${JSON.stringify(opts.text)}
        channelId: ${JSON.stringify(channelId)}
        schedulingType: automatic
        ${scheduledSubquery}
      }) {
        ... on PostActionSuccess {
          post { id }
        }
        ... on MutationError {
          message
        }
      }
    }`;
    const data = await bufferGraphql<{
      createPost?: { post?: { id?: string } | null; message?: string };
    }>(opts.accessToken, query);

    const created = data?.createPost;
    if (created?.post?.id) {
      updateIds.push(created.post.id);
    } else if (created?.message) {
      errors.push(created.message);
    } else {
      errors.push("unknown response");
    }
  }

  if (errors.length > 0) {
    throw new BufferClientError(`Buffer rejected the update: ${errors.join(", ")}`, "buffer_error");
  }
  return { success: true, update_id: updateIds[0] };
}

// Transport-level failures reject with raw DOM/Type errors; surface a timeout
// abort as the lib's typed error so callers never see a raw AbortError — all
// other failures keep their current shape.
function failFromTransport(err: unknown): never {
  if (err instanceof Error && err.name === "AbortError") {
    throw new BufferClientError("Buffer API request timed out.", "buffer_error");
  }
  throw err;
}

function retryAfterMs(res: Response): number {
  const header = res.headers.get("retry-after");
  if (!header) return 60_000;
  const secs = Number(header);
  if (!Number.isFinite(secs) || secs <= 0) return 60_000;
  // Cap a long Retry-After so we never spin forever waiting.
  return Math.min(secs, 3600) * 1000;
}

// Pull Buffer's own rejection detail (e.g. a `message`) so the job's
// error_message is actionable, never just a status code. Falls back to a plain
// "unknown" — never throws from inside a catch path.
async function parseErrorDetail(res: Response): Promise<string> {
  try {
    const text = await res.text();
    if (!text) return "no detail";
    const json = JSON.parse(text) as { errors?: string[] | string; message?: string };
    if (Array.isArray(json.errors)) return json.errors.join(", ") || "no detail";
    if (typeof json.errors === "string") return json.errors;
    if (typeof json.message === "string") return json.message;
    return text.slice(0, 240);
  } catch {
    return "no detail";
  }
}

// Find the profile for a platform. Honest: newsletter (and any unmapped
// platform) has no Buffer equivalent and yields nothing, not a guess.
export function findProfileForPlatform(profiles: BufferProfile[], platform: DistributionPlatform): BufferProfile | null {
  const service = platformToBufferService(platform);
  if (!service) return null;
  return profiles.find((p) => p.service === service) ?? null;
}