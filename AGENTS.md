# AGENTS.md — DSA Roadmap Track Generator

> Universal agent instructions file. Compatible with Windsurf, Devin, and other agents supporting AGENTS.md.

## Purpose

This project is an **AI Agent Skill** for generating database-ready DSA roadmap track JSON documents. It fetches real metadata (title, difficulty) from LeetCode's public GraphQL API.

## Primary Instructions

Read [`SKILL.md`](./SKILL.md) for the complete workflow, schema definition, and constraints.

## Quick Reference

### Available Scripts (Node.js 18+, zero dependencies)

| Script | Purpose | Usage |
|--------|---------|-------|
| `scripts/fetch_problem.js` | Fetch metadata for a single problem | `node scripts/fetch_problem.js two-sum` |
| `scripts/fetch_batch.js` | Batch fetch from a URL list file | `node scripts/fetch_batch.js urls.md > out.json` |
| `scripts/validate_track.js` | Validate a track JSON against schema | `node scripts/validate_track.js track.json` |
| `scripts/manage_tracks.js` | Import tracks to database directly | `node scripts/manage_tracks.js --import track.json --yes` |

### Critical Rules

1. **Never guess titles or difficulties** — always use the fetch scripts
2. **Never include `_id`, `__v`, `createdAt`, `updatedAt`** in output
3. **Always validate** with `validate_track.js` before delivering
4. **Difficulty must be exactly** `"Easy"`, `"Medium"`, or `"Hard"`
5. **URLs must be canonical:** `https://leetcode.com/problems/<slug>/`

### Schema

See [`resources/track_schema.json`](./resources/track_schema.json) for the formal JSON Schema.
See [`resources/example_track.json`](./resources/example_track.json) for a valid reference.
