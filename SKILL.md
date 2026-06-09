---
name: generating-dsa-roadmaps
description: >-
  Generates insertion-ready DSA roadmap track JSON documents with LeetCode
  metadata. Use when the user says "create a track", "generate roadmap",
  "DSA track JSON", "LeetCode track data", "roadmap problems", "seed tracks",
  "batch fetch LeetCode", or needs to compile LeetCode problem links into a
  validated Track document for MongoDB insertion.
---

# DSA Roadmap Track Generator

Generate strict, schema-compliant JSON documents for DSA roadmap tracks by
fetching real metadata from LeetCode's public GraphQL API. Zero guesswork,
zero hallucination, zero token waste on metadata resolution.

## When to Use This Skill

- User wants to create a new DSA roadmap track (e.g., "Blind 75", "NeetCode 150", a custom list)
- User provides LeetCode problem URLs and wants a formatted JSON document
- User asks to "generate track JSON", "create roadmap data", or "seed tracks"
- User has a markdown/text file of LeetCode URLs and wants batch metadata resolution
- User needs to validate an existing track JSON file before database insertion

---

## ⛔ Anti-Hallucination Protocol — MANDATORY

> These rules are NON-NEGOTIABLE. Violation produces invalid data.

1. **NEVER guess, invent, or fabricate LeetCode problem titles.** Titles must come from the LeetCode API via the provided scripts, or be explicitly supplied by the user.
2. **NEVER guess difficulty ratings.** Use the scripts to fetch them, or require the user to provide them.
3. **NEVER fabricate URLs or slugs.** Extract slugs from user-provided URLs only.
4. **NEVER include database-managed fields** (`_id`, `__v`, `createdAt`, `updatedAt`).
5. **NEVER output partial documents.** Every required field must be present and valid.
6. **When in doubt, run the script.** One `node` command costs ~200ms. Hallucinating costs correctness.

---

## Workflow

### Single Problem (Quick Lookup)

- [ ] 1. User provides a LeetCode URL or slug
- [ ] 2. Run `node scripts/fetch_problem.js <url-or-slug>`
- [ ] 3. Use the returned JSON object directly in the track

### Batch Generation (Full Track)

- [ ] 1. **Gather inputs** — User provides: track title, description, order number, and a source of problem URLs (markdown file, text list, or inline URLs)
- [ ] 2. **Validate inputs** — Run the Pre-Flight Checklist (see below)
- [ ] 3. **Save URLs to a file** if not already in one
- [ ] 4. **Run batch fetch** — `node scripts/fetch_batch.js ./urls.md > problems.json`
- [ ] 5. **Check for failures** — If `_failures.json` exists, report to user for resolution
- [ ] 6. **Assemble track** — Wrap the problems array with track metadata (title, description, order)
- [ ] 7. **Validate** — `node scripts/validate_track.js ./track.json`
- [ ] 8. **Fix any errors** — If validation fails, correct issues and re-validate
- [ ] 9. **Deliver** — Present the final JSON to the user

---

## Pre-Flight Checklist

Before generating ANY output, verify ALL of the following. If any check fails, **STOP and prompt the user**.

| # | Check | Action if Missing |
|---|-------|-------------------|
| 1 | Track `title` is provided | Ask: "What should this track be called?" |
| 2 | Track `description` is provided | Ask: "Provide a short description for this track." |
| 3 | Track `order` is provided (integer ≥ 0) | Ask: "What order number should this track have?" |
| 4 | At least 1 problem URL is provided | Ask: "Please provide the LeetCode problem URLs." |
| 5 | Node.js 18+ is available | Run: `node --version` to confirm |

---

## Schema Definition

### Top-Level Track Document

```json
{
  "title": "string — required, non-empty",
  "description": "string — required, non-empty",
  "order": "integer — required, >= 0",
  "problems": "array — required, min 1 item"
}
```

### Problem Object

```json
{
  "title": "string — EXACT title from LeetCode (proper casing)",
  "titleSlug": "string — lowercase, hyphens only, extracted from URL",
  "difficulty": "string — exactly 'Easy', 'Medium', or 'Hard'",
  "url": "string — https://leetcode.com/problems/<slug>/"
}
```

### Invariant Rule

```
url === "https://leetcode.com/problems/" + titleSlug + "/"
```

If this does not hold, the data is **INVALID**.

### Forbidden Fields

These are auto-managed by MongoDB/Mongoose. **NEVER include them:**
- `_id`
- `__v`
- `createdAt`
- `updatedAt`

---

## Script Reference

All scripts are in `scripts/`. Zero external dependencies. Require Node.js 18+.

### `fetch_problem.js` — Single Problem Lookup

```bash
node scripts/fetch_problem.js <url-or-slug>
```

**Input:** LeetCode URL or bare slug (e.g., `two-sum`)
**Output (stdout):** JSON object `{ title, titleSlug, difficulty, url }`
**Exit codes:** `0` success, `1` invalid input, `2` network error, `3` not found

### `fetch_batch.js` — Batch Fetch

```bash
node scripts/fetch_batch.js <input-file> [--delay <ms>] [--retries <n>] > output.json
```

**Input:** Path to any file containing LeetCode URLs (markdown, text, etc.)
**Output (stdout):** JSON array of problem objects
**Options:**
- `--delay <ms>` — Delay between requests (default: 200)
- `--retries <n>` — Max retries per problem (default: 3)
**Exit codes:** `0` all success, `1` bad args, `2` partial failures (see `_failures.json`)

### `validate_track.js` — Schema Validator

```bash
node scripts/validate_track.js <track-json-file>
```

**Input:** Path to a complete track JSON file
**Output (stdout):** Formatted validation report
**Checks:** All schema fields, cross-field consistency, duplicates, forbidden fields
**Exit codes:** `0` all valid, `1` errors found

---

## Error Handling & Feedback Loop

When something goes wrong, follow this decision tree:

| Scenario | Script Exit Code | Action |
|----------|-----------------|--------|
| Invalid URL/slug format | `fetch_problem: 1` | Fix the URL and retry |
| Network timeout | `fetch_problem: 2` | Wait 30s, retry. If persistent, check connectivity |
| Problem not found on LeetCode | `fetch_problem: 3` | Confirm slug with user. May be a premium/removed problem |
| Batch partial failure | `fetch_batch: 2` | Check `_failures.json`, resolve each slug, re-run |
| Validation errors | `validate_track: 1` | Read the report, fix each listed error, re-validate |
| Rate limited (429) | Automatic retry | Scripts handle this internally with exponential backoff |

### The Golden Rule

> **Never deliver a track that hasn't passed `validate_track.js` with exit code 0.**

---

## Common Mistakes to Reject

| Mistake | Example | Fix |
|---------|---------|-----|
| Missing trailing slash in URL | `".../two-sum"` | Add `/` |
| Wrong difficulty casing | `"easy"`, `"HARD"` | Use `"Easy"`, `"Medium"`, `"Hard"` |
| Uppercase in slug | `"Two-Sum"` | Use `"two-sum"` |
| Underscores in slug | `"two_sum"` | Use `"two-sum"` |
| URL has `/description/` suffix | `".../two-sum/description/"` | Strip to `".../two-sum/"` |
| `order` is a string | `"1"` | Use `1` (number) |
| `order` is a float | `1.5` | Use integer `1` or `2` |
| Empty problems array | `[]` | Must have ≥ 1 problem |
| Guessed/abbreviated title | `"2 Sum"` | Use the script to fetch official title |
| Extra fields included | `"tags": [...]` | Remove — not in schema |
| Database fields included | `"_id": "..."` | Remove — auto-generated |

---

## Resources

- **JSON Schema:** [`resources/track_schema.json`](./resources/track_schema.json) — Machine-readable draft-07 schema
- **Example Track:** [`resources/example_track.json`](./resources/example_track.json) — Valid 5-problem reference
- **Scripts:** [`scripts/`](./scripts/) — fetch_problem.js, fetch_batch.js, validate_track.js
