#!/usr/bin/env npx tsx
/**
 * Brand regression checker for VervAI.
 *
 * Scans source files for user-facing references to the old brand
 * (RepurposeAI, Repurpose AI, repurpose-ai) while allowing:
 * - Historical migration docs/filenames
 * - Compatibility identifiers (package name, DB, API paths, env vars)
 * - Code comments explaining legacy naming
 * - Analytics event names with historical data (repurpose.*)
 *
 * Run: npx tsx scripts/check-brand.ts
 */

import { readdir, readFile } from "node:fs/promises";
import { join, extname, relative } from "node:path";

// Forbidden patterns in USER-FACING contexts
const FORBIDDEN_PATTERNS = [
  /RepurposeAI/gi,
  /\bRepurpose AI\b/gi,
  /"repurpose-ai"/gi, // product name in JSON strings
];

// Allowed locations/patterns (technical compatibility)
const ALLOWED_PATHS = [
  "package.json",
  "supabase/migrations",
  "supabase/schema",
];

const ALLOWED_FILE_EXTENSIONS = [".sql"];

// Files where "repurpose" as a verb is OK (internal code, comments)
const ALLOWED_INTERNAL_PATTERNS = [
  // API route paths
  /\/api\/repurpose/,
  // DB column/table names
  /repurpose_job/,
  // Env vars
  /REPURPOSE/,
  // Internal comments (preserve after // or /*)
  /legacy.*repurpose/i,
  /compatibility.*repurpose/i,
  /agent.*repurpose/i, // "agent intent" is a capability, not the product
];

let violations: string[] = [];
let allowedCount = 0;

async function scanDir(dir: string, depth = 0) {
  if (depth > 6) return; // Prevent runaway recursion
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!["node_modules", ".next", "public"].includes(entry.name)) {
        await scanDir(fullPath, depth + 1);
      }
    } else if (entry.isFile()) {
      const ext = extname(entry.name);
      if ([".ts", ".tsx", ".js", ".jsx", ".md"].includes(ext)) {
        await scanFile(fullPath);
      }
    }
  }
}

async function scanFile(filePath: string) {
  const relPath = relative(process.cwd(), filePath);

  // Check allowed paths
  if (ALLOWED_PATHS.some((p) => relPath.includes(p))) {
    allowedCount++;
    return;
  }

  // Check allowed extensions (migrations, etc.)
  if (ALLOWED_FILE_EXTENSIONS.includes(extname(filePath))) {
    allowedCount++;
    return;
  }

  const content = await readFile(filePath, "utf-8");
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    for (const pattern of FORBIDDEN_PATTERNS) {
      if (pattern.test(line)) {
        // Check if this line is allowed
        const isAllowed = ALLOWED_INTERNAL_PATTERNS.some((p) => p.test(line));
        if (isAllowed) {
          allowedCount++;
        } else {
          violations.push(`  ${relPath}:${i + 1}\n    ${line.trim()}`);
        }
      }
    }
  }
}

console.log("🔍 Brand regression scan for VervAI\n");
console.log("Forbidden patterns: RepurposeAI, Repurpose AI, \"repurpose-ai\" as product name\n");

await scanDir(process.cwd());

if (violations.length === 0) {
  console.log("✅ No brand violations found.");
  console.log(`   Reviewed ${allowedCount} files (allowed legacy references).`);
  process.exit(0);
}

console.log(`❌ Found ${violations.length} VIOLATION(S):\n`);
for (const v of violations) {
  console.log(v);
}

console.log("\n📝 To fix:");
console.log("  1. Replace with 'VervAI' for user-facing copy");
console.log("  2. Replace with 'Create' for actions (turning content into content)");
console.log("  3. If the reference is technical (DB column, API path, etc.), update docs/VERVAI_BRAND_MIGRATION.md with the exception reason");

process.exit(1);