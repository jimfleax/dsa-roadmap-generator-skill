#!/usr/bin/env bash
# single_fetch.sh — Demonstrates fetching metadata for a single LeetCode problem
#
# Usage: bash examples/single_fetch.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "=== Single Problem Fetch Demo ==="
echo ""

echo "1. Fetching by slug:"
echo "   Command: node scripts/fetch_problem.js two-sum"
echo ""
node "$SCRIPT_DIR/scripts/fetch_problem.js" two-sum
echo ""

echo "2. Fetching by URL:"
echo '   Command: node scripts/fetch_problem.js "https://leetcode.com/problems/merge-intervals/"'
echo ""
node "$SCRIPT_DIR/scripts/fetch_problem.js" "https://leetcode.com/problems/merge-intervals/"
echo ""

echo "3. Fetching an invalid slug (expected to fail with exit code 3):"
echo "   Command: node scripts/fetch_problem.js this-problem-does-not-exist-xyz"
echo ""
node "$SCRIPT_DIR/scripts/fetch_problem.js" this-problem-does-not-exist-xyz || echo "   (Exit code: $?)"
echo ""

echo "=== Demo Complete ==="
