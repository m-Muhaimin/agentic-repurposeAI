#!/usr/bin/env node
/**
 * Brand regression test — VervAI Phase 6 migration.
 * 
 * Scans the repo for legacy branding ("RepurposeAI", "Repurpose AI",
 * "repurpose-ai", "repurpose_ai", "repurposeAI") and classifies each hit
 * as ALLOWED (historical migration, compat identifier, docs explaining
 * legacy) or NOT_ALLOWED (visible UI, page titles, user-facing copy,
 * current brand metadata).
 *
 * Exits 0 if no unexpected hits; exits 1 if unexpected hits found.
 */

import { execFileSync } from "node:child_process";
import { relative } from "node:path";

// Directories to skip while scanning. We pass these to rg as --glob excludes
// (avoiding shell-specific quoting entirely) via execFileSync's args array.
const IGNORE_GLOBS = [
  "!node_modules/**",
  "!.next/**",
  "!.turbo/**",
  "!dist/**",
  "!.git/**"
];

const REPO_ROOT = process.env.REPO_ROOT ?? process.cwd();

// Patterns that are OK to contain legacy branding
const ALLOWED_CONTEXT_PATTERNS = [
  // Migration/SQL files can reference old names
  /migrations?\//,
  /\.sql$/,
  // Docs explaining the migration
  /docs\/VERVAI_BRAND_MIGRATION/,
  /docs\/AGENTIC_ROADMAP/,
  /docs\/IMPLEMENTATION_MAP/,
  /docs\/ROADMAP/,
  // Historical audit docs — records of a prior state, not current branding
  /docs\/agentic-v2-audit/,
  /docs\/production-audit/,
  /docs\/UX_AUDIT/,
  /docs\/legal-review/,
  // Test files
  /\.test\./,
  /__tests__/,
  // package name field (compat) — package.json AND its lockfile
  /package\.json/,
  /package-lock\.json/,
  // The checkers themselves must contain the patterns they look for
  /scripts\/brand-check\.mjs/,
  /scripts\/check-brand\.(?:mjs|ts)/,
  // Legal pages + comms domains mention providers / contact addresses
  /legal\//,
  /support@repurpose-ai\.app/,
  // Comments explaining legacy
  /^\s*\/\//,
  /^\s*\*/,
  /compat/,
  /migration/i,
  /historical/i,
  /legacy/i,
  /deprecat/i,
  // Infra/compat identifiers that are deliberately NOT renamed per brand rules:
  // the Vercel project id / deployment URLs and the repo-level AGENTS.md notes.
  /vercel link --scope/,
  /\.vercel\.app/,
  /project `repurpose-ai`/,
];

function isAllowedContext(filePath, lineContent) {
  // Normalize to forward slashes so every pattern below works on Windows paths.
  const relativePath = relative(REPO_ROOT, filePath).split("\\").join("/");

  // package.json name
  if (/package(?:-lock)?\.json$/.test(relativePath) && lineContent.includes('"name"')) {
    return true;
  }

  // The checkers themselves must contain the patterns they look for.
  if (/^scripts\/(?:brand-check\.mjs|check-brand\.(?:mjs|ts))$/.test(relativePath)) {
    return true;
  }

  // Check file path patterns
  for (const pattern of ALLOWED_CONTEXT_PATTERNS) {
    if (pattern.test(relativePath) || pattern.test(lineContent)) {
      return true;
    }
  }
  
  // Legal pages
  if (relativePath.includes('legal/')) {
    return true;
  }
  
  // Migration files
  if (relativePath.match(/migrations?\//) || filePath.match(/\.sql$/)) {
    return true;
  }
  
  // Docs files — check if line is in a context that explains legacy naming
  const docsMatch = relativePath.match(/docs\/(AGENTIC_ROADMAP|IMPLEMENTATION_MAP|ROADMAP|VERVAI_BRAND_MIGRATION)/);
  if (docsMatch) {
    // If the line is in a docs section that explicitly discusses legacy/rename, allow it
    if (lineContent.match(/RepurposeAI|Repurpose AI/) && 
        !lineContent.match(/VervAI/) &&
        !lineContent.match(/^\s*#/)) {  // Not a heading
      return true;  // Docs explaining legacy naming
    }
  }
  
  return false;
}

function classifyHit(filePath, lineNum, lineContent) {
  const relativePath = relative(REPO_ROOT, filePath);
  
  // UI code (.tsx, .ts) that's not test files
  const isUI = /\.tsx$/.test(filePath) || /\.ts$/.test(filePath);
  const isTest = /\.test\./.test(filePath) || filePath.match(/__tests__/);
  const isMetadata = /page\.tsx$/.test(filePath) && 
                     (lineContent.match(/title|description|H1|H2|<title>|<meta/i) || 
                      lineContent.match(/PageHeader|CardHeader/));
  
  // Always flag user-facing UI copy and metadata
  if (isUI && !isTest) {
    if (isMetadata || lineContent.match(/text|label|placeholder|button|title|description|heading/i)) {
      return { allowed: false, reason: 'user-facing UI copy or metadata' };
    }
  }
  
  // README.md — product-facing
  if (filePath.endsWith('README.md')) {
    return { allowed: false, reason: 'README product-facing text' };
  }
  
  // If it's in an allowed context, permit it
  if (isAllowedContext(filePath, lineContent)) {
    return { allowed: true, reason: 'historical migration / compat identifier / docs explaining legacy' };
  }
  
  // Default: if it contains the legacy product name, flag it
  if (lineContent.match(/RepurposeAI|Repurpose AI|repurpose-ai|repurpose_ai|repurposeAI/i)) {
    return { allowed: false, reason: 'legacy branding in non-whitelisted context' };
  }
  
  return { allowed: true, reason: 'contextual match, not product branding' };
}

function main() {
  const legacyPatterns = [
    'RepurposeAI',
    'Repurpose AI', 
    'repurpose-ai',
    'repurpose_ai',
    'repurposeAI',
  ];
  
  const allHits = [];
  
  for (const pattern of legacyPatterns) {
    try {
      const args = [
        "-n",
        "--no-heading",
        "--color",
        "never",
        "--max-count",
        "500",
        ...IGNORE_GLOBS.flatMap((g) => ["-g", g]),
        pattern,
        "."
      ];
      const output = execFileSync("rg", args, { cwd: REPO_ROOT, encoding: "utf-8" });
      
      const lines = output.trim().split('\n').filter(l => l.trim());
      for (const line of lines) {
        const colonIdx = line.indexOf(':');
        if (colonIdx === -1) continue;
        
        const filePath = line.substring(0, colonIdx);
        const lineNum = line.substring(colonIdx + 1, line.indexOf(':', colonIdx + 1));
        const contentStart = line.indexOf(':', colonIdx + 1) + 1;
        const lineContent = line.substring(contentStart);
        
        allHits.push({ filePath, lineNum, lineContent });
      }
    } catch (e) {
      // rg returns non-zero when no matches — ignore
    }
  }
  
  console.log(`\n=== VervAI Brand Regression Test ===`);
  console.log(`Scanning: ${REPO_ROOT}`);
  console.log(`Legacy patterns: ${legacyPatterns.join(', ')}`);
  console.log(`Total hits found: ${allHits.length}\n`);
  
  const allowed = [];
  const notAllowed = [];
  
  for (const hit of allHits) {
    const classification = classifyHit(hit.filePath, hit.lineNum, hit.lineContent);
    if (classification.allowed) {
      allowed.push({ ...hit, reason: classification.reason });
    } else {
      notAllowed.push({ ...hit, reason: classification.reason });
    }
  }
  
  if (allowed.length > 0) {
    console.log('ALLOWED (historical/compat/docs):');
    for (const hit of allowed) {
      console.log(`  ${hit.filePath}:${hit.lineNum}`);
      if (hit.lineContent.trim()) {
        console.log(`    "${hit.lineContent.trim().substring(0, 100)}"`);
      }
      console.log(`    → ${hit.reason}\n`);
    }
  }
  
  if (notAllowed.length > 0) {
    console.log('NOT ALLOWED (should be VervAI):');
    for (const hit of notAllowed) {
      console.log(`  ⚠️  ${hit.filePath}:${hit.lineNum}`);
      if (hit.lineContent.trim()) {
        console.log(`    "${hit.lineContent.trim().substring(0, 100)}"`);
      }
      console.log(`    → ${hit.reason}\n`);
    }
    console.log(`❌ Found ${notAllowed.length} unexpected legacy-branding occurrence(s).`);
    console.log(`   These should use "VervAI" instead of legacy branding.\n`);
    process.exit(1);
  }
  
  console.log('✅ No unexpected legacy branding found. Brand migration looks clean.');
  process.exit(0);
}

main();
