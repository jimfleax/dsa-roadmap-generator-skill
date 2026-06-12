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

- [ ] 1. **Gather inputs** — User provides: track title, description, optional order number, and a source of problem URLs.
- [ ] 2. **Determine Structure** — Ask: "Should this be a standalone track or a partitioned track with milestones (sub-tracks)?"
- [ ] 3. **Validate inputs** — Run the Pre-Flight Checklist (see below)
- [ ] 4. **Run batch fetch**:
    - For flat tracks: `node scripts/fetch_batch.js ./urls.md > problems.json`
    - For partitioned tracks: `node scripts/fetch_batch.js ./urls.md --parts > parts.json`
- [ ] 5. **Check for failures** — If `_failures.json` exists, report to user for resolution.
- [ ] 6. **Assemble track** — Wrap the problems array OR parts array with track metadata.
- [ ] 7. **Validate** — `node scripts/validate_track.js ./track.json`
- [ ] 8. **Post to Database (Mandatory Non-Interactive)** — Run `node scripts/manage_tracks.js --import track.json --yes`.
- [ ] 9. **Deliver** — Present the final JSON and confirmation to the user.
---

## 🤖 Mandatory Non-Interactive Database Operations — AGENT ONLY

> To ensure autonomous operation without blocking for user input, agents MUST use these non-interactive flags for ALL database modifications and data retrievals.

1. **Listing Tracks:** Use `node scripts/manage_tracks.js --list`.
2. **Importing/Posting Tracks:** ALWAYS use `node scripts/manage_tracks.js --import <file.json> --yes`. Never run the script without arguments to use the interactive menu.
3. **Deleting Tracks:** ALWAYS use `node scripts/manage_tracks.js --delete "<title>" --yes`.
4. **Downloading Tracks:** ALWAYS use `node scripts/manage_tracks.js --download "<title>" [--output <file.json>] [--dir <path>]`. Use `"ALL"` as the title to download the entire database.
5. **Cleanup/GC:** ALWAYS use `node scripts/manage_tracks.js --cleanup-tests --yes`.
6. **Audit/Health:** Use `node scripts/db_audit.js` for quick health checks.
7. **Export:** Use `node scripts/db_bulk_export.js` for backups.

---

## Workflow
...
### Text-to-Track Auto-Ingestion (Text Links to DB)

- [ ] 1. **Gather inputs** — Ask for track `title`, `description`, and a raw text block/file.
- [ ] 2. **Detect Hierarchy** — Look for headers (e.g., `## Part 1`) in the text. If found, suggest a partitioned track.
- [ ] 3. **Batch Fetch** — Run `fetch_batch.js --parts` if hierarchy is detected or requested.
- [ ] 4. **Assemble & Validate** — Create a valid `track.json` and run `validate_track.js`.
- [ ] 5. **Post to Database (Mandatory Non-Interactive)** — Run `node scripts/manage_tracks.js --import track.json --yes`.

### 🧹 Garbage Collection (Cleanup Tests)

Agents and users often create "test" tracks during verification. Use the cleanup command to safely remove them.

- **Command:** `node scripts/manage_tracks.js --cleanup-tests`
- **Safety Protocol (Two-Factor):** To prevent accidental deletion of genuine data, the cleanup script ONLY targets tracks that meet BOTH criteria:
    1.  **Title Prefix:** Starts exactly with `[TEST] ` (e.g., `[TEST] Idempotency Check`).
    2.  **Description Marker:** Explicitly states its testing purpose (e.g., `This is a test track created to verify...`).
- **Confirmation:** It lists all verified matches before deleting. Use `--yes` to bypass confirmation.
- **Agent Workflow:** After verifying a new feature with a test track, always run `node scripts/manage_tracks.js --cleanup-tests --yes` to keep the database clean.

### 🔄 Idempotent Operations & Anti-Duplication

To prevent data duplication during batch processes or network failures, the `manage_tracks.js --import` command is **strictly idempotent**.

- **Upsert Logic:** The script uses the track `title` as a unique key. If a track with the same title already exists, it will be **updated** instead of a new one being created.
- **Safety Rule:** If a database connection times out or fails mid-batch, it is **safe and recommended** to retry the entire import command. No duplicate tracks will be created.

---

## Intelligent Hierarchy Inference

When provided with a structured document (Markdown/PDF/Text), the agent should:
1. **Identify Groupings:** Headers (`#`, `##`, `###`) or bolded labels often indicate milestones.
2. **Map URLs:** Group LeetCode URLs under their nearest preceding header.
3. **Infer Descriptions:** If text follows a header before the first URL, use it as the `description` for that `part`.
4. **Tool Use:** Always use `fetch_batch.js --parts` to automate this grouping.

---

## Pre-Flight Checklist

Before generating ANY output, verify ALL of the following. If any check fails, **STOP and prompt the user**.

| # | Check | Action if Missing |
|---|-------|-------------------|
| 1 | Track `title` is provided | Ask: "What should this track be called?" |
| 2 | Track `description` is provided | Ask: "Provide a short description for this track." |
| 3 | Track `order` (optional) | Optional. Will be auto-assigned if missing. |
| 4 | Structure preference | Ask: "Standalone or with milestones (sub-tracks)?" |
| 5 | At least 1 problem URL is provided | Ask: "Please provide the LeetCode problem URLs." |
| 6 | Node.js 18+ is available | Run: `node --version` to confirm |

---

## Schema Definition

### Top-Level Track Document

```json
{
  "title": "string — required",
  "description": "string — required",
  "order": "integer — optional",
  "problems": "array — optional (flat list)",
  "parts": "array — optional (hierarchical list)"
}
```

*Note: A track must have either `problems` or `parts` defined.*

### Track Part (Milestone)

```json
{
  "title": "string — required",
  "description": "string — optional",
  "problems": "array — required (at least 1)"
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
node scripts/fetch_batch.js <input-file> [--delay <ms>] [--retries <n>] [--parts] > output.json
```

**Input:** Path to any file containing LeetCode URLs.
**Output (stdout):** JSON array of problems OR JSON array of parts (if `--parts` is used).
**Options:**
- `--delay <ms>` — Delay between requests (default: 200).
- `--retries <n>` — Max retries per problem (default: 3).
- `--parts` — **New:** Intelligent grouping by Markdown headers.
**Exit codes:** `0` success, `1` bad args, `2` partial failures.

### `validate_track.js` — Schema Validator

```bash
node scripts/validate_track.js <track-json-file>
```

**Input:** Path to a complete track JSON file
**Output (stdout):** Formatted validation report
**Checks:** All schema fields, cross-field consistency, duplicates, forbidden fields
**Exit codes:** `0` all valid, `1` errors found

### `db_audit.js` — Database Health Audit

```bash
node scripts/db_audit.js
```

**Output:** Table of all tracks in DB, total count, and duplication status.
**Use case:** Quick overview of the database state and health.

### `db_deduplicate.js` — Redundancy Removal

```bash
node scripts/db_deduplicate.js
```

**Action:** Safely deletes exact duplicates (same title + problems) from the DB.
**Use case:** Cleaning up after transient network failures or accidental double-imports.

### `db_bulk_export.js` — Bulk JSON Backup

```bash
node scripts/db_bulk_export.js
```

**Action:** Exports the entire database to timestamped JSON files in `backups/`.
**Use case:** Non-interactive automated backups or migrations.

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
