#!/usr/bin/env node
/**
 * fetch_problem.js — Single LeetCode Problem Metadata Fetcher
 *
 * Fetches the exact title and difficulty for a single LeetCode problem
 * using the public GraphQL API. Zero external dependencies.
 *
 * Usage:
 *   node scripts/fetch_problem.js "https://leetcode.com/problems/two-sum/"
 *   node scripts/fetch_problem.js two-sum
 *
 * Output (stdout): JSON object with title, titleSlug, difficulty, url
 * Errors (stderr): Human-readable error messages
 *
 * Exit codes:
 *   0 — Success
 *   1 — Invalid input (bad URL/slug format)
 *   2 — Network error (fetch failed, timeout, etc.)
 *   3 — Problem not found on LeetCode
 */

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

const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 500;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extracts a titleSlug from a LeetCode URL or validates a bare slug.
 *
 * Accepted inputs:
 *   "https://leetcode.com/problems/two-sum/"
 *   "https://leetcode.com/problems/two-sum/description/"
 *   "two-sum"
 *
 * @param {string} input — URL or slug
 * @returns {string} The normalized titleSlug
 * @throws {Error} If the input is not a valid URL or slug
 */
function extractSlug(input) {
  const trimmed = input.trim();

  // Case 1: Full URL
  if (trimmed.startsWith('http')) {
    const match = trimmed.match(/leetcode\.com\/problems\/([a-z0-9-]+)/);
    if (!match) {
      throw new Error(
        `Invalid LeetCode URL: "${trimmed}". Expected format: https://leetcode.com/problems/<slug>/`
      );
    }
    return match[1];
  }

  // Case 2: Bare slug — must be lowercase, hyphens, digits only
  if (/^[a-z0-9-]+$/.test(trimmed)) {
    return trimmed;
  }

  throw new Error(
    `Invalid input: "${trimmed}". Provide a LeetCode URL or a lowercase hyphen-separated slug.`
  );
}

/**
 * Fetches problem metadata from LeetCode's GraphQL API with retry logic.
 *
 * @param {string} slug — The titleSlug to look up
 * @returns {Promise<{title: string, titleSlug: string, difficulty: string}>}
 */
async function fetchProblemInfo(slug) {
  let lastError;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
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
        // Rate limited — wait longer
        const wait = BASE_BACKOFF_MS * Math.pow(2, attempt + 2);
        logStderr(`Rate limited. Waiting ${wait}ms before retry ${attempt + 1}/${MAX_RETRIES}...`);
        await sleep(wait);
        continue;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.errors) {
        throw new Error(`GraphQL error: ${JSON.stringify(data.errors)}`);
      }

      if (!data.data?.question) {
        return null; // Problem not found
      }

      return data.data.question;
    } catch (err) {
      lastError = err;
      if (attempt < MAX_RETRIES - 1) {
        const wait = BASE_BACKOFF_MS * Math.pow(2, attempt);
        logStderr(`Attempt ${attempt + 1} failed: ${err.message}. Retrying in ${wait}ms...`);
        await sleep(wait);
      }
    }
  }

  throw lastError;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function logStderr(msg) {
  process.stderr.write(`[fetch_problem] ${msg}\n`);
}

/**
 * Builds the canonical LeetCode URL from a slug.
 * @param {string} slug
 * @returns {string}
 */
function buildCanonicalUrl(slug) {
  return `https://leetcode.com/problems/${slug}/`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const input = process.argv[2];

  if (!input) {
    logStderr('Usage: node scripts/fetch_problem.js <leetcode-url-or-slug>');
    logStderr('  Example: node scripts/fetch_problem.js two-sum');
    logStderr('  Example: node scripts/fetch_problem.js "https://leetcode.com/problems/two-sum/"');
    process.exit(1);
  }

  // Step 1: Extract slug
  let slug;
  try {
    slug = extractSlug(input);
  } catch (err) {
    logStderr(`INPUT ERROR: ${err.message}`);
    process.exit(1);
  }

  // Step 2: Fetch from LeetCode
  let info;
  try {
    info = await fetchProblemInfo(slug);
  } catch (err) {
    logStderr(`NETWORK ERROR: ${err.message}`);
    process.exit(2);
  }

  // Step 3: Handle not found
  if (!info) {
    logStderr(`NOT FOUND: No LeetCode problem exists with slug "${slug}".`);
    process.exit(3);
  }

  // Step 4: Output structured JSON
  const result = {
    title: info.title,
    titleSlug: info.titleSlug,
    difficulty: info.difficulty,
    url: buildCanonicalUrl(info.titleSlug),
  };

  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}

main();
