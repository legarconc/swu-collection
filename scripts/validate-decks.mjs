// Validates site/src/data/decks.json against data/cards.json, and — when the
// private collection export is present locally — against owned quantities and
// printings. CI has no collection file, so ownership checks are skipped there.
//
// Rules enforced (Premier-style construction, see docs/deck-intelligence/):
//   exactly 50 main-deck cards; 1 owned leader; 1 owned base;
//   max 3 copies per card identity; printings must exist and be owned;
//   aspect penalties must be zero (this portfolio's policy);
//   SWUDB export ids must resolve.
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const db = JSON.parse(await readFile(path.join(root, "data", "cards.json"), "utf8"));
const deckFile = JSON.parse(await readFile(path.join(root, "site", "src", "data", "decks.json"), "utf8"));

const collectionPath = ["Master_Collection_(All_cards).txt", "Master_Collection.txt"]
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
    const variant = (fields[idx.variant] || "Standard").trim();
    const card = db.cards[`${set}-${number}`];
    if (!card || !Number.isInteger(count)) continue;
    ownedByIdentity.set(card.identityKey, (ownedByIdentity.get(card.identityKey) || 0) + count);
    const key = `${set}-${number}|${variant}`;
    ownedByPrinting.set(key, (ownedByPrinting.get(key) || 0) + count);
  }
  console.log(`Ownership validation enabled (${collectionPath.split("/").pop()}).`);
} else {
  console.log("No private collection file found; skipping ownership checks (expected in CI).");
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

const rarityWeights = { Common: 15, Uncommon: 35, Special: 50, Rare: 70, Legendary: 100 };
const deckMarketValue = (deck) => deck.cards.reduce((sum, entry) => sum + entry.printings.reduce((printingSum, printing) => {
  const record = db.cards[printing.key];
  const price = record?.printings?.[printing.variant]?.marketPrice
    ?? db.cards[entry.id]?.printings?.Standard?.marketPrice
    ?? 0;
  return printingSum + printing.count * price;
}, 0), 0);
const rarityScore = (deck) => Math.round(deck.cards.reduce(
  (sum, entry) => sum + (rarityWeights[db.cards[entry.id]?.rarity] || 0) * entry.count,
  0,
) / 50);
const cosmetics = (deck) => {
  let copies = 0;
  const kinds = new Set();
  for (const entry of deck.cards) {
    for (const printing of entry.printings) {
      if (printing.variant === "Standard") continue;
      copies += printing.count;
      kinds.add(printing.variant);
    }
  }
  return { copies, kinds: kinds.size };
};

let failures = 0;
const fail = (deck, message) => { failures++; console.error(`  !! ${deck.name}: ${message}`); };

for (const deck of deckFile.decks) {
  console.log(`- ${deck.name}`);
  const leader = db.cards[deck.leader.id];
  const base = db.cards[deck.base.id];
  if (!leader || leader.type !== "Leader") fail(deck, `leader ${deck.leader.id} missing or not a Leader`);
  if (!base || base.type !== "Base") fail(deck, `base ${deck.base.id} missing or not a Base`);
  const icons = leader && base ? [...leader.aspects, ...base.aspects] : [];
  for (const [kind, selection] of [["leader", deck.leader], ["base", deck.base]]) {
    const record = db.cards[selection.printing];
    if (!record || record.identityKey !== selection.id || record.type.toLowerCase() !== kind) {
      fail(deck, `${kind} printing ${selection.printing} does not match ${selection.id}`);
    } else if (!record.printings[selection.variant]) {
      fail(deck, `${kind} variant ${selection.variant} does not exist at ${selection.printing}`);
    } else if (ownedByPrinting && (ownedByPrinting.get(`${selection.printing}|${selection.variant}`) || 0) < 1) {
      fail(deck, `${kind} printing ${selection.printing} ${selection.variant} is not owned`);
    }
  }

  let total = 0;
  for (const entry of deck.cards) {
    const card = db.cards[entry.id];
    if (!card) { fail(deck, `unknown card ${entry.id}`); continue; }
    total += entry.count;
    if (entry.count > 3) fail(deck, `${card.name}: ${entry.count} copies exceeds the limit of 3`);
    const printed = entry.printings.reduce((sum, p) => sum + p.count, 0);
    if (printed !== entry.count) fail(deck, `${card.name}: printings cover ${printed}/${entry.count}`);
    for (const printing of entry.printings) {
      const record = db.cards[printing.key];
      if (!record || record.identityKey !== card.identityKey) fail(deck, `${card.name}: printing key ${printing.key} mismatch`);
      else if (!record.printings[printing.variant]) fail(deck, `${card.name}: variant ${printing.variant} not at ${printing.key}`);
      else if (ownedByPrinting) {
        const owned = ownedByPrinting.get(`${printing.key}|${printing.variant}`) || 0;
        if (printing.count > owned) fail(deck, `${card.name}: ${printing.count}x ${printing.variant} owned only ${owned}`);
      }
    }
    if (ownedByIdentity && entry.count > (ownedByIdentity.get(entry.id) || 0)) {
      fail(deck, `${card.name}: ${entry.count} copies but only ${ownedByIdentity.get(entry.id) || 0} owned`);
    }
    const penalty = aspectPenalty(card.aspects, icons);
    if (penalty > 0) fail(deck, `${card.name}: aspect penalty +${penalty} violates the zero-penalty policy`);
  }
  if (total !== 50) fail(deck, `main deck has ${total} cards, not 50`);
  if (ownedByIdentity) {
    if (!ownedByIdentity.get(deck.leader.id)) fail(deck, "leader not owned");
    if (!ownedByIdentity.get(deck.base.id)) fail(deck, "base not owned");
  }
  // SWUDB export ids resolve back to the same identities
  for (const entry of deck.cards) {
    const [set, number] = entry.id.split("-");
    const roundTrip = `${set}-${Number(number)}`;
    if (!db.cards[roundTrip]) fail(deck, `SWUDB id ${set}_${number.padStart(3, "0")} does not round-trip`);
  }
}

if (deckFile.decks.length !== 15) { failures++; console.error(`!! Expected 15 decks, found ${deckFile.decks.length}`); }
const prestige = deckFile.decks.filter((deck) => deck.special === "prestige");
const showcase = deckFile.decks.filter((deck) => deck.special === "showcase");
if (prestige.length !== 1) { failures++; console.error("!! Exactly one prestige deck required"); }
if (showcase.length !== 1) { failures++; console.error("!! Exactly one showcase deck required"); }
const maxMarketValue = Math.max(...deckFile.decks.map(deckMarketValue), 0);
const derivedScores = deckFile.decks.map((deck) => {
  const marketValue = deckMarketValue(deck);
  const collector = maxMarketValue > 0 ? Math.round(100 * Math.log1p(marketValue) / Math.log1p(maxMarketValue)) : 0;
  const rarity = rarityScore(deck);
  const cosmetic = cosmetics(deck);
  return {
    deck,
    prestige: Math.round(0.45 * deck.scores.gameplay + 0.30 * rarity + 0.25 * collector),
    showcase: Math.round(0.55 * deck.scores.gameplay + 0.30 * (cosmetic.copies / 50) * 100 + 0.15 * (cosmetic.kinds / 3) * 100),
  };
});
const prestigeWinner = derivedScores.reduce((best, item) => item.prestige > best.prestige ? item : best);
const showcaseWinner = derivedScores.reduce((best, item) => item.showcase > best.showcase ? item : best);
if (prestige[0] && prestigeWinner.deck !== prestige[0]) {
  failures++;
  console.error(`!! Prestige badge belongs to ${prestigeWinner.deck.name} (derived score ${prestigeWinner.prestige}), not ${prestige[0].name}`);
}
if (showcase[0] && showcaseWinner.deck !== showcase[0]) {
  failures++;
  console.error(`!! Showcase badge belongs to ${showcaseWinner.deck.name} (derived score ${showcaseWinner.showcase}), not ${showcase[0].name}`);
}

if (failures) {
  console.error(`\n${failures} validation failure(s).`);
  process.exit(1);
}
console.log(`\nAll ${deckFile.decks.length} decks valid${ownedByIdentity ? " (including ownership)" : ""}.`);
