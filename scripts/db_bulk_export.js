import mongoose from 'mongoose';
import path from 'node:path';
import fs from 'node:fs';
import { Track, cleanDocument, getMongoUriFromEnv } from './lib/models.js';

async function run() {
  const uri = getMongoUriFromEnv();
  if (!uri) { console.error('No MONGODB_URI found in .env'); process.exit(1); }
  await mongoose.connect(uri);
  
  const tracks = await Track.find().sort({ order: 1 });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const exportDir = path.resolve(`./backups/bulk_export_${timestamp}`);
  
  if (!fs.existsSync(exportDir)) fs.mkdirSync(exportDir, { recursive: true });

  console.log(`Exporting ${tracks.length} tracks to ${exportDir}...`);

  for (const t of tracks) {
    // Uses shared cleanDocument — properly strips _id from parts[] and parts[].problems[]
    const cleaned = cleanDocument(t);
    const filename = `${t.title.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${t._id}.json`;
    fs.writeFileSync(path.join(exportDir, filename), JSON.stringify(cleaned, null, 2));
  }

  // Combined export also uses cleaned documents for consistency
  const allCleaned = tracks.map(cleanDocument);
  const combinedPath = path.join(exportDir, 'all_tracks_combined.json');
  fs.writeFileSync(combinedPath, JSON.stringify(allCleaned, null, 2));

  console.log(`Successfully exported all tracks.`);
  await mongoose.disconnect();
}
run();
