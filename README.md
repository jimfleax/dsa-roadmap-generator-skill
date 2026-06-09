# DSA Roadmap Generator Skill

An AI Agent Skill for generating insertion-ready DSA roadmap track JSON documents with real LeetCode metadata. Zero external dependencies, zero guesswork.

## What It Does

Takes a list of LeetCode problem URLs and produces a validated JSON document matching the `Track` MongoDB schema — complete with exact titles and difficulty ratings fetched directly from LeetCode's public GraphQL API.

## Features

- **Zero dependencies** — Uses Node.js built-in `fetch` (v18+)
- **Anti-hallucination** — Scripts fetch real data; agents never need to guess
- **Cross-agent compatible** — Works with Antigravity, Cursor, Windsurf, Cline, Claude Code
- **Strict validation** — Schema validator catches all formatting errors before insertion
- **Rate-limit aware** — Built-in retry logic with exponential backoff
- **Batch processing** — Process hundreds of problems from any text/markdown file

## Requirements

- **Node.js 18+** (for built-in `fetch`)
- No `npm install` needed

## Quick Start

### Fetch a single problem

```bash
node scripts/fetch_problem.js two-sum
# Output: { "title": "Two Sum", "titleSlug": "two-sum", "difficulty": "Easy", "url": "..." }
```

### Batch fetch from a file

```bash
node scripts/fetch_batch.js ./my_urls.md > problems.json
```

### Validate a track

```bash
node scripts/validate_track.js ./my_track.json
```

## Usage in AI Chats

Once installed, simply prompt your AI coding assistant using natural language to trigger the skill. 

**Example Prompts:**
- *"I have a list of LeetCode URLs in `urls.txt`. Please generate a DSA roadmap track JSON file for me."*
- *"Create a 'Blind 75' track. The URLs are listed below: [paste URLs]."*
- *"Can you run the track generator skill on this markdown file and save the output to `track.json`?"*

The AI agent will automatically recognize the request, read the rules, run the `fetch_batch` or `fetch_problem` scripts to get accurate metadata, assemble the JSON, and validate it using `validate_track` before presenting the final result to you.

## Installation for AI Agents

### As an NPM dependency (Any Node.js project)

If you are working on a Node.js project, you can install the skill directly as a dev dependency via Git. This makes the scripts available via `npx` or npm scripts.

```bash
npm install -D github:jimfleax/dsa-roadmap-generator-skill
```

Then your agent can run the scripts using `npx`:

```bash
npx fetch-problem two-sum
npx fetch-batch ./my_urls.md > problems.json
npx validate-track ./my_track.json
```

*(Note: To enable `npx` commands, ensure you map them in the `bin` section of your `package.json` before publishing or committing).*

### Antigravity (Gemini)

Copy the entire directory to your global skills location:

```bash
cp -r . ~/.gemini/antigravity/skills/generating-dsa-roadmaps/
```

### Cursor

The `.cursorrules` file is already included. Open this project in Cursor and the rules will be automatically loaded.

### Windsurf

The `.windsurfrules` file is already included. Open this project in Windsurf and Cascade will pick up the rules.

### Cline

The `.clinerules/` directory is already included. Open this project in VS Code with Cline and the rules will be loaded.

### Any Agent

Point your agent to read `SKILL.md` or `AGENTS.md` in this directory.

## Project Structure

```
dsa-roadmap-generator-skill/
├── SKILL.md                    # Primary AI agent instructions
├── AGENTS.md                   # Universal agent compatibility
├── README.md                   # This file
├── package.json                # Project config (zero deps)
├── .cursorrules                # Cursor compatibility
├── .clinerules/dsa-roadmap.md  # Cline compatibility
├── .windsurfrules              # Windsurf compatibility
├── scripts/
│   ├── fetch_problem.js        # Single problem metadata fetch
│   ├── fetch_batch.js          # Batch fetch from URL list
│   └── validate_track.js       # Schema validation
├── resources/
│   ├── track_schema.json       # JSON Schema (draft-07)
│   └── example_track.json      # Valid reference example
└── examples/
    ├── single_fetch.sh         # Single fetch demo
    └── batch_workflow.sh       # End-to-end workflow demo
```

## Schema

See [`resources/track_schema.json`](resources/track_schema.json) for the formal JSON Schema, or [`SKILL.md`](SKILL.md) for a human-readable definition.

## License

MIT
