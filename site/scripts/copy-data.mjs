import { copyFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { access } from "node:fs/promises";

const here = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(here, "../public");
await mkdir(publicDir, { recursive: true });
await copyFile(path.resolve(here, "../../data/cards.json"), path.join(publicDir, "cards.json"));

// The published collection is optional. When data/collection.txt exists it is
// bundled so the app can seed a new device automatically; without it the app
// simply starts empty as before.
const collectionSource = path.resolve(here, "../../data/collection.txt");
try {
  await access(collectionSource);
  await copyFile(collectionSource, path.join(publicDir, "collection.txt"));
} catch {
  // No published collection committed; nothing to copy.
}

