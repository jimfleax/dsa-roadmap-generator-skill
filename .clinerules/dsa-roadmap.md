# DSA Roadmap Track Generator — Cline Rules

## Purpose
This project generates database-ready DSA roadmap track JSON by fetching real metadata from LeetCode's GraphQL API. Read `SKILL.md` for full instructions.

## CRITICAL: Anti-Hallucination
- NEVER guess problem titles or difficulties — use the scripts
- NEVER include `_id`, `__v`, `createdAt`, `updatedAt` in output
- ALWAYS validate with `node scripts/validate_track.js` before delivering

## Scripts (Node 18+, zero deps)
- `node scripts/fetch_problem.js <url-or-slug>` — Single lookup → JSON to stdout
- `node scripts/fetch_batch.js <file> > out.json` — Batch fetch → JSON array to stdout
- `node scripts/validate_track.js <file>` — Validate → exit 0 = pass, exit 1 = fail

## Schema
- Track: `{ title, description, order (int), problems[] }`
- Problem: `{ title, titleSlug, difficulty ("Easy"|"Medium"|"Hard"), url }`
- Invariant: `url === "https://leetcode.com/problems/" + titleSlug + "/"`
- Formal schema: `resources/track_schema.json`

## Workflow
1. Collect track metadata + problem URLs from user
2. Run fetch scripts to resolve titles/difficulties programmatically
3. Assemble the track JSON
4. Validate with `validate_track.js` — MUST pass before delivery
5. If validation fails, fix errors and re-validate
