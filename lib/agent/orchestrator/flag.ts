// PURE env gate, Paddle style (lib/billing/paddle.ts:36-50). Read once per request.
export function isOrchestratorV1Enabled(): boolean {
  return process.env.VERVAI_ORCHESTRATOR_V1 === "1";
}