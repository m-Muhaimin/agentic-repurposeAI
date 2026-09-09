// "What your agent knows" — every figure is real and user-scoped, computed once
// server-side and shared by the workspace and the AI insights page. Each lookup
// fails open to an honest empty value; nothing is invented here.

import { createServiceClient } from "@/lib/supabase/server";
import { getAgentPreferences } from "@/lib/agent/memory";
import { getConnection } from "@/lib/buffer/connections";
import type { AgentContextData } from "@/components/agent/agent-context-strip";

export async function getAgentContext(userId: string): Promise<AgentContextData> {
  const service = createServiceClient();

  let libraryDrafts = 0;
  try {
    const { count } = await service
      .from("outputs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);
    libraryDrafts = count ?? 0;
  } catch {
    libraryDrafts = 0;
  }

  let totalSources = 0;
  try {
    const { count } = await service
      .from("sources")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);
    totalSources = count ?? 0;
  } catch {
    totalSources = 0;
  }

  let readySources = 0;
  try {
    const { count } = await service
      .from("sources")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .in("status", ["done", "failed"]);
    readySources = count ?? 0;
  } catch {
    readySources = 0;
  }

  let brandVoiceSet = false;
  try {
    const prefs = await getAgentPreferences(userId);
    brandVoiceSet = Boolean(
      prefs?.brand && (prefs.brand.tone?.trim().length > 0 || (prefs.brand.examples?.length ?? 0) > 0)
    );
  } catch {
    brandVoiceSet = false;
  }

  let strategyPlans = 0;
  try {
    const { count } = await service
      .from("v4_content_strategies")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);
    strategyPlans = count ?? 0;
  } catch {
    strategyPlans = 0;
  }

  let publishingConnected = false;
  try {
    publishingConnected = (await getConnection(userId)) !== null;
  } catch {
    publishingConnected = false;
  }

  return { readySources, totalSources, libraryDrafts, brandVoiceSet, strategyPlans, publishingConnected };
}