import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const setsPath = path.join(root, "data", "sets.json");
const overridesPath = path.join(root, "data", "card-overrides.json");
const outputPath = path.join(root, "data", "cards.json");
const API_ROOT = "https://api.swu-db.com";

async function fetchSet(set, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(`${API_ROOT}/cards/${set}`, { signal: AbortSignal.timeout(30_000) });
      if (response.ok) return response.json();
      const error = new Error(`SWU-DB returned ${response.status} for ${set}`);
      if (response.status < 500) throw error;
      lastError = error;
    } catch (error) {
      lastError = error;
    }
    if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, attempt * 1_000));
  }
  throw lastError;
}

const sets = JSON.parse(await readFile(setsPath, "utf8"));
if (!Array.isArray(sets) || !sets.length || sets.some((set) => !/^[A-Z0-9]+$/.test(set))) {
  throw new Error("data/sets.json must be a non-empty JSON array of uppercase set codes.");
}

const asNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const publicVariant = (value) => {
  if (value === "Normal") return "Standard";
  if (value === "Foil") return "Standard Foil";
  return value || "Standard";
};

const rows = [];
for (const set of sets) {
  const payload = await fetchSet(set);
  if (!payload || !Array.isArray(payload.data)) {
    throw new Error(`Unexpected SWU-DB response for ${set}: missing data array`);
  }
  rows.push(...payload.data);
}

const identityNumbers = new Map();
for (const row of rows) {
  if (row.VariantType !== "Normal") continue;
  const numeric = String(row.Number).match(/^\d+/)?.[0];
  if (!numeric) continue;
  const signature = [row.Set, row.Name, row.Subtitle || "", row.Type].join("|");
  identityNumbers.set(signature, Number(numeric));
}

const cards = {};
for (const row of rows) {
  const numeric = String(row.Number).match(/^\d+/)?.[0];
  if (!numeric) {
    console.warn(`Skipping ${row.Set} ${row.Number}: number is not numeric`);
    continue;
  }
  const number = Number(numeric);
  const key = `${row.Set}-${number}`;
  const variant = publicVariant(row.VariantType);
  const signature = [row.Set, row.Name, row.Subtitle || "", row.Type].join("|");
  const identityNumber = identityNumbers.get(signature) ?? number;
  const printing = {
    variant,
    apiNumber: String(row.Number),
    image: row.FrontArt || "",
    backImage: row.BackArt || null,
    marketPrice: asNumber(row.MarketPrice),
    raw: row,
  };

  if (!cards[key]) {
    cards[key] = {
      key,
      set: row.Set,
      number,
      name: row.Name || "Unknown card",
      subtitle: row.Subtitle || "",
      type: row.Type || "",
      aspects: row.Aspects || [],
      cost: asNumber(row.Cost),
      power: asNumber(row.Power),
      hp: asNumber(row.HP),
      traits: row.Traits || [],
      rarity: row.Rarity || "",
      text: row.FrontText || "",
      arena: row.Arenas || [],
      images: { front: row.FrontArt || "", back: row.BackArt || null },
      defaultVariant: variant,
      identityKey: `${row.Set}-${identityNumber}`,
      printings: {},
    };
  }
  cards[key].printings[variant] = printing;
  if (row.VariantType === "Normal" || (!cards[key].images.front && row.FrontArt)) {
    cards[key].defaultVariant = variant;
    cards[key].images = { front: row.FrontArt || "", back: row.BackArt || null };
  }
}

let overrides = {};
try {
  overrides = JSON.parse(await readFile(overridesPath, "utf8"));
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}
for (const [identityKey, override] of Object.entries(overrides)) {
  if (!/^[A-Z0-9]+-\d+$/.test(identityKey) || !override || typeof override !== "object" || Array.isArray(override)) {
    throw new Error(`Invalid card metadata override for ${identityKey}`);
  }
  const fields = Object.keys(override);
  if (!fields.length || fields.some((field) => !["name", "subtitle"].includes(field) || typeof override[field] !== "string")) {
    throw new Error(`Card metadata override ${identityKey} may contain only string name/subtitle fields.`);
  }
  const matching = Object.values(cards).filter((card) => card.identityKey === identityKey);
  if (!matching.length) throw new Error(`Card metadata override ${identityKey} does not match a synced card identity.`);
  for (const card of matching) Object.assign(card, override);
}

const setMetadata = sets.map((code) => {
  const setCards = Object.values(cards).filter((card) => card.set === code);
  return {
    code,
    cardRecords: setCards.length,
    setSize: new Set(setCards.map((card) => card.identityKey)).size,
  };
});

const database = {
  generatedAt: new Date().toISOString(),
  source: `${API_ROOT}/cards/{set}`,
  sets: setMetadata,
  cardCount: Object.keys(cards).length,
  cards: Object.fromEntries(Object.entries(cards).sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))),
};

await mkdir(path.dirname(outputPath), { recursive: true });
try {
  const previous = JSON.parse(await readFile(outputPath, "utf8"));
  const withoutTimestamp = (value) => JSON.stringify({ ...value, generatedAt: "" });
  if (withoutTimestamp(previous) === withoutTimestamp(database)) {
    console.log("Card data is unchanged; keeping the existing generation timestamp.");
    process.exit(0);
  }
} catch (error) {
  if (error?.code !== "ENOENT") console.warn(`Could not compare the previous database: ${error.message}`);
}
await writeFile(outputPath, `${JSON.stringify(database, null, 2)}\n`);
console.log(`Wrote ${database.cardCount} numeric card records from ${rows.length} printings to data/cards.json.`);
