// Validates site/src/data/travel-decks.json: each deck is a legal 50-card build
// (zero aspect penalties, real owned printings, distinct leaders/bases), and the
// whole roster is simultaneously buildable — no card, leader, or base identity is
// used more times than it is owned across all five decks at once. Ownership is
// checked against the private collection export when present (skipped in CI).
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const db = JSON.parse(await readFile(path.join(root, "data", "cards.json"), "utf8"));
const travel = JSON.parse(await readFile(path.join(root, "site", "src", "data", "travel-decks.json"), "utf8"));

const collectionPath = ["Master_Collection_(All_cards).txt", "Master_Collection.txt", "data/collection.txt"]
  .map((name) => path.join(root, name))
  .find((file) => existsSync(file));

function parseCsvLine(line) {
  const out = []; let cur = ""; let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) { if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else quoted = false; } else cur += ch; }
    else if (ch === '"') quoted = true;
    else if (ch === ",") { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur); return out;
}

let ownedByIdentity = null;
let ownedByPrinting = null;
if (collectionPath) {
  ownedByIdentity = new Map();
  ownedByPrinting = new Map();
  const lines = (await readFile(collectionPath, "utf8")).split(/\r?\n/).filter((line) => line.trim());
  const header = parseCsvLine(lines[0].replace(/^#\s*/, "")).map((h) => h.trim().toLowerCase());
  const idx = Object.fromEntries(header.map((h, i) => [h, i]));
  for (const line of lines.slice(1)) {
    const fields = parseCsvLine(line);
    const set = fields[idx.set]?.trim().toUpperCase();
    const number = Number(fields[idx.number]);
    const count = Number(fields[idx.count]);
    const scannedVariant = (fields[idx.variant] || "Standard").trim();
    const variant = scannedVariant === "Foil Prestige" ? "Prestige Foil" : scannedVariant;
    const card = db.cards[`${set}-${number}`];
    if (!card || !Number.isInteger(count)) continue;
    ownedByIdentity.set(card.identityKey, (ownedByIdentity.get(card.identityKey) || 0) + count);
    ownedByPrinting.set(`${set}-${number}|${variant}`, (ownedByPrinting.get(`${set}-${number}|${variant}`) || 0) + count);
  }
  console.log(`Ownership validation enabled (${collectionPath.split("/").pop()}).`);
} else {
  console.log("No collection file found; skipping ownership checks (expected in CI).");
}

const aspectPenalty = (cardAspects, icons) => {
  const pool = [...icons];
  let missing = 0;
  for (const aspect of cardAspects) {
    const at = pool.indexOf(aspect);
    if (at >= 0) pool.splice(at, 1); else missing++;
  }
  return missing * 2;
};

let failures = 0;
const fail = (name, message) => { failures++; console.error(`  !! ${name}: ${message}`); };

// Roster-wide usage of every identity and every specific printing.
const rosterUse = new Map();
const addUse = (id, n) => rosterUse.set(id, (rosterUse.get(id) || 0) + n);
const rosterPrint = new Map();
const addPrint = (key, variant, n) => rosterPrint.set(`${key}|${variant}`, (rosterPrint.get(`${key}|${variant}`) || 0) + n);

for (const deck of travel.roster) {
  console.log(`- ${deck.name}`);
  const leader = db.cards[deck.leader.id];
  const base = db.cards[deck.base.id];
  if (!leader || leader.type !== "Leader") fail(deck.name, `leader ${deck.leader.id} missing or not a Leader`);
  if (!base || base.type !== "Base") fail(deck.name, `base ${deck.base.id} missing or not a Base`);
  addUse(deck.leader.id, 1);
  addUse(deck.base.id, 1);
  addPrint(deck.leader.printing, deck.leader.variant, 1);
  addPrint(deck.base.printing, deck.base.variant, 1);
  const icons = leader && base ? [...leader.aspects, ...base.aspects] : [];
  for (const [kind, selection] of [["leader", deck.leader], ["base", deck.base]]) {
    const record = db.cards[selection.printing];
    if (!record || record.identityKey !== selection.id || record.type.toLowerCase() !== kind) {
      fail(deck.name, `${kind} printing ${selection.printing} does not match ${selection.id}`);
    } else if (!record.printings[selection.variant]) {
      fail(deck.name, `${kind} variant ${selection.variant} does not exist at ${selection.printing}`);
    }
  }

  let total = 0;
  const titleCounts = new Map(); // copy limit is per card title (name + subtitle), across reprints
  for (const entry of deck.cards) {
    const card = db.cards[entry.id];
    if (!card) { fail(deck.name, `unknown card ${entry.id}`); continue; }
    total += entry.count;
    addUse(entry.id, entry.count);
    const title = `${card.name}|${card.subtitle}`;
    titleCounts.set(title, (titleCounts.get(title) || 0) + entry.count);
    if (entry.count > 3) fail(deck.name, `${card.name}: ${entry.count} copies exceeds the limit of 3`);
    const printed = entry.printings.reduce((sum, p) => sum + p.count, 0);
    if (printed !== entry.count) fail(deck.name, `${card.name}: printings cover ${printed}/${entry.count}`);
    for (const printing of entry.printings) {
      const record = db.cards[printing.key];
      if (!record || record.identityKey !== card.identityKey) fail(deck.name, `${card.name}: printing key ${printing.key} mismatch`);
      else if (!record.printings[printing.variant]) fail(deck.name, `${card.name}: variant ${printing.variant} not at ${printing.key}`);
      addPrint(printing.key, printing.variant, printing.count);
    }
    if (aspectPenalty(card.aspects, icons) > 0) fail(deck.name, `${card.name}: aspect penalty violates the zero-penalty policy`);
    // SWUDB export id resolves
    const [set, number] = entry.id.split("-");
    if (!db.cards[`${set}-${Number(number)}`]) fail(deck.name, `SWUDB id ${set}_${number} does not round-trip`);
  }
  for (const [title, count] of titleCounts) {
    if (count > 3) fail(deck.name, `${title.split("|")[0]}: ${count} copies across reprints exceeds the limit of 3`);
  }
  if (total !== 50) fail(deck.name, `main deck has ${total} cards, not 50`);
}

// A physical leader can only be in one box; owning several bases lets boxes share
// a base identity, so leaders must be distinct but bases only need enough copies.
const leaderIds = travel.roster.map((d) => d.leader.id);
if (new Set(leaderIds).size !== leaderIds.length) { failures++; console.error("!! Two decks share a leader"); }

// The whole roster must be simultaneously buildable from owned copies — both at
// the card-identity level and for every specific printing (so two boxes never
// claim the same single foil or hyperspace copy).
if (ownedByIdentity) {
  for (const [id, used] of rosterUse) {
    const owned = ownedByIdentity.get(id) || 0;
    if (used > owned) { failures++; console.error(`!! Roster over-allocates ${db.cards[id]?.name || id}: uses ${used}, owns ${owned}`); }
  }
  for (const [key, used] of rosterPrint) {
    const [recordKey, variant] = key.split("|");
    const owned = ownedByPrinting.get(key) || 0;
    if (used > owned) { failures++; console.error(`!! Roster over-allocates ${db.cards[recordKey]?.name || recordKey} (${variant}): uses ${used}, owns ${owned}`); }
  }
}

if (!Number.isInteger(travel.roster.length) || travel.roster.length < 1) {
  failures++; console.error("!! roster must contain at least one deck");
}

if (failures) {
  console.error(`\n${failures} validation failure(s).`);
  process.exit(1);
}
console.log(`\nAll ${travel.roster.length} travel decks valid${ownedByIdentity ? " and simultaneously buildable (ownership checked)" : ""}.`);
