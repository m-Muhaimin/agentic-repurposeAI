import { LIGEND_DEFINITIONS } from "./definitions";
import { outputRegistry } from "./registry";

// Register the built-in definitions at module load (idempotent: re-registering
// the same id overwrites in place, last-wins is fine for module cache warmth).
for (const def of LIGEND_DEFINITIONS) {
  outputRegistry.register(def);
}

export { outputRegistry, OutputRegistry, scoreDefinition, validateContent } from "./registry";
export type { OutputDefinition, OutputRecommendation, OutputRequiresEvidence, ValidationResult } from "./types";
export { LIGEND_DEFINITIONS } from "./definitions";