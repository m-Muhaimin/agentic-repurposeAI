# Separate-frontend integration guide (API origin: `https://verv-ai.vercel.app`)

This repo (VervAI backend) is an **API backend served at `https://verv-ai.vercel.app`**
(the Vercel alias for project `vervai`; note the historical "verv-ai.vercel.com"
spelling is **not** a live origin — `.vercel.app` is). This guide explains how a
*separate* frontend app — a different codebase/deployment — authenticates and calls
that backend, including the hard constraints that fall out of how the backend works.

The authoritative route reference is [`docs/API.md`](API.md). This guide does not
repeat the route inventory; it covers the *wiring*.

---

## 1. The non-negotiable constraints

All facts below are verified in the backend source — design around them rather than
fighting them.

1. **Every API route is cookie-session-authed.** Routes construct the Supabase
   client with `lib/supabase/server.ts` → `createClient()` → `@supabase/ssr`
   cookie adapter, then `auth.getUser()` reads the session from the
   `sb-<project-ref>-auth-token` request cookie. Without it they return
   `401 { "error": "Not signed in" }` (e.g. `app/api/sources/route.ts`).
2. **There is no bearer-token / `Authorization`-header path and no CORS layer.**
   `next.config.js` has no `headers`/CORS; `createClient()` ignores headers.
   A browser calling the API cross-origin will be rejected by the browser's CORS
   preflight long before auth matters. Do **not** plan a direct-call architecture.
3. **The session cookie cannot be shared across Vercel subdomains.** The deployable
   origin sits under `vercel.app`, a public suffix owned by Vercel. Neither you nor
   the backend can set a cookie scoped to `.vercel.app`, so two separate Vercel
   projects (one `*.vercel.app`, one `*.vercel.app`) cannot share one Supabase
   session cookie directly.
4. **Path to a working design**: the separate frontend authenticates the user
   against the **same Supabase project** itself, then reaches the backend through a
   **same-origin, server-side proxy** (a "facade") that forwards the session cookie.
   The browser only ever talks to the frontend origin, so cookies stay same-origin
   and no CORS is involved. This is the recommended topology (Section 3).
5. Auth is **Supabase email/password (PKCE)** — the backend has no login endpoint;
   the current UI signs in in the browser with
   `supabase.auth.signInWithPassword` / `signUp` / `resetPasswordForEmail`. Your
   frontend does the same against the shared project.

---

## 2. What the frontend needs from the backend

Use the **same Supabase project** as the backend — these are public and browser-safe:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon>
VAPI_ORIGIN=https://verv-ai.vercel.app
```

- The **anon key** and project URL are safe in the browser (they are already shipped
  to every visitor of the current app via `lib/supabase/client.ts`).
- The **`SUPABASE_SERVICE_ROLE_KEY` must never** be shipped to a frontend — it
  bypasses RLS. Keep it server-side only.
- The backend's useful API surface for a frontend (details in `docs/API.md`):
  - Pipeline: `POST /api/repurpose` (enqueue → `{ jobId }`), `POST /api/process`,
    `POST /api/outputs/[id]/regenerate`, `GET /api/sources`,
    `DELETE /api/sources/[id]`, `PATCH /api/outputs/[id]`.
  - Agent: `/api/agent/runs`, `/api/agent/process` (SSE), `/api/agent/runs/[id]`,
    `/api/agent/runs/[id]/approve|cancel`, `/api/agent/queue` + `queue/publish`,
    `/api/agent/posts`, `/api/agent/repurpose`, `/api/agent/metrics/refresh`,
    `/api/agent/runs/[id]/graph`, preferences/strategy endpoints.
  - Integrations (OAuth wiring for YouTube / Google Drive / Buffer):
    `/api/integrations/{youtube|drive|buffer}/connect|callback|status|disconnect`,
    `/api/integrations/buffer/api-key`, `/api/integrations/buffer/profiles`.
  - Account/billing/analytics: `/api/account/export`, `/api/account/delete`,
    `/api/usage`, `/api/usage/spend`, `/api/billing/checkout`, `/api/events`,
    `/api/recommendations`, `/api/prompts`.
  - Probes: `GET /api/healthz` (liveness + Supabase reachability, `200`/`503`),
    `GET /api/healtz` (liveness, always `200`).
- Response conventions (`docs/API.md` is exhaustive):
  - Errors are `{ "error": string }` JSON (401 not signed in, 500 with the
    underlying PostgREST message, 503 for fail-closed paths).
  - `POST /api/repurpose` returns **503 fail-closed** if the `enqueue_job` RPC is
    missing, and is rate-limited (default 10/min, `REPURPOSE_RATE_LIMIT_PER_MIN`).
    Surface all non-2xx `{ error }` bodies to the user rather than inventing your
    own wording.
  - `/api/process` and `/api/agent/process` stream **Server-Sent Events**; the web
    UI also re-polls `GET /api/sources` every ~4s and re-kicks `/api/process` for
    `queued` jobs. Duplicate kicks are harmless (atomic job claim).

---

## 3. Recommended topology: same-origin API facade (proxy)

```
Browser ── same-origin cookies ──▶ Your frontend (app.yourdomain / *.vercel.app*)
                                     │  server-side proxy (middleware/rewrite)
                                     ▼
                            https://verv-ai.vercel.app/api/**
```

### 3a. Auth on the frontend

Bootstrap Supabase auth against the shared project with `@supabase/ssr`:

```ts
import { createBrowserClient } from "@supabase/ssr";

export function supabase() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// Login:
await supabase.auth.signInWithPassword({ email, password });
// Sign up:
await supabase.auth.signUp({ email, password });
// Password reset email:
await supabase.auth.resetPasswordForEmail(email);
// After a PKCE magic/callback code: exchangeCodeForSession(code)
```

The browser client owns session storage: Supabase stores the encrypted session in
the `sb-<project-ref>-auth-token` cookie (chunked as `…auth-token.0`, `.1`, … when
large) on **your** frontend origin, and refreshes it in the background. Expire the
token while **your** middleware is running so pages see a fresh session:

```ts
// middleware.ts (frontend) — also the place to gate authed routes.
const supabase = createServerClient(URL, ANON_KEY, {
  cookies: { get: (n) => request.cookies.get(n)?.value, /* set/remove as per @supabase/ssr docs */ },
});
await supabase.auth.getUser();
```

### 3b. Proxy the backend API (Next.js middleware, explicit fetch)

Forward the browser's cookies so the backend sees a valid session, and reflect the
backend's `Set-Cookie` back (refresh paths may set cookies). A middleware proxy
keeps every cookie (including chunked `…auth-token.0/.1`) intact.

```ts
// middleware.ts (frontend) — guard authed routes, then proxy API calls:
export async function middleware(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.host = "verv-ai.vercel.app"; // backend origin
  url.protocol = "https:";

  // Re-auth check for your own protected client routes (optional) here.

  if (!url.pathname.startsWith("/api")) return NextResponse.next();

  const headers = new Headers(request.headers);
  headers.delete("host");           // let the backend host itself
  headers.set("x-forwarded-proto", "https");

  const res = await fetch(url, {
    method: request.method,
    headers,
    body: ["GET", "HEAD"].includes(request.method) ? undefined : request.body,
    redirect: "manual",
    // Do NOT set credentials: "include" — the backend is contacted host-to-host.
  });

  const next = new NextResponse(res.body, { status: res.status, statusText: res.statusText });
  res.headers.forEach((value, key) => {
    if (key.toLowerCase() === "set-cookie") next.headers.append("Set-Cookie", value);
    else if (key.toLowerCase() !== "content-encoding") next.headers.set(key, value);
  });
  return next;
}
```

Notes:
- **Do not** forward an `Authorization` header or any Supabase key over this proxy —
  the backend authenticates from the cookie only.
- Alternative: `next.config.js` `rewrites()` also proxies and forwards cookies, but
  the middleware `fetch` form is explicit about cookie/header handling and works
  identically in `next dev` and `next start`.

### 3c. Dev-mode proxy (Vite / plain Node)

```ts
// vite.config.ts
export default {
  server: {
    proxy: {
      "/api": {
        target: "https://verv-ai.vercel.app",
        changeOrigin: true, // rewrites Host to the target; cookies pass through
        secure: true,
      },
    },
  },
};
```

`http-proxy` forwards the browser's `Cookie` header and reflects `Set-Cookie`
automatically, so the `sb-<ref>-auth-token` cookie scoped to `localhost` reaches the
backend. This works for `localhost` dev only — production must stay behind the
server-side facade (Section 3b) so the cookies are not exposed cross-origin.

---

## 4. Alternative: shared custom domain (no proxy, cookie on your apex)

If you own a domain and want a *direct* `api.` origin instead of a facade, you can
move the whole thing under **one registrable domain you control** and share cookies
on the apex:

```
app.example.com   → your frontend (Vercel project A, custom domain)
api.example.com   → https://verv-ai.vercel.app (Vercel project B, custom domain)
Cookie: Domain=example.com
```

Requirements and consequences:
- Attach a custom domain to **both** Vercel projects (a domain can only alias one
  project, so this needs two hostnames under one apex you own).
- The backend reads the *request* origin to build OAuth redirect URIs, so after the
  custom-domain switch all provider redirect URIs must be registered as
  `https://api.example.com/api/integrations/...` and `NEXT_PUBLIC_APP_URL` should be
  pinned to the new origin so a generic browser hits it (see `appBaseUrl` in
  `lib/youtube/oauth.ts` / `lib/buffer/oauth.ts`).
- Supabase session cookies set by your frontend must use `Domain=example.com` so the
  API host accepts them (`@supabase/ssr` cookie options).
- CORS: with the API directly on `api.example.com`, the browser *still* needs CORS
  headers from the backend for frontend-origin calls — which currently don't exist.
  So this topology only pays off if you also plan to add a backend CORS layer.
  **For most cases the facade (Section 3) is simpler and requires zero backend
  changes.**

---

## 5. File uploads & intake without the backend UI

Uploads do **not** go through the backend API — the current UI uploads straight to
Supabase (user-authed, so RLS applies) and inserts the `sources` row itself
(`app/(app)/upload/page.tsx`). Your frontend can replicate that flow exactly with
its own Supabase client:

```ts
const path = `${user.id}/${Date.now()}-${file.name}`;
await supabase.storage.from("sources").upload(path, file);
const { data: source } = await supabase
  .from("sources")
  .insert({
    user_id: user.id,
    title: file.name,
    storage_path: path,
    source_type: file.type.startsWith("video") ? "video" : "audio",
  })
  .select()
  .single();
// Then enqueue through the proxy:
await fetch("/api/repurpose", { method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ sourceId: source.id }) });
```

- The bucket is **private** (`sources`), paths are `{user_id}/{filename}`
  (`{user_id}/youtube/…` for YouTube extracts).
- Intake kinds mirror the current UI: audio/video file
  (`storage_path` + `source_type`), transcript file (`.txt/.srt/.vtt/.md/.markdown`,
  `source_type: "transcript"`), YouTube URL / paste-a-link
  (`source_url` + `source_type: "youtube" | "transcript"`).
- The 25 MB `serverActions.bodySizeLimit` in `next.config.js` does **not** apply to
  these uploads — they bypass the backend entirely.

---

## 6. OAuth "Connect" flows (YouTube / Drive / Buffer)

These flows are **backend-owned**: `/api/integrations/*/connect` (authed) redirects
to the provider's consent screen, and the provider sends the user back to
`/api/integrations/*/callback`, which exchanges the code and then redirects the
browser to the **backend's** `/connections?success=…` page.

Practical implications for a separate frontend:
- The callback landing page after a successful connect will be the backend's, not
  yours. A separate frontend can either (a) link/`<a target="_blank">` to the
  backend's `/connections` page for wiring, or (b) call the `connect` route and let
  the user land back on the backend's success page before returning to your app.
- Redirect URIs must be registered **exactly** as the backend sends them — verify
  with the (authed) `GET /api/integrations/debug`, which prints the precise
  `youtube` / `drive` / `buffer` URIs the backend produces on the current origin,
  plus config presence. Watch `NEXT_PUBLIC_APP_URL`: a stale localhost pin reaching
  a public request is ignored by the backend (`appBaseUrl`), which is why the debug
  endpoint exists.
- Drive and YouTube share the same Google OAuth client but are **separate**
  redirect-URI entries in the Google Cloud console.

---

## 7. Checklist

- [ ] Frontend uses the same `NEXT_PUBLIC_SUPABASE_URL` + anon key; service-role key
      never shipped.
- [ ] All `/api/**` calls go through a server-side facade that forwards cookies and
      reflects `Set-Cookie` (proxy), or the shared-apex-domain cookie design with a
      backend CORS layer.
- [ ] Auth done on the frontend (PKCE email/password), session cookie lives on the
      frontend origin (`sb-<project-ref>-auth-token`).
- [ ] Session refreshed in the frontend's middleware so authed routes/graphs are
      gated consistently.
- [ ] Uploads go directly to Supabase Storage + `sources` row insert, then
      `POST /api/repurpose` through the proxy.
- [ ] Non-2xx `{ error }` bodies surfaced verbatim; SSE consumers re-poll
      `/api/sources`.
- [ ] `verv-ai.vercel.com` is never used as a target — the origin is
      `https://verv-ai.vercel.app`.