// Rebuilds site/src/data/travel-decks.json as a set-pure roster: the three SOR
// decks keep only SOR cards and the two ASH decks keep only ASH cards. Off-set
// backfills left over from the earlier fair-split allocator are replaced with
// owned on-set substitutes (see ADDITIONS), then every main-deck entry is
// re-allocated physical printings fanciest-first (Prestige Foil > Prestige >
// Hyperspace Foil > Hyperspace > Standard Foil > Standard), leaders and bases
// keep their current printings, and the result is checked for legality
// (50 cards, zero aspect penalty, three-copy title limit, ownership at both the
// identity and printing level) before the file is written.
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const db = JSON.parse(await readFile(path.join(root, "data", "cards.json"), "utf8"));
const travel = JSON.parse(await readFile(path.join(root, "site", "src", "data", "travel-decks.json"), "utf8"));

// Each travel deck may only contain cards from its leader's set.
const SET_PREFIX = {
  "travel-phoenix-ignition": "SOR",
  "travel-bounty-compound-interest": "SOR",
  "travel-two-fronts-one-rebellion": "SOR",
  "travel-dead-mans-sightline": "ASH",
  "travel-twin-suns-resurgence": "ASH",
};

// Owned on-set substitutes for the off-set cards each deck loses, chosen to
// match the removed card's cost, type, and role. One entry per copy; any
// record key of the identity works (reprints resolve to the base identity).
const ADDITIONS = {
  // Sabine loses 10 ASH cards (3x c1, 3x c2, 1x c3, 2x c4, 1x c5): cheap
  // aggressive bodies back in, cost-for-cost where the shared SOR pool allows.
  "travel-phoenix-ignition": [
    "SOR-150", // Heroic Sacrifice (c1 event) <- Follow Me
    "SOR-157", // Cantina Braggart (c1 unit) <- Alamite Hunter
    "SOR-123", // Recruit (c1 event) <- Inspired Recruit
    "SOR-159", "SOR-159", // Partisan Insurgent (c2 Rebel) <- Greef Karga x2
    "SOR-111", // Patrolling V-Wing (c2) <- Warrior of Clan Kryze
    "SOR-162", // Disabling Fang Fighter (c3 Mandalorian) <- Lang
    "SOR-99", // Bright Hope (c4 Rebel) <- Han Solo
    "SOR-244", // Snowspeeder (c5 Rebel) <- Shydopp Pirate Skiff
    "SOR-101", // Rogue Squadron Skirmisher (c6 Rebel) <- Fang Fighter Squadron
  ],
  // Leia loses 9 ASH cards (c1, 3x c2, 3x c3, c4, c5): Rebel-trait substitutes
  // first, because her leader action needs Rebel attackers.
  "travel-two-fronts-one-rebellion": [
    "SOR-123", // Recruit (c1 event) <- LEP Ratcatcher
    "SOR-238", // C-3PO #3 (c2 Rebel) <- Covert Veteran
    "SOR-159", // Partisan Insurgent (c2 Rebel) <- Imperial Defector
    "SOR-96", // Mon Mothma (c2 Rebel tutor) <- Warrior of Clan Kryze
    "SOR-162", // Disabling Fang Fighter (c3) <- Axe Woves
    "SOR-112", // Consortium StarViper (c3, SOR original) <- Clan Wren Loyalist
    "SOR-246", // You're My Only Hope (c3 Rebel payoff) <- ASH Consortium StarViper
    "SOR-99", // Bright Hope (c4 Rebel) <- Survivors' Langskib
    "SOR-244", // Snowspeeder #3 (c5 Rebel) <- Fang Fighter Squadron
  ],
  // Cad Bane loses 30 SOR cards; becomes a mono-ASH attrition homebrew:
  // Imperial/Villainy bodies, Advantage-token tricks, and combat punishment
  // that pairs with his ping.
  "travel-dead-mans-sightline": [
    "ASH-164", // Alamite Hunter (c1)
    "ASH-237", // Mouse Droid (c1, discounts Imperials)
    "ASH-184", // Follow Me (c1 attack trick, Advantage)
    "ASH-180", // Bokken Saber (c1 upgrade, Advantage)
    "ASH-181", // Mark My Words (c1 upgrade, Overwhelm on damaged units)
    "ASH-85", // Grav Charge (c1 attack deterrent)
    "ASH-264", // A New Order (c1, two Advantage tokens)
    "ASH-167", "ASH-167", // Flarestar Attack Shuttle (c2 Underworld, Advantage)
    "ASH-238", "ASH-238", // Attendant Navigator (c2, Advantage)
    "ASH-239", // Imperial Loyalist (c2 Sentinel)
    "ASH-185", "ASH-185", // Intimidation (c2 draw)
    "ASH-73", // Palace Chef Droid (c2 Sentinel)
    "ASH-86", // Durasteel Plating (c2 Shield upgrade)
    "ASH-169", // Axe Woves (c3, Advantage on draw)
    "ASH-171", "ASH-171", // Pegasus Tri-Wing (c3, readies off friendly upgrades)
    "ASH-74", // Mos Eisley Modifier (c3 Support)
    "ASH-91", // Buy Time (c3 token Sentinel)
    "ASH-87", // Cybernetic Enhancements (c3 cantrip upgrade)
    "ASH-88", // The Conflict Within (c3 lockdown upgrade)
    "ASH-173", // Shydopp Pirate Skiff (c4 Saboteur)
    "ASH-188", "ASH-188", // Galvanized Leap (c4 ready trick) -> 3 total
    "ASH-174", // StarFortress Heavy Bomber (c5 removal body)
    "ASH-80", // Covert Believers (c5, Mandalorian token)
    "ASH-82", // Trexler Armored Marauder (c6 Shield)
    "ASH-552", // Morgan Elsbeth (c6 Support)
  ],
  // Luke loses 23 SOR cards; becomes a mono-ASH healing/Mandalorian midrange
  // homebrew built around his leader's heal-on-attack engine.
  "travel-twin-suns-resurgence": [
    "ASH-333", // Noti Nomad (c1 Shielded)
    "ASH-259", // LEP Ratcatcher (c1 ping)
    "ASH-85", // Grav Charge (c1 attack deterrent)
    "ASH-249", // Covert Veteran (c2 Hidden)
    "ASH-250", // Imperial Defector (c2 hand knowledge)
    "ASH-120", "ASH-120", // Warrior of Clan Kryze (c2 Mandalorian)
    "ASH-119", // Greef Karga (c2 Mandalorian tokens)
    "ASH-136", // Display of Strength (c2 combat trick)
    "ASH-263", // The Way of the Mand'alor (c2 Mandalorian upgrade)
    "ASH-260", // Mos Espa Watermonger (c2 looting)
    "ASH-107", // Clan Wren Loyalist (c3 trait tutor)
    "ASH-58", // Duchess's Protector (c3 Mandalorian token)
    "ASH-138", "ASH-138", // Turning the Tide (c3 go-wide removal)
    "ASH-123", // Lang (c3 repeatable burn)
    "ASH-61", // Strike Team Vanguard (c4 Rebel body)
    "ASH-126", // Survivors' Langskib (c4 Sentinel)
    "ASH-140", // Stronger Together (c4 two Mandalorian tokens)
    "ASH-256", // Rebel Infiltrators (c5 Restore/Saboteur)
    "ASH-130", // Fang Fighter Squadron (c5 Mandalorian Support)
    "ASH-111", // Children of the Watch (c6 two Mandalorian tokens)
    "ASH-29", // Scorpenek Annihilator Droid (c6 Sentinel/Overwhelm closer)
  ],
};

// The two ASH decks are mono-ASH homebrews now; their one-line identity text
// should say what they actually are.
const IDENTITY_UPDATES = {
  "travel-dead-mans-sightline":
    "Cad's repeatable one-damage ping finishes wounded units and changes every combat calculation; an all-ASH shell of Imperial bodies, Advantage tricks, and attack punishment keeps every fight on his terms.",
  "travel-twin-suns-resurgence":
    "Luke converts every attack into durability; an all-ASH shell of Mandalorian tokens, Sentinels, and restore units wins repeated combats before the capital ships close out the game.",
};

const VARIANT_RANK = {
  "Prestige Foil": 6,
  Prestige: 5,
  "Hyperspace Foil": 4,
  Hyperspace: 3,
  "Standard Foil": 2,
  Standard: 1,
};

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

// Owned physical printings: identity -> [{ key, variant, count }].
const ownedByIdentity = new Map();
const lines = (await readFile(path.join(root, "data", "collection.txt"), "utf8")).split(/\r?\n/).filter((l) => l.trim());
const header = parseCsvLine(lines[0].replace(/^#\s*/, "")).map((h) => h.trim().toLowerCase());
const idx = Object.fromEntries(header.map((h, i) => [h, i]));
for (const line of lines.slice(1)) {
  const fields = parseCsvLine(line);
  const key = `${fields[idx.set].trim().toUpperCase()}-${Number(fields[idx.number])}`;
  const record = db.cards[key];
  if (!record) continue;
  let variant = (fields[idx.variant] || "Standard").trim();
  if (variant === "Foil Prestige") variant = "Prestige Foil";
  if (!VARIANT_RANK[variant]) throw new Error(`Unknown variant "${variant}" at ${key}`);
  if (!record.printings[variant]) throw new Error(`Collection has ${key} ${variant}, not a real printing`);
  const count = Number(fields[idx.count]);
  const list = ownedByIdentity.get(record.identityKey) || [];
  const existing = list.find((p) => p.key === key && p.variant === variant);
  if (existing) existing.count += count; else list.push({ key, variant, count });
  ownedByIdentity.set(record.identityKey, list);
}

const identityOf = (id) => {
  const record = db.cards[id];
  if (!record) throw new Error(`Unknown card ${id}`);
  return record.identityKey;
};

const aspectPenalty = (cardAspects, icons) => {
  const pool = [...icons];
  let missing = 0;
  for (const aspect of cardAspects) {
    const at = pool.indexOf(aspect);
    if (at >= 0) pool.splice(at, 1); else missing++;
  }
  return missing * 2;
};

// Apply removals (every off-set entry) and additions, then validate counts.
const removed = {};
for (const deck of travel.roster) {
  const prefix = SET_PREFIX[deck.id];
  const keep = [];
  for (const entry of deck.cards) {
    if (identityOf(entry.id).startsWith(`${prefix}-`)) keep.push({ id: identityOf(entry.id), count: entry.count });
    else removed[deck.id] = [...(removed[deck.id] || []), ...Array(entry.count).fill(entry.id)];
  }
  for (const added of ADDITIONS[deck.id] || []) {
    const id = identityOf(added);
    if (!id.startsWith(`${prefix}-`)) throw new Error(`${deck.name}: addition ${added} is not ${prefix}`);
    const existing = keep.find((e) => e.id === id);
    if (existing) existing.count += 1; else keep.push({ id, count: 1 });
  }
  deck.cards = keep;
  if (IDENTITY_UPDATES[deck.id]) deck.identity = IDENTITY_UPDATES[deck.id];
}

// Legality checks before any printing allocation.
const rosterIdentityUse = new Map();
const addIdentityUse = (id, n) => rosterIdentityUse.set(id, (rosterIdentityUse.get(id) || 0) + n);
const problems = [];
for (const deck of travel.roster) {
  const prefix = SET_PREFIX[deck.id];
  const leader = db.cards[deck.leader.id];
  const base = db.cards[deck.base.id];
  const icons = [...leader.aspects, ...base.aspects];
  addIdentityUse(deck.leader.id, 1);
  addIdentityUse(deck.base.id, 1);
  let total = 0;
  const titles = new Map();
  for (const entry of deck.cards) {
    const card = db.cards[entry.id];
    total += entry.count;
    addIdentityUse(entry.id, entry.count);
    if (!entry.id.startsWith(`${prefix}-`)) problems.push(`${deck.name}: ${entry.id} breaks ${prefix} purity`);
    if (aspectPenalty(card.aspects, icons) > 0) problems.push(`${deck.name}: ${card.name} incurs an aspect penalty`);
    const title = `${card.name}|${card.subtitle}`;
    titles.set(title, (titles.get(title) || 0) + entry.count);
  }
  for (const [title, count] of titles) {
    if (count > 3) problems.push(`${deck.name}: ${title.split("|")[0]} x${count} exceeds the copy limit`);
  }
  if (total !== 50) problems.push(`${deck.name}: ${total} cards, not 50`);
}
for (const [id, used] of rosterIdentityUse) {
  const owned = (ownedByIdentity.get(id) || []).reduce((s, p) => s + p.count, 0);
  if (used > owned) problems.push(`Roster over-allocates ${db.cards[id]?.name || id}: uses ${used}, owns ${owned}`);
}
if (problems.length) {
  for (const p of problems) console.error(`!! ${p}`);
  process.exit(1);
}

// Printing allocation: leaders/bases keep their current physical copies; every
// main-deck copy draws from the fanciest remaining owned printing, decks in
// roster order, so no premium copy sits unused behind an allocated Standard.
const remaining = new Map();
for (const [id, list] of ownedByIdentity) {
  remaining.set(id, list.map((p) => ({ ...p })).sort((a, b) => VARIANT_RANK[b.variant] - VARIANT_RANK[a.variant] || a.key.localeCompare(b.key)));
}
for (const deck of travel.roster) {
  for (const sel of [deck.leader, deck.base]) {
    const list = remaining.get(sel.id);
    const printing = list?.find((p) => p.key === sel.printing && p.variant === sel.variant && p.count > 0);
    if (!printing) throw new Error(`${deck.name}: fixed ${sel.printing} ${sel.variant} not owned`);
    printing.count -= 1;
  }
}
for (const deck of travel.roster) {
  for (const entry of deck.cards) {
    const list = remaining.get(entry.id) || [];
    let need = entry.count;
    const assigned = [];
    for (const printing of list) {
      if (need === 0) break;
      const take = Math.min(need, printing.count);
      if (take > 0) { assigned.push({ key: printing.key, variant: printing.variant, count: take }); printing.count -= take; need -= take; }
    }
    if (need > 0) throw new Error(`${deck.name}: not enough owned printings of ${db.cards[entry.id].name}`);
    entry.printings = assigned;
  }
  // Match the established ordering: events, units, upgrades; each by cost.
  const typeRank = { Event: 0, Unit: 1, Upgrade: 2 };
  deck.cards.sort((a, b) =>
    typeRank[db.cards[a.id].type] - typeRank[db.cards[b.id].type] ||
    (db.cards[a.id].cost ?? 0) - (db.cards[b.id].cost ?? 0) ||
    db.cards[a.id].name.localeCompare(db.cards[b.id].name));
}

// Report the swaps for review.
for (const deck of travel.roster) {
  const gone = removed[deck.id] || [];
  if (!gone.length && !(ADDITIONS[deck.id] || []).length) { console.log(`- ${deck.name}: unchanged`); continue; }
  console.log(`- ${deck.name}: removed ${gone.length}, added ${(ADDITIONS[deck.id] || []).length}`);
}

travel.generatedAt = new Date().toISOString().slice(0, 10);
await writeFile(path.join(root, "site", "src", "data", "travel-decks.json"), JSON.stringify(travel, null, 1) + "\n");
console.log("Wrote site/src/data/travel-decks.json");
