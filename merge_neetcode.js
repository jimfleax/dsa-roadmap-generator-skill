import fs from 'fs';
import path from 'path';

const downloadsDir = './downloads';
const files = fs.readdirSync(downloadsDir);

const newTrack = {
  title: "NeetCode 150",
  description: "A comprehensive roadmap covering all 150 NeetCode problems grouped by topic.",
  parts: []
};

const tracksToDelete = [];
const tracks = [];

for (const file of files) {
  if (file.endsWith('.json')) {
    const data = JSON.parse(fs.readFileSync(path.join(downloadsDir, file), 'utf8'));
    if (data.description && data.description.includes('NeetCode 150')) {
      tracks.push(data);
    }
  }
}



for (const data of tracks) {
  newTrack.parts.push({
    title: data.title,
    description: data.description,
    problems: data.problems
  });
  tracksToDelete.push(data.title);
}

fs.writeFileSync('neetcode_150_track.json', JSON.stringify(newTrack, null, 2));

console.log("=== Tracks to delete ===");
tracksToDelete.forEach(t => console.log(t));
