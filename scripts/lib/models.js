/**
 * models.js — Shared Mongoose Track model and utility helpers.
 *
 * Single source-of-truth for the Track schema, document cleaning,
 * deduplication signatures, and .env parsing. Imported by all
 * database-facing scripts to eliminate schema duplication.
 */

import mongoose from 'mongoose';
import path from 'node:path';
import fs from 'node:fs';

// ---------------------------------------------------------------------------
// Mongoose Schema (Single Source of Truth)
// ---------------------------------------------------------------------------

const ProblemSchema = {
  title: { type: String, required: true },
  titleSlug: { type: String, required: true },
  difficulty: {
    type: String,
    enum: ['Easy', 'Medium', 'Hard'],
    required: true,
  },
  url: { type: String, required: true },
};

const TrackSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    problems: [ProblemSchema],
    parts: [
      {
        title: { type: String, required: true },
        description: { type: String },
        problems: [ProblemSchema],
      },
    ],
  },
  { timestamps: true }
);

export const Track = mongoose.models.Track || mongoose.model('Track', TrackSchema);

// ---------------------------------------------------------------------------
// Shared Helpers
// ---------------------------------------------------------------------------

/**
 * Collect all problems from both flat and parts-based track structures.
 * @param {object} track — A track document or plain object.
 * @returns {Array} Combined array of all problem objects.
 */
export function getAllProblems(track) {
  return [
    ...(track.problems || []),
    ...(track.parts?.flatMap((p) => p.problems) || []),
  ];
}

/**
 * Generate a deduplication signature for a track.
 * Collects slugs from BOTH top-level problems AND parts[].problems[]
 * so that parts-based tracks are correctly compared.
 *
 * @param {object} track — A track document or plain object.
 * @returns {string} Deterministic signature in the form "title|slug1,slug2,...".
 */
export function getTrackSignature(track) {
  const slugs = getAllProblems(track)
    .map((p) => p.titleSlug)
    .sort()
    .join(',');
  return `${track.title}|${slugs}`;
}

/**
 * Strip Mongoose internals (_id, __v, timestamps) from a track document
 * at ALL nesting levels: top-level, parts[], and parts[].problems[].
 *
 * @param {object} doc — A Mongoose document or plain object.
 * @returns {object} Clean plain object safe for JSON export.
 */
export function cleanDocument(doc) {
  const obj = doc.toObject ? doc.toObject() : JSON.parse(JSON.stringify(doc));
  delete obj._id;
  delete obj.__v;
  delete obj.createdAt;
  delete obj.updatedAt;

  // Strip _id from flat problem list
  if (Array.isArray(obj.problems)) {
    obj.problems.forEach((p) => delete p._id);
  }

  // Strip _id from parts and their nested problems
  if (Array.isArray(obj.parts)) {
    obj.parts.forEach((part) => {
      delete part._id;
      if (Array.isArray(part.problems)) {
        part.problems.forEach((p) => delete p._id);
      }
    });
  }

  return obj;
}

/**
 * Parse the .env file in the current working directory for MONGODB_URI.
 * Uses line-by-line parsing (not a fragile regex) to handle edge cases
 * like comments, whitespace, and quoted values.
 *
 * @returns {string|null} The MongoDB URI, or null if not found.
 */
export function getMongoUriFromEnv() {
  const envPath = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return null;

  try {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const lines = envContent.split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const index = trimmed.indexOf('=');
      if (index !== -1) {
        const key = trimmed.substring(0, index).trim();
        const val = trimmed
          .substring(index + 1)
          .trim()
          .replace(/^['"]|['"]$/g, '');
        if (key === 'MONGODB_URI') {
          return val;
        }
      }
    }
  } catch {
    // Silently return null if .env can't be read
  }
  return null;
}
