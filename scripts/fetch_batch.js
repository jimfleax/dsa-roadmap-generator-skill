#!/usr/bin/env node
/**
 * fetch_batch.js — Batch LeetCode Problem Metadata Fetcher
 *
 * Extracts LeetCode URLs from any text/markdown file, deduplicates them,
 * fetches metadata for each via the public GraphQL API, and outputs
 * a JSON array of problem objects to stdout.
 *
 * Usage:
 *   node scripts/fetch_batch.js ./input_urls.md > problems.json
 *   node scripts/fetch_batch.js ./input_urls.txt --delay 300
 *
 * Options:
 *   --delay <ms>   Delay between requests in milliseconds (default: 200)
 *   --retries <n>  Max retries per problem (default: 3)
 *
 * Output (stdout): JSON array of { title, titleSlug, difficulty, url }
 * Progress (stderr): Fetch progress, retry messages, failure summary
 * Side effect: Writes _failures.json if any problems fail
 *
 * Exit codes:
 *   0 — All problems fetched successfully
 *   1 — Invalid arguments or file not found
 *   2 — Partial success (some problems failed — see _failures.json)
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LEETCODE_GRAPHQL_URL = 'https://leetcode.com/graphql';

const USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const GRAPHQL_QUERY = `
  query questionData($titleSlug: String!) {
    question(titleSlug: $titleSlug) {
      title
      titleSlug
      difficulty
    }
  }
`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function logStderr(msg) {
  process.stderr.write(`[fetch_batch] ${msg}\n`);
}

/**
 * Extracts all unique LeetCode problem slugs from arbitrary text.
 * Handles markdown tables, plain URLs, mixed prose, etc.
 *
 * @param {string} text — Raw file content
 * @returns {string[]} Ordered, deduplicated array of slugs
 */
function extractSlugs(text) {
  const regex = /https?:\/\/leetcode\.com\/problems\/([a-z0-9-]+)/gi;
  const seen = new Set();
  const slugs = [];
  let match;

  while ((match = regex.exec(text)) !== null) {
    const slug = match[1].toLowerCase();
    if (!seen.has(slug)) {
      seen.add(slug);
      slugs.push(slug);
    }
  }

  return slugs;
}

/**
 * Fetches problem metadata with retry logic.
 *
 * @param {string} slug
 * @param {number} maxRetries
 * @returns {Promise<{title: string, titleSlug: string, difficulty: string} | null>}
 */
async function fetchProblemInfo(slug, maxRetries = 3) {
  let lastError;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(LEETCODE_GRAPHQL_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': USER_AGENT,
        },
        body: JSON.stringify({
          operationName: 'questionData',
          variables: { titleSlug: slug },
          query: GRAPHQL_QUERY,
        }),
      });

      if (response.status === 429) {
        const wait = 2000 * Math.pow(2, attempt);
        logStderr(`  Rate limited on "${slug}". Waiting ${wait}ms...`);
        await sleep(wait);
        continue;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (data.errors) {
        throw new Error(`GraphQL: ${JSON.stringify(data.errors)}`);
      }

      if (!data.data?.question) {
        return null;
      }

      return data.data.question;
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries - 1) {
        const wait = 500 * Math.pow(2, attempt);
        logStderr(`  Retry ${attempt + 1}/${maxRetries} for "${slug}": ${err.message}`);
        await sleep(wait);
      }
    }
  }

  logStderr(`  FAILED "${slug}" after ${maxRetries} attempts: ${lastError?.message}`);
  return null;
}

// ---------------------------------------------------------------------------
// Argument Parsing
// ---------------------------------------------------------------------------

function parseArgs() {
  const args = process.argv.slice(2);
  let filePath = null;
  let delay = 200;
  let retries = 3;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--delay' && args[i + 1]) {
      delay = parseInt(args[i + 1], 10);
      if (isNaN(delay) || delay < 0) {
        logStderr('ERROR: --delay must be a non-negative integer.');
        process.exit(1);
      }
      i++;
    } else if (args[i] === '--retries' && args[i + 1]) {
      retries = parseInt(args[i + 1], 10);
      if (isNaN(retries) || retries < 1) {
        logStderr('ERROR: --retries must be a positive integer.');
        process.exit(1);
      }
      i++;
    } else if (!filePath) {
      filePath = args[i];
    } else {
      logStderr(`WARNING: Ignoring unknown argument "${args[i]}".`);
    }
  }

  if (!filePath) {
    logStderr('Usage: node scripts/fetch_batch.js <input-file> [--delay <ms>] [--retries <n>]');
    logStderr('  Example: node scripts/fetch_batch.js ./urls.md > problems.json');
    process.exit(1);
  }

  return { filePath: resolve(filePath), delay, retries };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const { filePath, delay, retries } = parseArgs();

  // Step 1: Read input file
  let content;
  try {
    content = readFileSync(filePath, 'utf-8');
  } catch (err) {
    logStderr(`FILE ERROR: Cannot read "${filePath}": ${err.message}`);
    process.exit(1);
  }

  // Step 2: Extract slugs
  const slugs = extractSlugs(content);

  if (slugs.length === 0) {
    logStderr('No LeetCode URLs found in the input file.');
    logStderr('Expected URLs like: https://leetcode.com/problems/two-sum/');
    process.exit(1);
  }

  logStderr(`Found ${slugs.length} unique LeetCode problems. Starting fetch...\n`);

  // Step 3: Fetch all
  const problems = [];
  const failures = [];

  for (let i = 0; i < slugs.length; i++) {
    const slug = slugs[i];
    logStderr(`Fetching ${i + 1}/${slugs.length}: ${slug}`);

    const info = await fetchProblemInfo(slug, retries);

    if (info) {
      problems.push({
        title: info.title,
        titleSlug: info.titleSlug,
        difficulty: info.difficulty,
        url: `https://leetcode.com/problems/${info.titleSlug}/`,
      });
    } else {
      failures.push({ slug, reason: 'Not found or fetch failed' });
    }

    // Rate-limit delay (skip on last item)
    if (i < slugs.length - 1) {
      await sleep(delay);
    }
  }

  // Step 4: Output results
  logStderr('');
  logStderr(`--- SUMMARY ---`);
  logStderr(`Total unique slugs: ${slugs.length}`);
  logStderr(`Successfully fetched: ${problems.length}`);
  logStderr(`Failed: ${failures.length}`);

  if (failures.length > 0) {
    const failPath = resolve(dirname(filePath), '_failures.json');
    writeFileSync(failPath, JSON.stringify(failures, null, 2));
    logStderr(`Failed slugs written to: ${failPath}`);
  }

  // Write the problems array to stdout
  process.stdout.write(JSON.stringify(problems, null, 2) + '\n');

  // Exit with code 2 if there were partial failures
  if (failures.length > 0) {
    process.exit(2);
  }
}

main();
