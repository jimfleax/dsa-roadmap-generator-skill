import mongoose from 'mongoose';
import { Track, getTrackSignature, getMongoUriFromEnv } from './lib/models.js';

const C_RESET = '\x1b[0m';
const C_BOLD = '\x1b[1m';
const C_GREEN = '\x1b[32m';
const C_CYAN = '\x1b[36m';
const C_RED = '\x1b[31m';

async function run() {
  const uri = getMongoUriFromEnv();
  if (!uri) { console.error('No MONGODB_URI found in .env'); process.exit(1); }
  await mongoose.connect(uri);
  
  const tracks = await Track.find().sort({ createdAt: 1 });
  const seen = new Map();
  const toDelete = [];

  console.log(`${C_CYAN}Analyzing ${tracks.length} tracks for exact duplicates...${C_RESET}`);

  for (const t of tracks) {
    // Uses shared helper — correctly includes parts[].problems[] slugs
    const signature = getTrackSignature(t);
    
    if (seen.has(signature)) {
      toDelete.push(t._id);
      console.log(`${C_RED}Marked duplicate:${C_RESET} "${t.title}" (ID: ${t._id})`);
    } else {
      seen.set(signature, t._id);
    }
  }

  if (toDelete.length > 0) {
    console.log(`\n${C_BOLD}Found ${toDelete.length} duplicates to remove.${C_RESET}`);
    const res = await Track.deleteMany({ _id: { $in: toDelete } });
    console.log(`${C_GREEN}Successfully deleted ${res.deletedCount} redundant track(s).${C_RESET}`);
  } else {
    console.log(`${C_GREEN}No duplicates found. Database is clean.${C_RESET}`);
  }

  await mongoose.disconnect();
}
run();
