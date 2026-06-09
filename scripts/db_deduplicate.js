import mongoose from 'mongoose';
import path from 'node:path';
import fs from 'node:fs';

const C_RESET = '\x1b[0m';
const C_BOLD = '\x1b[1m';
const C_GREEN = '\x1b[32m';
const C_CYAN = '\x1b[36m';
const C_RED = '\x1b[31m';

const TrackSchema = new mongoose.Schema({
  title: String,
  problems: [{ titleSlug: String }]
}, { timestamps: true });

const Track = mongoose.models.Track || mongoose.model('Track', TrackSchema);

function getMongoUriFromEnv() {
  const envPath = path.join(process.cwd(), '.env');
  const envContent = fs.readFileSync(envPath, 'utf8');
  const match = envContent.match(/MONGODB_URI=(.+)/);
  return match ? match[1].trim().replace(/^['"]|['"]$/g, '') : null;
}

async function run() {
  const uri = getMongoUriFromEnv();
  await mongoose.connect(uri);
  
  const tracks = await Track.find().sort({ createdAt: 1 });
  const seen = new Map();
  const toDelete = [];

  console.log(`${C_CYAN}Analyzing ${tracks.length} tracks for exact duplicates...${C_RESET}`);

  for (const t of tracks) {
    const slugs = t.problems.map(p => p.titleSlug).sort().join(',');
    const signature = `${t.title}|${slugs}`;
    
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
