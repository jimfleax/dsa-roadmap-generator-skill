# AGENTS.md — DSA Roadmap Track Generator

> Universal agent instructions file. Compatible with Windsurf, Devin, and other agents supporting AGENTS.md.

## Purpose

This project is an **AI Agent Skill** for generating database-ready DSA roadmap track JSON documents. It fetches real metadata (title, difficulty) from LeetCode's public GraphQL API.

## Primary Instructions

Read [`SKILL.md`](./SKILL.md) for the complete workflow, schema definition, and constraints.

## Mandatory Non-Interactive Mode (CRITICAL)

To avoid blocking for user input, agents **MUST** use the following flags for database operations:
- **Importing:** `node scripts/manage_tracks.js --import <file.json> --yes`
- **Cleanup:** `node scripts/manage_tracks.js --cleanup-tests --yes`

**Never** run `manage_tracks.js` without arguments, as it will enter an interactive menu that requires manual intervention.

## Quick Reference

### Available Scripts (Node.js 18+, zero dependencies)

| Script | Purpose | Usage |
|--------|---------|-------|
| `scripts/fetch_problem.js` | Fetch metadata for a single problem | `node scripts/fetch_problem.js two-sum` |
| `scripts/fetch_batch.js` | Batch fetch with hierarchy support | `node scripts/fetch_batch.js urls.md --parts > out.json` |
| `scripts/validate_track.js` | Validate a track JSON against schema | `node scripts/validate_track.js track.json` |
| `scripts/manage_tracks.js` | Import tracks (Idempotent Upsert) | `node scripts/manage_tracks.js --import track.json --yes` |
| `scripts/manage_tracks.js` | Cleanup test tracks (Strict GC) | `node scripts/manage_tracks.js --cleanup-tests --yes` |
| `scripts/db_audit.js` | Database health & duplicate audit | `node scripts/db_audit.js` |
| `scripts/db_deduplicate.js` | Formal idempotent cleanup | `node scripts/db_deduplicate.js` |
| `scripts/db_bulk_export.js` | Non-interactive full DB backup | `node scripts/db_bulk_export.js` |

### Critical Rules

1. **Never guess titles or difficulties** — always use the fetch scripts
2. **Never include `_id`, `__v`, `createdAt`, `updatedAt`** in output
3. **Always validate** with `validate_track.js` before delivering
4. **Difficulty must be exactly** `"Easy"`, `"Medium"`, or `"Hard"`
5. **URLs must be canonical:** `https://leetcode.com/problems/<slug>/`
6. **Imports are Idempotent:** If a database connection times out, retry safely. `manage_tracks.js` will not create duplicates.
7. **Test Tracks:** Any track created for testing/verification MUST have a title starting with `[TEST] ` and a description stating: `This is a test track created to verify <purpose>`.

### Schema

See [`resources/track_schema.json`](./resources/track_schema.json) for the formal JSON Schema.
See [`resources/example_track.json`](./resources/example_track.json) for a valid reference.
