import fs from 'fs';

const parts = JSON.parse(fs.readFileSync('reverse_traversal_parts.json', 'utf8'));

const track = {
  title: "Reverse Traversal Monotonic Stack",
  description: "A heavily curated progression of LeetCode problems designed specifically to drill this right-to-left monotonic stack architecture into your muscle memory.",
  parts: parts
};

fs.writeFileSync('reverse_traversal_track.json', JSON.stringify(track, null, 2));
