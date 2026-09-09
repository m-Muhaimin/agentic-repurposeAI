// Google Drive API v3 calls, authenticated as the connected user (server-only).
// A single authorized-account lookup used to stamp the connection row. Reuses
// the generic Google API error type from the YouTube client.

import { GoogleApiError } from "@/lib/youtube/client";

const API = "https://www.googleapis.com/drive/v3";

export interface DriveAccount {
  email: string;
  name: string;
}

export async function fetchDriveAccount(accessToken: string): Promise<DriveAccount> {
  const res = await fetch(`${API}/about?fields=user(displayName,emailAddress)`, {
    headers: { authorization: `Bearer ${accessToken}` }
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const e = (data?.error ?? {}) as Record<string, unknown>;
    const reasons = Array.isArray(e.errors) ? (e.errors as Array<Record<string, unknown>>) : [];
    throw new GoogleApiError(
      (typeof e.message === "string" && e.message) || `Drive API request failed (${res.status}).`,
      res.status,
      typeof reasons[0]?.reason === "string" ? reasons[0].reason : undefined
    );
  }
  const user = (data?.user ?? {}) as Record<string, unknown>;
  const email = typeof user.emailAddress === "string" ? user.emailAddress : "";
  if (!email) throw new GoogleApiError("No Drive account found for this connection.", 404);
  return {
    email,
    name: typeof user.displayName === "string" && user.displayName ? user.displayName : email
  };
}