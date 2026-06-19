---
name: generating-dsa-roadmaps
description: Generates insertion-ready DSA roadmap track JSON documents with LeetCode metadata. Use when the user says "create a track", "generate roadmap", "DSA track JSON", "LeetCode track data", "roadmap problems", "seed tracks", "batch fetch LeetCode", or needs to compile LeetCode problem links into a validated Track document for MongoDB insertion.
---

# Generating DSA Roadmaps

## When to use this skill
- User wants to create a new DSA roadmap track (e.g., "Blind 75", "NeetCode 150", a custom list)
- User provides LeetCode problem URLs and wants a formatted JSON document
- User asks to "generate track JSON", "create roadmap data", or "seed tracks"
- User has a markdown/text file of LeetCode URLs and wants batch metadata resolution
- User needs to validate an existing track JSON file before database insertion

## Workflow
- [ ] 1. Acknowledge the request and identify the trigger.
- [ ] 2. Read the primary project skill files to load the exact procedures into your context.
- [ ] 3. Follow the procedures defined in the project's root `SKILL.md` safely.

## Instructions

The `dsa-roadmap-generator-skill` project is itself a specialized AI Agent Skill designed to be used across multiple environments. It contains its own detailed instructions and constraints at the root of the repository.

To safely execute any operations related to generating or managing DSA roadmaps, you MUST read the following files and follow their instructions exactly:

1. **Main Skill Definition**: Read [`/home/reetabratabhandari/Projects/dsa-roadmap-generator-skill/SKILL.md`](file:///home/reetabratabhandari/Projects/dsa-roadmap-generator-skill/SKILL.md) for the complete workflow, Anti-Hallucination Protocol, schema definition, and script references.
2. **Agent Cheat Sheet**: Read [`/home/reetabratabhandari/Projects/dsa-roadmap-generator-skill/AGENTS.md`](file:///home/reetabratabhandari/Projects/dsa-roadmap-generator-skill/AGENTS.md) for the mandatory non-interactive mode rules (e.g., using `--yes` for database operations) and quick references.
3. **Project Overview**: Read [`/home/reetabratabhandari/Projects/dsa-roadmap-generator-skill/GEMINI.md`](file:///home/reetabratabhandari/Projects/dsa-roadmap-generator-skill/GEMINI.md) for development conventions and database utility usage.

**CRITICAL SAFEGUARDS**:
- **Strict Anti-Hallucination**: All metadata (titles, difficulties) MUST be fetched via the provided Node.js scripts (e.g., `scripts/fetch_problem.js` or `scripts/fetch_batch.js`). Never guess or hallucinate this data.
- **Non-Interactive Mode**: To avoid blocking execution, you MUST use the provided flags for database operations (e.g., `node scripts/manage_tracks.js --import <file.json> --yes` and `node scripts/manage_tracks.js --cleanup-tests --yes`). Never run `manage_tracks.js` without arguments, as it enters an interactive menu that requires manual intervention.
