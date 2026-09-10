import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getApiKey } from "@/lib/buffer/connections";
import { mcpGetAccount, mcpListPosts, BufferMcpError, type BufferPostMCP } from "@/lib/buffer/mcp";
import { log } from "@/lib/logger";

// GET /api/agent/posts — the user's Buffer posts, for the "repurpose an existing
// post" picker (run detail + publish queue). Real data via the MCP connector's
// list_posts. Deliberately lightweight: id/status/text-preview/channel/dates —
// no metrics here (those belong to the performance panel).

function postView(p: BufferPostMCP) {
  const channelName =
    p.channel?.name ??
    (p.channel?.service ? `@${p.channel.service}` : null) ??
    "Unknown channel";
  return {
    id: p.id,
    status: p.status,
    text: p.text ?? "",
    preview: (p.text ?? "").slice(0, 280),
    channelName,
    channelService: p.channel?.service ?? null,
    dueAt: p.dueAt,
    sentAt: p.sentAt,
    createdAt: p.createdAt
  };
}

export async function GET(request: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const apiKey = await getApiKey(user.id);
  if (!apiKey) {
    return NextResponse.json(
      {
        ok: false,
        error: "Add a Buffer API key to browse your Buffer posts for repurposing.",
        code: "NO_BUFFER_API_KEY"
      },
      { status: 503 }
    );
  }

  const url = new URL(request.url);
  const statusParam = url.searchParams.get("status");
  const status = statusParam ? statusParam.split(",").filter(Boolean) : undefined;

  try {
    const account = await mcpGetAccount(apiKey);
    const posts: BufferPostMCP[] = [];
    for (const org of account.organizations) {
      const orgPosts = await mcpListPosts(apiKey, {
        organizationId: org.id,
        status,
        first: 100
      });
      posts.push(...orgPosts);
    }
    log.info("agent.posts_listed", { user_id: user.id, posts: posts.length });
    return NextResponse.json({ ok: true, posts: posts.map(postView) });
  } catch (err) {
    const code = err instanceof BufferMcpError ? err.code : "buffer_error";
    const message = err instanceof BufferMcpError ? err.message : "Could not reach the Buffer MCP connector.";
    log.error("agent.posts_list_failed", err instanceof Error ? err : new Error(message), { user_id: user.id, code });
    return NextResponse.json({ ok: false, error: message, code }, { status: 502 });
  }
}