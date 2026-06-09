import mongoose from 'mongoose';
import path from 'node:path';
import fs from 'node:fs';

const TrackSchema = new mongoose.Schema({
  title: String,
  description: String,
  order: Number,
  problems: [{ title: String, titleSlug: String, difficulty: String, url: String }]
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
  if (!uri) { console.error('No URI found'); process.exit(1); }
  await mongoose.connect(uri);
  const tracks = await Track.find().sort({ order: 1 });
  
  console.log('--- Detailed Audit of Tracks 1-12 ---');
  for (let i = 0; i < 12 && i < tracks.length; i++) {
    const t = tracks[i];
    console.log(`\nTrack ${i + 1}: ${t.title}`);
    console.log(`ID: ${t._id}`);
    console.log(`Description: ${t.description}`);
    console.log(`Order: ${t.order}`);
    console.log(`Problem Count: ${t.problems.length}`);
    const slugs = t.problems.map(p => p.titleSlug).join(', ');
    console.log(`Slugs: ${slugs}`);
    console.log(`Created At: ${t.createdAt}`);
  }
  await mongoose.disconnect();
}
run();
