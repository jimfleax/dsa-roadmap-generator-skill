#!/usr/bin/env node
/**
 * validate_track.js — Track JSON Schema Validator
 *
 * Validates a generated track JSON file against the strict schema
 * required by the DSA Preparation app's Track MongoDB model.
 *
 * Usage:
 *   node scripts/validate_track.js ./my_track.json
 *
 * Output (stdout): Validation report (pass/fail per check)
 * Exit codes:
 *   0 — All checks pass
 *   1 — Validation errors found
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// ---------------------------------------------------------------------------
// Validation Rules
// ---------------------------------------------------------------------------

const VALID_DIFFICULTIES = ['Easy', 'Medium', 'Hard'];
const FORBIDDEN_FIELDS = ['_id', '__v', 'createdAt', 'updatedAt'];
const URL_PATTERN = /^https:\/\/leetcode\.com\/problems\/[a-z0-9-]+\/$/;
const SLUG_PATTERN = /^[a-z0-9-]+$/;

/**
 * @typedef {Object} ValidationError
 * @property {string} path — JSON path to the error (e.g., "problems[2].difficulty")
 * @property {string} message — Human-readable error description
 * @property {string} severity — "error" or "warning"
 */

/**
 * Validates a single problem object.
 */
function validateProblem(p, path, seenSlugs, errors) {
  // Forbidden fields in problem objects
  for (const field of FORBIDDEN_FIELDS) {
    if (field in p) {
      errors.push({
        path: `${path}.${field}`,
        message: `Forbidden field "${field}" in problem object.`,
        severity: 'error',
      });
    }
  }

  // title
  if (!p.title || typeof p.title !== 'string' || p.title.trim().length === 0) {
    errors.push({ path: `${path}.title`, message: 'Missing or empty.', severity: 'error' });
  }

  // titleSlug
  if (!p.titleSlug || typeof p.titleSlug !== 'string') {
    errors.push({ path: `${path}.titleSlug`, message: 'Missing or not a string.', severity: 'error' });
  } else if (!SLUG_PATTERN.test(p.titleSlug)) {
    errors.push({
      path: `${path}.titleSlug`,
      message: `Invalid format: "${p.titleSlug}". Must be lowercase, hyphens and digits only. No slashes, no underscores.`,
      severity: 'error',
    });
  } else {
    // Duplicate detection
    if (seenSlugs.has(p.titleSlug)) {
      errors.push({
        path: `${path}.titleSlug`,
        message: `Duplicate slug "${p.titleSlug}" (first seen at ${seenSlugs.get(p.titleSlug)}).`,
        severity: 'error',
      });
    } else {
      seenSlugs.set(p.titleSlug, path);
    }
  }

  // difficulty
  if (!p.difficulty || typeof p.difficulty !== 'string') {
    errors.push({ path: `${path}.difficulty`, message: 'Missing or not a string.', severity: 'error' });
  } else if (!VALID_DIFFICULTIES.includes(p.difficulty)) {
    errors.push({
      path: `${path}.difficulty`,
      message: `Invalid value: "${p.difficulty}". Must be exactly one of: ${VALID_DIFFICULTIES.join(', ')}`,
      severity: 'error',
    });
  }

  // url
  if (!p.url || typeof p.url !== 'string') {
    errors.push({ path: `${path}.url`, message: 'Missing or not a string.', severity: 'error' });
  } else if (!URL_PATTERN.test(p.url)) {
    errors.push({
      path: `${path}.url`,
      message: `Invalid format: "${p.url}". Must match: https://leetcode.com/problems/<slug>/`,
      severity: 'error',
    });
  }

  // Cross-field consistency: url <-> titleSlug
  if (p.titleSlug && p.url) {
    const expectedUrl = `https://leetcode.com/problems/${p.titleSlug}/`;
    if (p.url !== expectedUrl) {
      errors.push({
        path: `${path}`,
        message: `URL/slug mismatch. titleSlug="${p.titleSlug}" expects url="${expectedUrl}" but got url="${p.url}".`,
        severity: 'error',
      });
    }
  }
}

/**
 * Validates a parsed track object against the schema.
 *
 * @param {object} track — The parsed JSON object
 * @returns {ValidationError[]} Array of errors (empty = valid)
 */
function validateTrack(track) {
  const errors = [];
  const seenSlugs = new Map(); // slug -> path for duplicate detection

  // --- Forbidden fields at top level ---
  for (const field of FORBIDDEN_FIELDS) {
    if (field in track) {
      errors.push({
        path: field,
        message: `Forbidden field "${field}" found. This is auto-managed by MongoDB/Mongoose and must NOT be included.`,
        severity: 'error',
      });
    }
  }

  // --- title ---
  if (!track.title || typeof track.title !== 'string') {
    errors.push({ path: 'title', message: 'Missing or invalid. Must be a non-empty string.', severity: 'error' });
  } else if (track.title.trim().length === 0) {
    errors.push({ path: 'title', message: 'Must not be empty or whitespace-only.', severity: 'error' });
  }

  // --- description ---
  if (!track.description || typeof track.description !== 'string') {
    errors.push({ path: 'description', message: 'Missing or invalid. Must be a non-empty string.', severity: 'error' });
  } else if (track.description.trim().length === 0) {
    errors.push({ path: 'description', message: 'Must not be empty or whitespace-only.', severity: 'error' });
  }

  // --- Check if problems OR parts exist ---
  const hasProblems = Array.isArray(track.problems) && track.problems.length > 0;
  const hasParts = Array.isArray(track.parts) && track.parts.length > 0;

  if (!hasProblems && !hasParts) {
    errors.push({ 
      path: 'track', 
      message: 'Track must contain either a non-empty "problems" array or a non-empty "parts" array.', 
      severity: 'error' 
    });
    return errors;
  }

  // --- problems array validation ---
  if (track.problems) {
    if (!Array.isArray(track.problems)) {
      errors.push({ path: 'problems', message: 'Must be an array if present.', severity: 'error' });
    } else {
      track.problems.forEach((p, i) => validateProblem(p, `problems[${i}]`, seenSlugs, errors));
    }
  }

  // --- parts array validation ---
  if (track.parts) {
    if (!Array.isArray(track.parts)) {
      errors.push({ path: 'parts', message: 'Must be an array if present.', severity: 'error' });
    } else {
      track.parts.forEach((part, i) => {
        const prefix = `parts[${i}]`;
        
        if (!part.title || typeof part.title !== 'string' || part.title.trim().length === 0) {
          errors.push({ path: `${prefix}.title`, message: 'Missing or empty part title.', severity: 'error' });
        }

        if (part.description !== undefined && (typeof part.description !== 'string' || part.description.trim().length === 0)) {
          errors.push({ path: `${prefix}.description`, message: 'Part description must be a non-empty string if provided.', severity: 'error' });
        }

        if (!Array.isArray(part.problems) || part.problems.length === 0) {
          errors.push({ path: `${prefix}.problems`, message: 'Part must contain a non-empty "problems" array.', severity: 'error' });
        } else {
          part.problems.forEach((p, j) => validateProblem(p, `${prefix}.problems[${j}]`, seenSlugs, errors));
        }
      });
    }
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Report Formatting
// ---------------------------------------------------------------------------

function formatReport(errors, totalProblems) {
  const lines = [];
  lines.push('╔══════════════════════════════════════════════════════════════╗');
  lines.push('║           DSA TRACK VALIDATION REPORT                      ║');
  lines.push('╚══════════════════════════════════════════════════════════════╝');
  lines.push('');

  if (errors.length === 0) {
    lines.push(`  ✅ ALL CHECKS PASSED`);
    lines.push(`  📊 Total problems validated: ${totalProblems}`);
    lines.push(`  🟢 Status: READY FOR DATABASE INSERTION`);
  } else {
    lines.push(`  ❌ VALIDATION FAILED — ${errors.length} error(s) found`);
    lines.push(`  📊 Total problems in file: ${totalProblems}`);
    lines.push('');
    lines.push('  ERRORS:');
    lines.push('  ─────────────────────────────────────────────');

    for (const err of errors) {
      const icon = err.severity === 'error' ? '❌' : '⚠️';
      lines.push(`  ${icon} [${err.path}] ${err.message}`);
    }

    lines.push('');
    lines.push('  🔴 Status: FIX ERRORS BEFORE INSERTION');
  }

  lines.push('');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const filePath = process.argv[2];

  if (!filePath) {
    console.error('Usage: node scripts/validate_track.js <track-json-file>');
    console.error('  Example: node scripts/validate_track.js ./my_track.json');
    process.exit(1);
  }

  const fullPath = resolve(filePath);

  // Step 1: Read and parse
  let raw;
  try {
    raw = readFileSync(fullPath, 'utf-8');
  } catch (err) {
    console.error(`FILE ERROR: Cannot read "${fullPath}": ${err.message}`);
    process.exit(1);
  }

  let track;
  try {
    track = JSON.parse(raw);
  } catch (err) {
    console.error(`JSON PARSE ERROR: ${err.message}`);
    console.error('The file must contain valid JSON.');
    process.exit(1);
  }

  // Step 2: Validate
  const errors = validateTrack(track);
  
  // Calculate total problems
  let totalProblems = (Array.isArray(track.problems) ? track.problems.length : 0);
  if (Array.isArray(track.parts)) {
    track.parts.forEach(part => {
      if (Array.isArray(part.problems)) {
        totalProblems += part.problems.length;
      }
    });
  }

  // Step 3: Report
  const report = formatReport(errors, totalProblems);
  process.stdout.write(report + '\n');

  // Step 4: Exit
  process.exit(errors.length > 0 ? 1 : 0);
}

main();
