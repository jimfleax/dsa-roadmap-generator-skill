#!/usr/bin/env node
/**
 * manage_tracks.js — Interactive DSA Roadmap Track Manager CLI
 *
 * Provides full CRUD operations for tracks stored in MongoDB.
 * Ensures schema compliance, double confirmations, auto-backups, and metrics.
 */

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import mongoose from 'mongoose';
import { Track, getAllProblems, cleanDocument, getMongoUriFromEnv } from './lib/models.js';

// ANSI colors for premium terminal aesthetics
const C_RESET = '\x1b[0m';
const C_BOLD = '\x1b[1m';
const C_GREEN = '\x1b[32m';
const C_CYAN = '\x1b[36m';
const C_YELLOW = '\x1b[33m';
const C_RED = '\x1b[31m';
const C_BLUE = '\x1b[34m';
const C_MAGENTA = '\x1b[35m';

// Helper functions for colored logging
const log = {
  info: (msg) => console.log(`${C_CYAN}ℹ${C_RESET} ${msg}`),
  success: (msg) => console.log(`${C_GREEN}✔${C_RESET} ${msg}`),
  warn: (msg) => console.log(`${C_YELLOW}⚠${C_RESET} ${msg}`),
  error: (msg) => console.log(`${C_RED}✗${C_RESET} ${msg}`),
  header: (msg) => console.log(`\n${C_BOLD}${C_MAGENTA}=== ${msg} ===${C_RESET}`),
  accent: (msg) => `${C_BOLD}${C_YELLOW}${msg}${C_RESET}`,
  cyan: (msg) => `${C_CYAN}${msg}${C_RESET}`,
  green: (msg) => `${C_GREEN}${msg}${C_RESET}`,
  red: (msg) => `${C_RED}${msg}${C_RESET}`
};

// Track model, cleanDocument, getAllProblems, and getMongoUriFromEnv
// are imported from ./lib/models.js (single source of truth).

// Schema constraints for validation
const VALID_DIFFICULTIES = ['Easy', 'Medium', 'Hard'];
const FORBIDDEN_FIELDS = ['_id', '__v', 'createdAt', 'updatedAt'];
const URL_PATTERN = /^https:\/\/leetcode\.com\/problems\/[a-z0-9-]+\/$/;
const SLUG_PATTERN = /^[a-z0-9-]+$/;

/**
 * Validates a single problem object.
 */
function validateProblem(p, path, seenSlugs, errors) {
  for (const field of FORBIDDEN_FIELDS) {
    if (field in p) {
      errors.push(`Forbidden field "${field}" inside ${path}.`);
    }
  }

  if (!p.title || typeof p.title !== 'string' || p.title.trim().length === 0) {
    errors.push(`Missing or empty title inside ${path}.`);
  }

  if (!p.titleSlug || typeof p.titleSlug !== 'string') {
    errors.push(`Missing or empty titleSlug inside ${path}.`);
  } else if (!SLUG_PATTERN.test(p.titleSlug)) {
    errors.push(`Invalid titleSlug format inside ${path}: "${p.titleSlug}". Must be lowercase, hyphens, digits only.`);
  } else {
    if (seenSlugs.has(p.titleSlug)) {
      errors.push(`Duplicate titleSlug inside ${path}: "${p.titleSlug}".`);
    } else {
      seenSlugs.add(p.titleSlug);
    }
  }

  if (!p.difficulty || typeof p.difficulty !== 'string') {
    errors.push(`Missing difficulty inside ${path}.`);
  } else if (!VALID_DIFFICULTIES.includes(p.difficulty)) {
    errors.push(`Invalid difficulty inside ${path}: "${p.difficulty}". Must be Easy, Medium, or Hard.`);
  }

  if (!p.url || typeof p.url !== 'string') {
    errors.push(`Missing url inside ${path}.`);
  } else if (!URL_PATTERN.test(p.url)) {
    errors.push(`Invalid url format inside ${path}: "${p.url}". Must match: https://leetcode.com/problems/<slug>/`);
  }

  if (p.titleSlug && p.url) {
    const expectedUrl = `https://leetcode.com/problems/${p.titleSlug}/`;
    if (p.url !== expectedUrl) {
      errors.push(`URL and titleSlug mismatch in ${path}. slug="${p.titleSlug}" expects url="${expectedUrl}" but got url="${p.url}".`);
    }
  }
}

/**
 * Validates track object against the schema.
 * Re-uses rules from validate_track.js
 */
function validateTrackData(track) {
  const errors = [];
  const seenSlugs = new Set();

  // Top level fields
  for (const field of FORBIDDEN_FIELDS) {
    if (field in track) {
      errors.push(`Forbidden top-level field "${field}" found. Must not be included.`);
    }
  }

  if (!track.title || typeof track.title !== 'string' || track.title.trim().length === 0) {
    errors.push('Missing or empty "title".');
  }

  if (!track.description || typeof track.description !== 'string' || track.description.trim().length === 0) {
    errors.push('Missing or empty "description".');
  }

  }

  const hasProblems = Array.isArray(track.problems) && track.problems.length > 0;
  const hasParts = Array.isArray(track.parts) && track.parts.length > 0;

  if (!hasProblems && !hasParts) {
    errors.push('Track must contain either a non-empty "problems" array or a non-empty "parts" array.');
    return errors;
  }

  if (track.problems) {
    if (!Array.isArray(track.problems)) {
      errors.push('"problems" must be an array.');
    } else {
      track.problems.forEach((p, idx) => validateProblem(p, `problems[${idx}]`, seenSlugs, errors));
    }
  }

  if (track.parts) {
    if (!Array.isArray(track.parts)) {
      errors.push('"parts" must be an array.');
    } else {
      track.parts.forEach((part, idx) => {
        const prefix = `parts[${idx}]`;
        if (!part.title || typeof part.title !== 'string' || part.title.trim().length === 0) {
          errors.push(`Missing or empty title inside ${prefix}.`);
        }
        if (!Array.isArray(part.problems) || part.problems.length === 0) {
          errors.push(`Missing or empty problems array inside ${prefix}.`);
        } else {
          part.problems.forEach((p, pIdx) => validateProblem(p, `${prefix}.problems[${pIdx}]`, seenSlugs, errors));
        }
      });
    }
  }

  return errors;
}

// Setup readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const ask = (query) => new Promise((resolve) => rl.question(query, resolve));

// getMongoUriFromEnv() is imported from ./lib/models.js

// Redact password in MongoDB URI for logging
function redactUri(uri) {
  try {
    return uri.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:****@');
  } catch {
    return '(unable to parse URI)';
  }
}

// Helper to prompt for a clean, confirmed yes/no answer
async function askConfirm(promptText) {
  while (true) {
    const response = (await ask(`${promptText} (y/n): `)).trim().toLowerCase();
    if (response === 'y' || response === 'yes') return true;
    if (response === 'n' || response === 'no') return false;
    log.warn('Please enter "y" or "n".');
  }
}

// cleanDocument() is imported from ./lib/models.js
// It now properly strips _id from parts[] and parts[].problems[] too.

// Print difficulty distribution metrics
function getDifficultyStats(problems) {
  let easy = 0, medium = 0, hard = 0;
  problems.forEach(p => {
    if (p.difficulty === 'Easy') easy++;
    else if (p.difficulty === 'Medium') medium++;
    else if (p.difficulty === 'Hard') hard++;
  });
  return { easy, medium, hard };
}

function formatStats(stats) {
  return `${C_GREEN}🟢 Easy: ${stats.easy}${C_RESET} | ${C_YELLOW}🟡 Medium: ${stats.medium}${C_RESET} | ${C_RED}🔴 Hard: ${stats.hard}${C_RESET}`;
}

// ---------------------------------------------------------------------------
// CRUD Menu Handlers
// ---------------------------------------------------------------------------

// getAllProblems() is imported from ./lib/models.js

async function handleViewTracks() {
  log.header('VIEW TRACKS');
  try {
    const tracks = await Track.find();
    if (tracks.length === 0) {
      log.info('No tracks found in the database.');
      return;
    }

    console.log(`\nFound ${log.accent(tracks.length)} track(s) in the database:\n`);
    for (let i = 0; i < tracks.length; i++) {
      const t = tracks[i];
      const allProbs = getAllProblems(t);
      const stats = getDifficultyStats(allProbs);
      console.log(`   Description: ${t.description}`);
      console.log(`   Problems: ${log.accent(allProbs.length)} [${formatStats(stats)}]`);
      if (t.parts?.length > 0) {
        console.log(`   Structure:  ${log.cyan(t.parts.length)} Parts/Milestones`);
      }
      console.log('   ──────────────────────────────────────────────────────────');
    }
  } catch (error) {
    log.error(`Failed to retrieve tracks: ${error.message}`);
  }
}

async function handleAddTrack() {
  log.header('ADD TRACK');
  const filePath = (await ask('Enter path to the track JSON file: ')).trim();
  if (!filePath) {
    log.warn('Operation cancelled: Empty file path.');
    return;
  }

  try {
    const resolvedPath = path.resolve(filePath);
    if (!fs.existsSync(resolvedPath)) {
      log.error(`File does not exist: "${resolvedPath}"`);
      return;
    }

    const fileContent = fs.readFileSync(resolvedPath, 'utf8');
    let trackData;
    try {
      trackData = JSON.parse(fileContent);
    } catch (err) {
      log.error(`Invalid JSON formatting: ${err.message}`);
      return;
    }

    const errors = validateTrackData(trackData);
    if (errors.length > 0) {
      log.error('Validation failed! Fix the following issues before adding:');
      errors.forEach(err => console.log(`  - ${C_RED}${err}${C_RESET}`));
      return;
    }

    const allProbs = getAllProblems(trackData);
    const stats = getDifficultyStats(allProbs);
    log.info(`Valid Track JSON Loaded!`);
    console.log(`  Title:       ${log.accent(trackData.title)}`);
    console.log(`  Description: ${trackData.description}`);
    console.log(`  Problems:    ${log.accent(allProbs.length)} [${formatStats(stats)}]`);
    if (trackData.parts?.length > 0) {
      console.log(`  Parts:       ${log.cyan(trackData.parts.length)}`);
    }

    const confirm = await askConfirm('Are you sure you want to add this track to the database?');
    if (!confirm) {
      log.info('Operation cancelled by user.');
      return;
    }

    const newTrack = await Track.create(trackData);
    log.success(`Successfully added track "${newTrack.title}"!`);
    console.log(`  ID:        ${newTrack._id}`);
    console.log(`  Problems:  ${allProbs.length}`);
  } catch (error) {
    log.error(`Failed to add track: ${error.message}`);
  }
}

async function handleEditTrack() {
  log.header('EDIT TRACK');
  try {
    const tracks = await Track.find();
    if (tracks.length === 0) {
      log.info('No tracks found in the database to edit.');
      return;
    }

    console.log('\nSelect a track to edit:\n');
    tracks.forEach((t, index) => {
      const allProbs = getAllProblems(t);
    });
    console.log('  [0] Cancel');

    const selection = (await ask('\nEnter track number to edit: ')).trim();
    if (selection === '0' || !selection) {
      log.info('Operation cancelled.');
      return;
    }

    const index = parseInt(selection, 10) - 1;
    if (isNaN(index) || index < 0 || index >= tracks.length) {
      log.error('Invalid selection.');
      return;
    }

    const selectedTrack = tracks[index];
    log.info(`Selected Track: "${log.accent(selectedTrack.title)}"`);

    const filePath = (await ask('Enter path to the updated track JSON file: ')).trim();
    if (!filePath) {
      log.warn('Operation cancelled: Empty file path.');
      return;
    }

    const resolvedPath = path.resolve(filePath);
    if (!fs.existsSync(resolvedPath)) {
      log.error(`File does not exist: "${resolvedPath}"`);
      return;
    }

    const fileContent = fs.readFileSync(resolvedPath, 'utf8');
    let updatedData;
    try {
      updatedData = JSON.parse(fileContent);
    } catch (err) {
      log.error(`Invalid JSON formatting: ${err.message}`);
      return;
    }

    const errors = validateTrackData(updatedData);
    if (errors.length > 0) {
      log.error('Validation failed! Fix the following issues:');
      errors.forEach(err => console.log(`  - ${C_RED}${err}${C_RESET}`));
      return;
    }

    // Generate diff metrics
    const originalProblems = getAllProblems(selectedTrack).map(p => p.titleSlug);
    const newProblems = getAllProblems(updatedData).map(p => p.titleSlug);

    const added = newProblems.filter(p => !originalProblems.includes(p));
    const removed = originalProblems.filter(p => !newProblems.includes(p));

    log.info('Change Summary / Diff Metrics:');
    if (selectedTrack.title !== updatedData.title) {
      console.log(`  Title:        "${selectedTrack.title}" -> "${log.green(updatedData.title)}"`);
    }
    if (selectedTrack.description !== updatedData.description) {
      console.log(`  Description:  Changed`);
    }
    }
    console.log(`  Problems:     ${originalProblems.length} -> ${log.accent(newProblems.length)}`);

    if (added.length > 0) {
      console.log(`  Added problems (${added.length}):`);
      added.forEach(p => console.log(`    ${C_GREEN}+ ${p}${C_RESET}`));
    }
    if (removed.length > 0) {
      console.log(`  Removed problems (${removed.length}):`);
      removed.forEach(p => console.log(`    ${C_RED}- ${p}${C_RESET}`));
    }

    const confirm = await askConfirm('Are you sure you want to apply these updates?');
    if (!confirm) {
      log.info('Operation cancelled.');
      return;
    }

    await Track.findByIdAndUpdate(selectedTrack._id, updatedData, { runValidators: true });
    log.success(`Successfully updated track "${updatedData.title}"!`);
  } catch (error) {
    log.error(`Failed to update track: ${error.message}`);
  }
}

async function handleDownloadTracks() {
  log.header('DOWNLOAD TRACKS');
  try {
    const tracks = await Track.find();
    if (tracks.length === 0) {
      log.info('No tracks found to download.');
      return;
    }

    console.log('\nSelect track(s) to download:\n');
    tracks.forEach((t, index) => {
      const allProbs = getAllProblems(t);
      console.log(`  [${index + 1}] ${t.title} (${allProbs.length} problems)`);
    });
    console.log(`  [A] All tracks (combined & individual)`);
    console.log('  [0] Cancel');

    const selection = (await ask('\nEnter choice: ')).trim().toUpperCase();
    if (selection === '0' || !selection) {
      log.info('Operation cancelled.');
      return;
    }

    let downloadDir = (await ask('Enter download directory path (default: "./downloads"): ')).trim();
    if (!downloadDir) downloadDir = './downloads';

    const resolvedDir = path.resolve(downloadDir);
    if (!fs.existsSync(resolvedDir)) {
      fs.mkdirSync(resolvedDir, { recursive: true });
      log.info(`Created directory: "${resolvedDir}"`);
    }

    if (selection === 'A') {
      // Export all individually
      for (const t of tracks) {
        const cleaned = cleanDocument(t);
        const filename = `${t.title.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_track.json`;
        const filePath = path.join(resolvedDir, filename);
        fs.writeFileSync(filePath, JSON.stringify(cleaned, null, 2));
      }

      // Export all combined
      const allCleaned = tracks.map(cleanDocument);
      const combinedPath = path.join(resolvedDir, 'all_tracks_combined.json');
      fs.writeFileSync(combinedPath, JSON.stringify(allCleaned, null, 2));

      log.success(`Downloaded all ${tracks.length} tracks to "${resolvedDir}":`);
      log.info(`Combined file: "${combinedPath}" (${fs.statSync(combinedPath).size} bytes)`);
    } else {
      const index = parseInt(selection, 10) - 1;
      if (isNaN(index) || index < 0 || index >= tracks.length) {
        log.error('Invalid selection.');
        return;
      }
      const t = tracks[index];
      const cleaned = cleanDocument(t);
      const filename = `${t.title.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_track.json`;
      const filePath = path.join(resolvedDir, filename);
      fs.writeFileSync(filePath, JSON.stringify(cleaned, null, 2));
      log.success(`Downloaded track "${t.title}" to: "${filePath}" (${fs.statSync(filePath).size} bytes)`);
    }
  } catch (error) {
    log.error(`Failed to download tracks: ${error.message}`);
  }
}

async function handleDeleteTrack() {
  log.header('DELETE TRACK');
  try {
    const tracks = await Track.find();
    if (tracks.length === 0) {
      log.info('No tracks found to delete.');
      return;
    }

    console.log('\nSelect track to delete:\n');
    tracks.forEach((t, index) => {
      const allProbs = getAllProblems(t);
      console.log(`  [${index + 1}] ${t.title} (${allProbs.length} problems)`);
    });
    console.log('  [0] Cancel');

    const selection = (await ask('\nEnter choice: ')).trim();
    if (selection === '0' || !selection) {
      log.info('Operation cancelled.');
      return;
    }

    const index = parseInt(selection, 10) - 1;
    if (isNaN(index) || index < 0 || index >= tracks.length) {
      log.error('Invalid selection.');
      return;
    }

    const t = tracks[index];

    // Safety Step 1: Auto-backup
    const backupDir = path.resolve('./backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    const cleanTitle = t.title.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(backupDir, `${cleanTitle}_backup_${timestamp}.json`);

    const cleaned = cleanDocument(t);
    fs.writeFileSync(backupPath, JSON.stringify(cleaned, null, 2));
    log.info(`Safety backup created at: "${backupPath}"`);

    // Confirmation 1
    const confirm1 = await askConfirm(`Are you sure you want to delete the track "${log.red(t.title)}"?`);
    if (!confirm1) {
      log.info('Operation cancelled. Safety backup preserved.');
      return;
    }

    // Confirmation 2 (Double confirmation required by strict safety guidelines)
    console.log(`\n${C_RED}${C_BOLD}WARNING: This action is permanent!${C_RESET}`);
    console.log(`To confirm, type the exact name of the track: ${log.accent(t.title)}`);
    const nameConfirm = (await ask('> ')).trim();

    if (nameConfirm !== t.title) {
      log.error('Name mismatch! Deletion cancelled.');
      return;
    }

    await Track.findByIdAndDelete(t._id);
    log.success(`Successfully deleted track "${t.title}"!`);

    const remaining = await Track.countDocuments();
    log.info(`Remaining tracks in database: ${remaining}`);
  } catch (error) {
    log.error(`Failed to delete track: ${error.message}`);
  }
}

async function handleCleanupTests(skipConfirm) {
  log.header('CLEANUP TEST TRACKS');
  try {
    // STRICT QUERY: Only looks for tracks where the title starts with [TEST]
    const query = {
      title: { $regex: /^\[TEST\]/ }
    };

    const tracks = await Track.find(query);

    if (tracks.length === 0) {
      log.info('No tracks with "[TEST]" prefix found.');
      return true;
    }

    const targets = [];
    for (const t of tracks) {
      log.info(`Analyzing: ${t.title}...`);
      
      // Analyze description for test markers
      const isTestDesc = /this is a test track|created to verify|testing context/i.test(t.description);
      
      if (isTestDesc) {
        log.success(`  -> CONFIRMED as test data via description analysis.`);
        targets.push(t);
      } else {
        log.warn(`  -> Description check failed. Skipping "${t.title}" to prevent accidental deletion.`);
      }
    }

    if (targets.length === 0) {
      log.info('No tracks met the two-factor safety criteria for deletion.');
      return true;
    }

    log.warn(`Found ${log.accent(targets.length)} track(s) verified as safe for removal:`);
    for (const t of targets) {
      console.log(`  - ${C_BOLD}${t.title}${C_RESET} (${t.description})`);
    }

    if (!skipConfirm) {
      const confirmAll = await askConfirm('Do you want to delete ALL these verified test tracks?');
      if (confirmAll) {
        for (const t of targets) {
          await Track.findByIdAndDelete(t._id);
          log.success(`Deleted: ${t.title}`);
        }
      } else {
        for (const t of targets) {
          const confirmEach = await askConfirm(`Delete "${t.title}"?`);
          if (confirmEach) {
            await Track.findByIdAndDelete(t._id);
            log.success(`Deleted: ${t.title}`);
          } else {
            log.info(`Skipped: ${t.title}`);
          }
        }
      }
    } else {
      log.info('Skipping confirmation (--yes flag detected). Deleting all verified tracks...');
      for (const t of targets) {
        await Track.findByIdAndDelete(t._id);
        log.success(`Deleted: ${t.title}`);
      }
    }

    log.success('Cleanup operation completed.');
    return true;
  } catch (error) {
    log.error(`Failed to cleanup test tracks: ${error.message}`);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Main Loop & Connection
// ---------------------------------------------------------------------------

async function showMenu() {
  while (true) {
    log.header('DSA TRACK MANAGER');
    console.log(`  [1] View Tracks`);
    console.log(`  [2] Add Track`);
    console.log(`  [3] Edit Track`);
    console.log(`  [4] Download Track(s)`);
    console.log(`  [5] Delete Track (with Backup & Double Confirmation)`);
    console.log(`  [6] Cleanup Test Tracks (GC)`);
    console.log(`  [0] Exit`);

    const choice = (await ask('\nEnter choice (0-6): ')).trim();
    switch (choice) {
      case '1':
        await handleViewTracks();
        break;
      case '2':
        await handleAddTrack();
        break;
      case '3':
        await handleEditTrack();
        break;
      case '4':
        await handleDownloadTracks();
        break;
      case '5':
        await handleDeleteTrack();
        break;
      case '6':
        await handleCleanupTests(false);
        break;
      case '0':
        log.info('Disconnecting and exiting...');
        await mongoose.disconnect();
        rl.close();
        process.exit(0);
      default:
        log.warn('Invalid option. Please choose between 0 and 6.');
    }
    await ask('\nPress Enter to return to main menu...');
  }
}

async function autoImportTrack(filePath, skipConfirm) {
  log.header('AUTO IMPORT TRACK');
  try {
    const resolvedPath = path.resolve(filePath);
    if (!fs.existsSync(resolvedPath)) {
      log.error(`File does not exist: "${resolvedPath}"`);
      return false;
    }

    const fileContent = fs.readFileSync(resolvedPath, 'utf8');
    let trackData;
    try {
      trackData = JSON.parse(fileContent);
    } catch (err) {
      log.error(`Invalid JSON formatting: ${err.message}`);
      return false;
    }

    // Auto-assign order if missing
      const count = await Track.countDocuments();
    }

    const errors = validateTrackData(trackData);
    if (errors.length > 0) {
      log.error('Validation failed! Fix the following issues before adding:');
      errors.forEach(err => console.log(`  - ${C_RED}${err}${C_RESET}`));
      return false;
    }

    const allProbs = getAllProblems(trackData);
    const stats = getDifficultyStats(allProbs);
    log.info(`Valid Track JSON Loaded!`);
    console.log(`  Title:       ${log.accent(trackData.title)}`);
    console.log(`  Description: ${trackData.description}`);
    console.log(`  Problems:    ${log.accent(allProbs.length)} [${formatStats(stats)}]`);
    if (trackData.parts?.length > 0) {
      console.log(`  Parts:       ${log.cyan(trackData.parts.length)}`);
    }

    if (!skipConfirm) {
      const confirm = await askConfirm('Are you sure you want to add this track to the database?');
      if (!confirm) {
        log.info('Operation cancelled by user.');
        return false;
      }
    } else {
      log.info('Skipping confirmation (--yes flag detected).');
    }

    // Use findOneAndUpdate with upsert:true for IDEMPOTENCY
    // This prevents duplicates if the script is run multiple times (e.g. after a timeout)
    const existingTrack = await Track.findOne({ title: trackData.title });
    const isNew = !existingTrack;

    const savedTrack = await Track.findOneAndUpdate(
      { title: trackData.title },
      trackData,
      { upsert: true, new: true, runValidators: true }
    );

    if (isNew) {
      log.success(`Successfully added NEW track "${savedTrack.title}"!`);
    } else {
      log.success(`Successfully UPDATED existing track "${savedTrack.title}" (Idempotent Upsert)!`);
    }

    console.log(`  ID:        ${savedTrack._id}`);
    console.log(`  Problems:  ${allProbs.length}`);
    return true;
  } catch (error) {
    log.error(`Failed to auto-import track: ${error.message}`);
    return false;
  }
}

async function autoDeleteTrack(title, skipConfirm) {
  log.header('AUTO DELETE TRACK');
  try {
    const t = await Track.findOne({ title });
    if (!t) {
      log.error(`Track "${title}" not found in database.`);
      return false;
    }

    // Safety Step 1: Auto-backup
    const backupDir = path.resolve('./backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    const cleanTitle = t.title.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(backupDir, `${cleanTitle}_backup_${timestamp}.json`);

    const cleaned = cleanDocument(t);
    fs.writeFileSync(backupPath, JSON.stringify(cleaned, null, 2));
    log.info(`Safety backup created at: "${backupPath}"`);

    if (!skipConfirm) {
      const confirm1 = await askConfirm(`Are you sure you want to delete the track "${log.red(t.title)}"?`);
      if (!confirm1) {
        log.info('Operation cancelled. Safety backup preserved.');
        return false;
      }
      console.log(`\n${C_RED}${C_BOLD}WARNING: This action is permanent!${C_RESET}`);
      console.log(`To confirm, type the exact name of the track: ${log.accent(t.title)}`);
      const nameConfirm = (await ask('> ')).trim();
      if (nameConfirm !== t.title) {
        log.error('Name mismatch! Deletion cancelled.');
        return false;
      }
    } else {
      log.info('Skipping confirmation (--yes flag detected).');
    }

    await Track.findByIdAndDelete(t._id);
    log.success(`Successfully deleted track "${t.title}"!`);
    return true;
  } catch (error) {
    log.error(`Failed to delete track: ${error.message}`);
    return false;
  }
}

async function autoDownloadTracks(args) {
  log.header('AUTO DOWNLOAD TRACKS');
  try {
    const downloadIndex = args.indexOf('--download');
    const outputIndex = args.indexOf('--output');
    const dirIndex = args.indexOf('--dir');

    const targetTitle = args[downloadIndex + 1];
    let downloadDir = './downloads';
    
    if (dirIndex !== -1 && dirIndex + 1 < args.length) {
      downloadDir = args[dirIndex + 1];
    }

    const resolvedDir = path.resolve(downloadDir);
    if (!fs.existsSync(resolvedDir)) {
      fs.mkdirSync(resolvedDir, { recursive: true });
    }

    if (targetTitle === 'ALL' || targetTitle === '*') {
      const tracks = await Track.find();
      if (tracks.length === 0) {
        log.info('No tracks found to download.');
        return true;
      }

      for (const t of tracks) {
        const cleaned = cleanDocument(t);
        const filename = `${t.title.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_track.json`;
        const filePath = path.join(resolvedDir, filename);
        fs.writeFileSync(filePath, JSON.stringify(cleaned, null, 2));
      }

      // Export all combined
      const allCleaned = tracks.map(cleanDocument);
      const combinedPath = path.join(resolvedDir, 'all_tracks_combined.json');
      fs.writeFileSync(combinedPath, JSON.stringify(allCleaned, null, 2));

      log.success(`Downloaded all ${tracks.length} tracks to "${resolvedDir}"`);
      return true;
    } else {
      const t = await Track.findOne({ title: targetTitle });
      if (!t) {
        log.error(`Track "${targetTitle}" not found.`);
        return false;
      }

      const cleaned = cleanDocument(t);
      let filename = `${t.title.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_track.json`;
      
      if (outputIndex !== -1 && outputIndex + 1 < args.length) {
        filename = args[outputIndex + 1];
      }

      const filePath = path.isAbsolute(filename) ? filename : path.join(resolvedDir, filename);
      const parentDir = path.dirname(filePath);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }

      fs.writeFileSync(filePath, JSON.stringify(cleaned, null, 2));
      log.success(`Downloaded track "${t.title}" to: "${filePath}"`);
      return true;
    }
  } catch (error) {
    log.error(`Failed to download tracks: ${error.message}`);
    return false;
  }
}

async function run() {
  const args = process.argv.slice(2);
  const isAutonomous = args.length > 0;

  if (!isAutonomous) {
    console.log(`\n${C_BOLD}${C_GREEN}===============================================`);
    console.log(`     Welcome to the DSA Roadmap Track Manager   `);
    console.log(`===============================================${C_RESET}\n`);
  }

  let mongoUri = getMongoUriFromEnv();

  if (!mongoUri) {
    if (isAutonomous) {
      log.error('MONGODB_URI not found in .env and required for autonomous mode. Exiting.');
      process.exit(1);
    }
    log.warn(`No .env file found in the current directory or MONGODB_URI is not set.`);
    mongoUri = (await ask('Please paste your MongoDB connection URI: ')).trim();
  }

  if (!mongoUri) {
    log.error('MongoDB URI is required to start. Exiting.');
    rl.close();
    process.exit(1);
  }

  if (!mongoUri.startsWith('mongodb://') && !mongoUri.startsWith('mongodb+srv://')) {
    log.error('Invalid connection URI format. Must start with "mongodb://" or "mongodb+srv://".');
    rl.close();
    process.exit(1);
  }

  if (!isAutonomous) {
    log.info(`Connecting to: ${redactUri(mongoUri)} ...`);
  }

  try {
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 10000, // 10 seconds timeout
    });
    
    if (!isAutonomous) {
      log.success(`Connected successfully to database "${mongoose.connection.name}" at host "${mongoose.connection.host}"!\n`);
    }

    // Listen for connection drops
    mongoose.connection.on('error', (err) => {
      log.error(`Database connection error: ${err.message}`);
    });

    mongoose.connection.on('disconnected', () => {
      log.warn('Database connection disconnected!');
    });

    const importIndex = args.indexOf('--import');
    const deleteIndex = args.indexOf('--delete');
    const downloadIndex = args.indexOf('--download');
    const listIndex = args.indexOf('--list');
    const cleanupIndex = args.indexOf('--cleanup-tests');

    if (importIndex !== -1 && importIndex + 1 < args.length) {
      const importPath = args[importIndex + 1];
      const skipConfirm = args.includes('--yes') || args.includes('-y');
      const success = await autoImportTrack(importPath, skipConfirm);
      await mongoose.disconnect();
      rl.close();
      process.exit(success ? 0 : 1);
    } else if (deleteIndex !== -1 && deleteIndex + 1 < args.length) {
      const trackTitle = args[deleteIndex + 1];
      const skipConfirm = args.includes('--yes') || args.includes('-y');
      const success = await autoDeleteTrack(trackTitle, skipConfirm);
      await mongoose.disconnect();
      rl.close();
      process.exit(success ? 0 : 1);
    } else if (downloadIndex !== -1 && downloadIndex + 1 < args.length) {
      const success = await autoDownloadTracks(args);
      await mongoose.disconnect();
      rl.close();
      process.exit(success ? 0 : 1);
    } else if (listIndex !== -1) {
      await handleViewTracks();
      await mongoose.disconnect();
      rl.close();
      process.exit(0);
    } else if (cleanupIndex !== -1) {
      const skipConfirm = args.includes('--yes') || args.includes('-y');
      const success = await handleCleanupTests(skipConfirm);
      await mongoose.disconnect();
      rl.close();
      process.exit(success ? 0 : 1);
    } else {
      await showMenu();
    }
  } catch (err) {
    log.error(`Could not connect to MongoDB: ${err.message}`);
    rl.close();
    process.exit(1);
  }
}

// Graceful shutdown listeners
process.on('SIGINT', async () => {
  console.log('\n');
  log.info('SIGINT received. Cleaning up connection and exiting...');
  try {
    await mongoose.disconnect();
  } catch {}
  rl.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n');
  log.info('SIGTERM received. Cleaning up connection and exiting...');
  try {
    await mongoose.disconnect();
  } catch {}
  rl.close();
  process.exit(0);
});

// Run application
run();
