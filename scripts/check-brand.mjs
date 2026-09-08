#!/usr/bin/env node
// @ts-check
/**
 * Brand regression checker for VervAI.
 *
 * Scans source files for user-facing references to the old brand
 * (RepurposeAI, Repurpose AI, repurpose-ai) while allowing:
 * - Historical migration docs/filenames
 * - Compatibility identifiers (package name, DB, API paths, env vars)
 * - Code comments explaining legacy naming
 * - Analytics event names with historical data (repurpose.*)
 * - This script and the brand migration doc (they reference patterns)
 *
 * Run: node scripts/check-brand.mjs
 */

import { readdir } from "node:fs/promises";
import { readFile } from "node:fs/promises";
import { join, extname, relative } from "node:path";

// Forbidden patterns in USER-FACING contexts
const FORBIDDEN_PATTERNS = [
  /RepurposeAI/gi,
  /\bRepurpose AI\b/gi,
  /"repurpose-ai"/gi,
];

// Excluded files (the brand migration doc references patterns, the script IS the checker)
const EXCLUDED_FILES = [
  "scripts/check-brand.mjs",
  "docs/VERVAI_BRAND_MIGRATION.md",
];

// Allowed locations/patterns (technical compatibility)
const ALLOWED_PATHS = [
  "package.json",
  "supabase/migrations",
  "supabase/schema",
];

const ALLOWED_FILE_EXTENSIONS = [".sql"];

const ALLOWED_INTERNAL_PATTERNS = [
  /\/api\/repurpose/,
  /repurpose_job/,
  /REPURPOSE/,
  /legacy.*repurpose/i,
  /compatibility.*repurpose/i,
  /agent.*repurpose/i,
  /repurpose.*agent/i,
];

let violations = [];
let allowedCount = 0;

async function scanDir(dir, depth = 0) {
  if (depth > 7) return;
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

async function scanFile(filePath) {
  const relPath = relative(process.cwd(), filePath);

  // Skip excluded files
  if (EXCLUDED_FILES.some((p) => relPath.includes(p))) {
    return;
  }

  if (ALLOWED_PATHS.some((p) => relPath.includes(p))) {
    allowedCount++;
    return;
  }

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
console.log("  2. Replace with 'Create' for actions");
process.exit(1);