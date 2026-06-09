import mongoose from 'mongoose';
import path from 'node:path';
import fs from 'node:fs';

// ANSI colors
const C_RESET = '\x1b[0m';
const C_BOLD = '\x1b[1m';
const C_GREEN = '\x1b[32m';
const C_CYAN = '\x1b[36m';
const C_YELLOW = '\x1b[33m';
const C_RED = '\x1b[31m';

const TrackSchema = new mongoose.Schema({
  title: String,
  description: String,
  order: Number,
  problems: [{ titleSlug: String }]
}, { timestamps: true });

const Track = mongoose.models.Track || mongoose.model('Track', TrackSchema);

function getMongoUriFromEnv() {
  const envPath = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return null;
  const envContent = fs.readFileSync(envPath, 'utf8');
  const match = envContent.match(/MONGODB_URI=(.+)/);
  return match ? match[1].trim().replace(/^['"]|['"]$/g, '') : null;
}

async function run() {
  const uri = getMongoUriFromEnv();
  if (!uri) { console.error('No MONGODB_URI found in .env'); process.exit(1); }

  console.log(`${C_CYAN}ℹ Connecting to database...${C_RESET}`);
  await mongoose.connect(uri);
  
  const tracks = await Track.find().sort({ order: 1 });
  
  console.log(`\n${C_BOLD}--- DSA ROADMAP DATABASE AUDIT ---${C_RESET}`);
  console.log(`Total Tracks: ${C_BOLD}${tracks.length}${C_RESET}\n`);

  console.log(`${C_BOLD}${'#'.padEnd(4)} | ${'Track Title'.padEnd(35)} | ${'Order'.padEnd(5)} | ${'Probs'.padEnd(5)} | ${'Status'}${C_RESET}`);
  console.log('-'.repeat(70));

  const signatures = new Map();

  tracks.forEach((t, i) => {
    const slugs = t.problems.map(p => p.titleSlug).sort().join(',');
    const signature = `${t.title}|${slugs}`;
    
    let status = `${C_GREEN}OK${C_RESET}`;
    if (signatures.has(signature)) {
      status = `${C_RED}DUPLICATE${C_RESET}`;
    } else {
      signatures.set(signature, true);
    }

    console.log(`${(i + 1).toString().padEnd(4)} | ${t.title.padEnd(35)} | ${t.order.toString().padEnd(5)} | ${t.problems.length.toString().padEnd(5)} | ${status}`);
  });

  console.log(`\n${C_CYAN}Audit complete.${C_RESET}`);
  await mongoose.disconnect();
}
run();
