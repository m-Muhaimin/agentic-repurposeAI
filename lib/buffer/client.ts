// Buffer REST API client for the publish path. Token is passed by callers who
// already decrypted it — tokens never live here, in logs, or on the wire beyond
// what Buffer's API surface requires (access_token query param for GETs, form
// body for creates).
//
// Platform → Buffer "service" mapping. Buffer's profile objects carry a `service`
// like "linkedin" | "twitter" | "youtube" | ... Our DistributionPlatform names
// map onto it; `newsletter` has NO Buffer equivalent and is rejected honestly.
// `x` maps to Buffer's legacy "twitter" service id.

import type { DistributionPlatform } from "@/types/agent";

export const BUFFER_BASE = "https://api.bufferapp.com/1";

// Buffer service id for profile matching. newsletter has no Buffer channel.
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
  created?: boolean;
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

export async function fetchProfiles(accessToken: string): Promise<BufferProfile[]> {
  const res = await fetch(`${BUFFER_BASE}/profiles.json?access_token=${encodeURIComponent(accessToken)}`);
  if (!res.ok) {
    if (res.status === 429) {
      throw new BufferClientError("Buffer rate limit hit while listing profiles.", "rate_limited", retryAfterMs(res));
    }
    throw new BufferClientError(`Buffer profiles fetch failed (${res.status}).`, "buffer_error");
  }
  const json = (await res.json()) as unknown;
  if (!Array.isArray(json)) {
    throw new BufferClientError("Buffer profiles response was not an array.", "buffer_error");
  }
  return json as BufferProfile[];
}

export async function createUpdate(opts: {
  accessToken: string;
  text: string;
  profileIds: string[];
  scheduledAt?: string;
}): Promise<BufferUpdateResult> {
  const body = new URLSearchParams({
    access_token: opts.accessToken,
    text: opts.text,
    shorten: "false"
  });
  for (const id of opts.profileIds) body.append("profile_ids[]", id);
  if (opts.scheduledAt) body.set("scheduled_at", opts.scheduledAt);

  const res = await fetch(`${BUFFER_BASE}/updates/create.json`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString()
  });

  if (!res.ok) {
    if (res.status === 429) {
      throw new BufferClientError("Buffer rate limit hit while creating the update.", "rate_limited", retryAfterMs(res));
    }
    const detail = await parseErrorDetail(res);
    throw new BufferClientError(`Buffer update create failed (${res.status}): ${detail}`, "buffer_error");
  }

  const json = (await res.json()) as unknown;
  const result = json as BufferUpdateResult;
  if (result.success !== true || !result.update_id) {
    const detail = Array.isArray(result.errors) ? result.errors.join(", ") : "unknown response";
    throw new BufferClientError(`Buffer rejected the update: ${detail}`, "buffer_error");
  }
  return result;
}

function retryAfterMs(res: Response): number {
  const header = res.headers.get("retry-after");
  if (!header) return 60_000;
  const secs = Number(header);
  if (!Number.isFinite(secs) || secs <= 0) return 60_000;
  // Cap a long Retry-After so we never spin forever waiting.
  return Math.min(secs, 3600) * 1000;
}

// Pull Buffer's own rejection detail (e.g. an `errors` array or a `message`)
// so the job's error_message is actionable, never just a status code. Falls
// back to a plain "unknown" — never throws from inside a catch path.
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