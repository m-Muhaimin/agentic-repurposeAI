# Repurpose AI

A long-form → short-form content engine: upload an audio/video file, a YouTube URL, or a subtitle
file, and get back a LinkedIn post, a newsletter section, and short-form video scripts — generated
in your voice. Includes an agentic layer (`/agent`) that plans content angles from a transcript,
human-gates them, then generates and evaluates drafts.

**Stack (all free to start):**
- Next.js 14 (App Router) — Vercel free tier
- Supabase (Postgres + Auth + Storage) — free tier; email/password auth
- Gemini (`gemini-3.6-flash`) — draft generation + agent planning; OpenRouter fallback on quota
- AssemblyAI — free-tier transcription, only for the audio/video **file** path

## 1. Create your Supabase project
1. Go to supabase.com → New project.
2. In the SQL editor, run `supabase/schema.sql`, then `supabase/schema_agentic.sql` (the additive
   agent tables). If you ran an earlier version, use the migration blocks commented at the top of
   `schema.sql` instead of re-running the whole file.
3. In Authentication → Providers, enable **Email** with **Email/Password** (sign-in is email +
   password, not magic link).
4. Copy your Project URL, anon key, and service_role key into `.env.local`.

## 2. Get your other keys
- **Gemini**: aistudio.google.com/app/apikey → `GEMINI_API_KEY`
- **AssemblyAI**: assemblyai.com → `ASSEMBLYAI_API_KEY` (file-upload path only)
- **OpenRouter** (optional): fallback model when Gemini hits its quota → `OPENROUTER_API_KEY`
- **Google Cloud OAuth** (optional, for "Connect YouTube"): web-client creds → `GOOGLE_CLIENT_ID/SECRET`,
  add the `/api/integrations/youtube/callback` redirect URI, and set a stable `YOUTUBE_TOKEN_ENCRYPTION_KEY`
  (must be identical in every environment).

The full key list is documented in `.env.example` (gitignored `.env.local`).

## 3. Run locally
```bash
npm install
cp .env.example .env.local   # fill in the values from steps 1-2
npm run dev
```
Visit http://localhost:3000.

## 4. Deploy to Vercel
Add the same environment variables from `.env.local` as encrypted env vars in the Vercel project
settings, then deploy. Note: Vercel's serverless runtime has no yt-dlp/ffmpeg binaries, so the
YouTube-URL path needs a host that provides them — the file-upload and transcript paths work anywhere.

## How it works
1. Sign in (email/password). New routes land on `/dashboard`.
2. On `/upload`, pick one of three paths:
   - **File upload** — audio/video → Supabase Storage → AssemblyAI transcription.
   - **YouTube URL** — prefers the video's own captions via a connected channel (OAuth); falls back
     to the archived yt-dlp path (download → AssemblyAI) for public videos without captions.
   - **Transcript file** — `.srt`/`.vtt`/`.txt`, parsed directly with **no transcription cost**.
3. `POST /api/repurpose` is **enqueue-only** → `POST /api/process` (a claim-based worker) ingests the
   source, persists one canonical transcript per source (`transcripts` table), generates the drafts
   (Gemini, OpenRouter fallback on quota), writes them to `outputs`, and updates the source's status.
   The dashboard polls every 4s so status appears live; failed sources get a "Try again" button.
4. Drafts are edited/regenerated/copied in `/repurpose/[id]` and listed in `/library`. Custom prompts
   and your brand voice are managed on `/branding`.
5. **Agentic** (`/agent`): pick a source with a ready transcript → the agent plans 3–7 content angles
   (one Gemini call), you approve/keep angles per idea → drafts are generated per angle + suggested
   format, scored against a deterministic rubric (length / format-shape / grounding), and flagged weak
   drafts get at most one auto-revision in `execute` mode. Agent drafts land in the same `outputs`
   table, so they show up immediately in `/library` and the editor.
6. **Distribution** — bring your own Buffer account: connect it on `/connections`, then hand each
   queue item (draft) a target profile and send it now or schedule it ahead from the publish queue
   panel. Publish is **manual-approval only**, never autonomous. Access tokens are stored
   AES-256-GCM-encrypted and refreshed automatically near expiry. Full status incl. legacy stubs:
   see `docs/AGENTIC_ROADMAP.md`.

## Safety rails (all env-overridable in `lib/limits.ts`)
Max file size 200 MB, max duration 2 h, per-user rate limit of 10 enqueues/minute, strict extension +
MIME allowlists, YouTube URL validation (real video IDs, duration probed before download).

## Where to go next
- `docs/ROADMAP.md` — core-app roadmap (status per phase, incl. what's deliberately deferred).
- `docs/AGENTIC_ROADMAP.md` — agent roadmap: what's real vs. stubbed at each stage.
- `npm run verify:rls` and `npm run verify:agentic` — cross-user RLS checks you can re-run against a
  live project after any schema change.