# DSA Roadmap Generator Skill

This project is a specialized **AI Agent Skill** for generating and managing database-ready DSA roadmap tracks. It fetches real-time metadata (titles, difficulties) from LeetCode's public GraphQL API and ensures schema-compliant JSON outputs for MongoDB.

## Project Overview

- **Purpose:** Automate the creation of validated DSA roadmap data with 100% accurate metadata.
- **Technologies:** Node.js (>=18.0.0), MongoDB (via Mongoose).
- **Architecture:** Script-based utility library designed for both interactive use and automated agent workflows.
- **Core Principle:** **Strict Anti-Hallucination.** All metadata MUST be fetched via the provided scripts; never guessed by the agent.

## Building and Running

### Prerequisites
- Node.js 18+ (for built-in `fetch` support).
- A valid MongoDB connection URI in a `.env` file (`MONGODB_URI=...`).

### Core Commands
| Command | Description |
|---------|-------------|
| `npm run fetch <slug/url>` | Fetch metadata for a single LeetCode problem. |
| `npm run fetch:batch <input.md>` | Extract URLs from a file and fetch metadata in batch. |
| `npm run validate <track.json>` | Validate a track JSON against the strict project schema. |
| `npm run manage` | Open the interactive Track Manager CLI. |

### Database Utilities
| Script | Description |
|--------|-------------|
| `node scripts/db_audit.js` | Run a health check to find duplicates and orphans. |
| `node scripts/db_deduplicate.js` | Automatically remove redundant track entries. |
| `node scripts/db_bulk_export.js` | Backup the entire database to timestamped JSON files. |
| `node scripts/manage_tracks.js --cleanup-tests --yes` | Safe garbage collection for verified test tracks. |

## Development Conventions

### 🛡️ Safety & Reliability
- **Idempotent Imports:** The `manage_tracks.js --import` command uses **upsert logic** based on the track `title`. It is safe to retry imports if a connection fails.
- **Test Data Standards:** Tracks created for verification MUST start with the `[TEST] ` prefix in the title and include a descriptive testing purpose in the description.

### 🧩 Source Code Standards
- **ESM Modules:** The project uses native ES modules (`type: module` in `package.json`).
- **Zero Dependencies (Core):** The fetching logic uses the Node.js built-in `fetch` API to remain lean.
- **Strict Validation:** No data should be imported without first passing `scripts/validate_track.js`.

### 📂 Directory Structure
- `scripts/`: Implementation of all CLI tools and database utilities.
- `resources/`: Official JSON schema (`track_schema.json`) and valid reference examples.
- `backups/`: Location for bulk exports and safety backups created before deletions.
- `examples/`: Shell scripts demonstrating common workflows.

## AI Agent Integration
Agents should prioritize reading `SKILL.md` for the comprehensive operation manual and `AGENTS.md` for a quick-reference cheat sheet. Always utilize `scripts/db_audit.js` to verify the state of the database before and after performing batch operations.
