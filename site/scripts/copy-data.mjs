import { copyFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(here, "../public");
await mkdir(publicDir, { recursive: true });
await copyFile(path.resolve(here, "../../data/cards.json"), path.join(publicDir, "cards.json"));

