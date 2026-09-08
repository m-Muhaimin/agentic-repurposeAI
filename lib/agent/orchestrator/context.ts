// VervAI Orchestrator v1 — context resolution.
//
// The server resolves ALL ownership (user, source, intelligence, opportunity,
// connection) — never trusting client-owned fields. This module provides the
// pure builders/validators the server uses after it has done its ownership
// lookups, plus a seam for those lookups so the policy is testable without a DB.
//
// In the real integration, ownership lookups go through Supabase RLS (the user
// client) exactly as the existing routes do; this module never opens a client
// itself.

import type { OrchestrationContext, OrchestrationMode, OrchestrationObjective } from "./types";

export interface ResolverSeam {
  sourceOwnedByUser?(userId: string, sourceId: string): Promise<boolean>;
  intelligenceOwnedByUser?(userId: string, intelligenceId: string): Promise<boolean>;
  opportunityOwnedByUser?(userId: string, opportunityId: string): Promise<boolean>;
}

// A context is valid only when it is fully server-resolved: the caller has
// asserted that every referenced entity belongs to the user. We refuse to build
// a context that still carries unresolved / non-owner references.
export interface ResolvedContextInput {
  userId: string;
  runId: string;
  objective: OrchestrationObjective;
  mode: OrchestrationMode;
  sourceIds: string[];
  intelligenceIds: string[];
  opportunityIds: string[];
  recommendationIds: string[];
  constraints: OrchestrationContext["constraints"];
  // Server-side ownership assertions (each must throw or resolve false to be
  // refused). Keys are the entity ids.
  owned: {
    sources: Record<string, boolean>;
    intelligence: Record<string, boolean>;
    opportunities: Record<string, boolean>;
  };
}

export function buildContext(input: ResolvedContextInput): OrchestrationContext | Error {
  // Every referenced entity must be asserted owned by the user.
  for (const id of input.sourceIds) {
    if (!input.owned.sources[id]) {
      return new Error(`PERMISSION_DENIED: source '${id}' is not owned by this user`);
    }
  }
  for (const id of input.intelligenceIds) {
    if (!input.owned.intelligence[id]) {
      return new Error(`PERMISSION_DENIED: intelligence '${id}' is not owned by this user`);
    }
  }
  for (const id of input.opportunityIds) {
    if (!input.owned.opportunities[id]) {
      return new Error(`PERMISSION_DENIED: opportunity '${id}' is not owned by this user`);
    }
  }

  if (input.constraints.maxOutputs < 1) {
    return new Error("INVALID_CONSTRAINTS: maxOutputs must be >= 1");
  }

  return {
    userId: input.userId,
    runId: input.runId,
    objective: input.objective,
    mode: input.mode,
    sourceIds: [...input.sourceIds],
    intelligenceIds: [...input.intelligenceIds],
    opportunityIds: [...input.opportunityIds],
    recommendationIds: [...input.recommendationIds],
    constraints: { ...input.constraints }
  };
}

/**
 * Async convenience when a ResolverSeam is available: run the ownership checks
 * then build. Throws (or returns an Error) when any referenced entity is not
 * owned — never silently trusts the client.
 */
export async function resolveContext(
  seam: ResolverSeam,
  input: Omit<ResolvedContextInput, "owned">
): Promise<OrchestrationContext | Error> {
  const owned = {
    sources: {} as Record<string, boolean>,
    intelligence: {} as Record<string, boolean>,
    opportunities: {} as Record<string, boolean>
  };

  for (const id of input.sourceIds) {
    owned.sources[id] = seam.sourceOwnedByUser
      ? await seam.sourceOwnedByUser(input.userId, id)
      : false;
  }
  for (const id of input.intelligenceIds) {
    owned.intelligence[id] = seam.intelligenceOwnedByUser
      ? await seam.intelligenceOwnedByUser(input.userId, id)
      : false;
  }
  for (const id of input.opportunityIds) {
    owned.opportunities[id] = seam.opportunityOwnedByUser
      ? await seam.opportunityOwnedByUser(input.userId, id)
      : false;
  }

  return buildContext({ ...input, owned });
}
