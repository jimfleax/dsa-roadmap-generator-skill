import mongoose from 'mongoose';
import { Track, getAllProblems, getMongoUriFromEnv } from './lib/models.js';

async function run() {
  const uri = getMongoUriFromEnv();
  if (!uri) { console.error('No MONGODB_URI found in .env'); process.exit(1); }
  await mongoose.connect(uri);
  const tracks = await Track.find().sort({ order: 1 });
  
  console.log('--- Detailed Audit of Tracks 1-12 ---');
  for (let i = 0; i < 12 && i < tracks.length; i++) {
    const t = tracks[i];
    // Uses shared helper — correctly includes parts[].problems[]
    const allProbs = getAllProblems(t);
    console.log(`\nTrack ${i + 1}: ${t.title}`);
    console.log(`ID: ${t._id}`);
    console.log(`Description: ${t.description}`);
    console.log(`Order: ${t.order}`);
    console.log(`Problem Count: ${allProbs.length}`);
    const slugs = allProbs.map(p => p.titleSlug).join(', ');
    console.log(`Slugs: ${slugs}`);
    console.log(`Created At: ${t.createdAt}`);
  }
  await mongoose.disconnect();
}
run();
