import mongoose from 'mongoose';
import path from 'node:path';
import fs from 'node:fs';

const TrackSchema = new mongoose.Schema({}, { strict: false, timestamps: true });
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
  
  const tracks = await Track.find().sort({ order: 1 });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const exportDir = path.resolve(`./backups/bulk_export_${timestamp}`);
  
  if (!fs.existsSync(exportDir)) fs.mkdirSync(exportDir, { recursive: true });

  console.log(`Exporting ${tracks.length} tracks to ${exportDir}...`);

  for (const t of tracks) {
    const cleaned = t.toObject();
    delete cleaned._id;
    delete cleaned.__v;
    delete cleaned.createdAt;
    delete cleaned.updatedAt;
    if (cleaned.problems) cleaned.problems.forEach(p => delete p._id);
    
    const filename = `${t.title.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${t._id}.json`;
    fs.writeFileSync(path.join(exportDir, filename), JSON.stringify(cleaned, null, 2));
  }

  const combinedPath = path.join(exportDir, 'all_tracks_combined.json');
  fs.writeFileSync(combinedPath, JSON.stringify(tracks, null, 2));

  console.log(`Successfully exported all tracks.`);
  await mongoose.disconnect();
}
run();
