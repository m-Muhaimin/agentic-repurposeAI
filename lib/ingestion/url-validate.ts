// URL intake validation (pure).
//
// The URL/podcast adapters never fetch a link blindly: parse the URL, allow only
// http/https, reject credentials embedded in the URL, and refuse hosts that
// point at local/private/reserved space (so a user-supplied link can't be used
// as an SSRF lever against internal services). "Basic host allowlist reasoning"
// — we block obvious non-public hosts (localhost, *.local / *.internal,
// private/reserved IP literals) rather than pretending to be a full
// reputation system. No I/O, unit-testable in isolation.

export interface UrlValidation {
  ok: boolean;
  // Parsed URL when the input is structurally valid (even if rejected for
  // scheme/credential/host reasons, so callers can read host/path).
  url: URL | null;
  // Canonical form used for idempotency keys (host lowercased, default port +
  // fragment dropped). null when the input can't be parsed.
  normalized: string | null;
  errors: string[];
}

// Loopback + link-local + private/reserved IPv4 blocks (10/8, 172.16/12,
// 192.168/16, 127/8, 169.254/16, CGNAT 100.64/10, multicast 224/4).
const PRIVATE_V4: Array<[number, number]> = [
  [0x0a000000, 8],
  [0xac100000, 12],
  [0xc0a80000, 16],
  [0x7f000000, 8],
  [0xa9fe0000, 16],
  [0x64400000, 10],
  [0xe0000000, 4]
];

function ipv4ToInt(host: string): number | null {
  const parts = host.split(".");
  if (parts.length !== 4) return null;
  let out = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const n = Number(part);
    if (n > 255) return null;
    out = out * 256 + n;
  }
  return out >>> 0;
}

export function isPrivateIpLiteral(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (host === "::" || host === "::1") return true;
  // IPv4-mapped/translated loopbacks, link-local, ULA.
  if (host.startsWith("::ffff:") || host.startsWith("::ffff:")) {
    const v4 = host.split(":").pop();
    const int = v4 ? ipv4ToInt(v4) : null;
    if (int != null && PRIVATE_V4.some(([base, bits]) => (int >>> (32 - bits)) === (base >>> (32 - bits)))) {
      return true;
    }
  }
  if (host.startsWith("fe8") || host.startsWith("fec") || host.startsWith("fed") || host.startsWith("fee") || host.startsWith("fef")) {
    return true; // fe80::/10 link-local
  }
  if (host.startsWith("fc") || host.startsWith("fd")) return true; // fc00::/7 ULA
  return false;
}

export function isPrivateHost(hostname: string): boolean {
  const host = hostname.replace(/\.$/, "").toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost")) return true;
  if (host.endsWith(".local") || host.endsWith(".internal")) return true;
  if (host === "0.0.0.0" || host === "::" || host === "::1") return true;
  if (host.includes(":")) return isPrivateIpLiteral(host);
  const int = ipv4ToInt(host);
  if (int != null && PRIVATE_V4.some(([base, bits]) => (int >>> (32 - bits)) === (base >>> (32 - bits)))) {
    return true;
  }
  return false;
}

const DEFAULT_PORTS: Record<string, number> = { http: 80, https: 443 };

function hasCreds(url: URL): boolean {
  return url.username !== "" || url.password !== "";
}

// Canonicalize for idempotency: hosts are case-insensitive, default ports and
// fragments are noise, trailing dot and duplicate slashes are dropped.
export function normalizeUrl(raw: string): string {
  const url = safeParse(raw);
  if (!url) return "";
  url.hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  if (DEFAULT_PORTS[url.protocol.slice(0, -1)] === Number(url.port)) {
    url.port = "";
  }
  url.hash = "";
  url.pathname = url.pathname.replace(/\/{2,}/g, "/");
  if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
    url.pathname = url.pathname.slice(0, -1);
  }
  return url.toString();
}

function safeParse(raw: string): URL | null {
  try {
    return new URL(raw.trim());
  } catch {
    return null;
  }
}

// Validate a user-supplied URL before any adapter fetches it. Every rejection is
// human + actionable; unknown hosts are NOT blocked (only private/local space
// is), since public pages are exactly what these adapters exist to ingest.
export function validateUrl(raw: string): UrlValidation {
  const errors: string[] = [];
  const input = String(raw ?? "").trim();
  if (!input) {
    return { ok: false, url: null, normalized: null, errors: ["No URL was provided."] };
  }
  if (/[\u0000-\u0020]/.test(input)) {
    errors.push("That link contains spaces or control characters.");
  }

  const url = safeParse(input);
  if (!url) {
    errors.push("That doesn't look like a valid URL.");
    return { ok: false, url: null, normalized: null, errors };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    errors.push(`Only http and https links are supported — "${url.protocol.replace(":", "")}" isn't.`);
  }
  if (hasCreds(url)) {
    errors.push("We can't fetch links that contain a username or password.");
  }
  const host = url.hostname;
  if (!host) {
    errors.push("That link has no host (e.g. no example.com).");
  } else if (isPrivateHost(host)) {
    errors.push(`"${host}" isn't a public site, so we won't fetch it.`);
  }

  if (errors.length > 0) {
    return { ok: false, url, normalized: null, errors };
  }
  return { ok: true, url, normalized: normalizeUrl(input), errors };
}