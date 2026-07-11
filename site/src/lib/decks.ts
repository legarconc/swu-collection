import type { CardDatabase, CardRecord, CollectionEntry } from "../types";

export interface DeckPrinting {
  key: string;
  variant: string;
  count: number;
}

export interface DeckCard {
  id: string; // identity key, e.g. "SOR-95"
  count: number;
  printings: DeckPrinting[];
}

export interface DeckCombo {
  cards: string[];
  note: string;
}

export interface DeckGuide {
  winCondition: string;
  earlyGame: string;
  midGame: string;
  lateGame: string;
  openingPriorities: string[];
  mulligan: string[];
  combos: DeckCombo[];
  resourcePriorities: string[];
  weaknesses: string[];
  adjustments: string[];
  acquisitions: string[];
}

export interface DeckScores {
  gameplay: number;
}

export interface DerivedDeckScores extends DeckScores {
  rarity: number;
  collector: number;
  prestige: number;
  cosmeticCopies: number;
  cosmeticVariety: number;
  showcase: number;
  marketValue: number;
}

export interface Deck {
  id: string;
  name: string;
  special: "prestige" | "showcase" | null;
  archetype: string;
  secondary?: string;
  powerBand: string;
  difficulty: string;
  leader: { id: string; printing: string; variant: string };
  base: { id: string; printing: string; variant: string };
  aspects: string[];
  cards: DeckCard[];
  identity: string;
  spacePolicy: string;
  guide: DeckGuide;
  scores: DeckScores;
}

export interface DeckFile {
  generatedAt: string;
  formatLabel: string;
  premierLegal: boolean;
  notes: string;
  decks: Deck[];
}

/** Multiset aspect matching: each icon on a card must be covered by a distinct leader/base icon. */
export function aspectPenalty(cardAspects: string[], icons: string[]): number {
  const pool = [...icons];
  let missing = 0;
  for (const aspect of cardAspects) {
    const at = pool.indexOf(aspect);
    if (at >= 0) pool.splice(at, 1);
    else missing++;
  }
  return missing * 2;
}

export interface DeckValidation {
  errors: string[];
  penalized: Array<{ id: string; name: string; penalty: number }>;
  total: number;
}

export function validateDeck(deck: Deck, database: CardDatabase): DeckValidation {
  const errors: string[] = [];
  const penalized: DeckValidation["penalized"] = [];
  const leader = database.cards[deck.leader.id];
  const base = database.cards[deck.base.id];
  if (!leader) errors.push(`Unknown leader ${deck.leader.id}`);
  else if (leader.type !== "Leader") errors.push(`${leader.name} is not a Leader`);
  if (!base) errors.push(`Unknown base ${deck.base.id}`);
  else if (base.type !== "Base") errors.push(`${base.name} is not a Base`);
  for (const [kind, selection] of [["leader", deck.leader], ["base", deck.base]] as const) {
    const record = database.cards[selection.printing];
    if (!record || record.identityKey !== selection.id || record.type.toLowerCase() !== kind) {
      errors.push(`${kind} printing ${selection.printing} does not match ${selection.id}`);
    } else if (!record.printings[selection.variant]) {
      errors.push(`${kind} variant ${selection.variant} does not exist at ${selection.printing}`);
    }
  }
  const icons = leader && base ? [...leader.aspects, ...base.aspects] : [];

  let total = 0;
  for (const entry of deck.cards) {
    const card = database.cards[entry.id];
    if (!card) { errors.push(`Unknown card ${entry.id}`); continue; }
    total += entry.count;
    if (entry.count < 1 || entry.count > 3) errors.push(`${card.name}: ${entry.count} copies (limit is 3)`);
    const printed = entry.printings.reduce((sum, p) => sum + p.count, 0);
    if (printed !== entry.count) errors.push(`${card.name}: printings cover ${printed} of ${entry.count} copies`);
    for (const printing of entry.printings) {
      const record = database.cards[printing.key];
      if (!record || record.identityKey !== card.identityKey) {
        errors.push(`${card.name}: printing ${printing.key} does not match this card`);
      } else if (!record.printings[printing.variant]) {
        errors.push(`${card.name}: no ${printing.variant} printing at ${printing.key}`);
      }
    }
    if (leader && base) {
      const penalty = aspectPenalty(card.aspects, icons);
      if (penalty > 0) penalized.push({ id: entry.id, name: card.name, penalty });
    }
  }
  if (total !== 50) errors.push(`Main deck has ${total} cards; exactly 50 required`);
  return { errors, penalized, total };
}

export interface DeckStats {
  curve: Array<{ bucket: string; count: number }>;
  types: Record<string, number>;
  arenas: Record<string, number>;
  earlyUnits: number;
}

const CURVE_BUCKETS = ["0-1", "2", "3", "4", "5", "6", "7+"];

export function deckStats(deck: Deck, database: CardDatabase): DeckStats {
  const curve = Object.fromEntries(CURVE_BUCKETS.map((b) => [b, 0]));
  const types: Record<string, number> = {};
  const arenas: Record<string, number> = { Ground: 0, Space: 0 };
  let earlyUnits = 0;
  for (const entry of deck.cards) {
    const card = database.cards[entry.id];
    if (!card) continue;
    const cost = card.cost ?? 0;
    const bucket = cost <= 1 ? "0-1" : cost >= 7 ? "7+" : String(cost);
    curve[bucket] += entry.count;
    types[card.type] = (types[card.type] || 0) + entry.count;
    if (card.type === "Unit") {
      for (const arena of card.arena) arenas[arena] = (arenas[arena] || 0) + entry.count;
      if (cost <= 2) earlyUnits += entry.count;
    }
  }
  return { curve: CURVE_BUCKETS.map((bucket) => ({ bucket, count: curve[bucket] })), types, arenas, earlyUnits };
}

const swudbId = (identityKey: string) => {
  const [set, number] = identityKey.split("-");
  return `${set}_${number.padStart(3, "0")}`;
};

/** SWUDB-compatible deck JSON (import format used by swudb.com and tournament tools). */
export function swudbDeckJson(deck: Deck): string {
  return JSON.stringify(
    {
      leader: { id: swudbId(deck.leader.id), count: 1 },
      base: { id: swudbId(deck.base.id), count: 1 },
      deck: deck.cards.map((entry) => ({ id: swudbId(entry.id), count: entry.count })),
      sideboard: [],
    },
    null,
    2,
  );
}

/** How much of this deck the on-device collection already covers. */
export interface CollectionCoverage {
  owned: number;
  leaderOwned: boolean;
  baseOwned: boolean;
  complete: boolean;
  missing: Array<{ card: CardRecord; short: number; variant: string; kind: "main" | "leader" | "base" }>;
}

export function collectionCoverage(deck: Deck, entries: CollectionEntry[], database: CardDatabase): CollectionCoverage {
  const ownedByPrinting = new Map<string, number>();
  for (const entry of entries) {
    const card = database.cards[`${entry.set}-${entry.number}`];
    if (!card) continue;
    const key = `${card.key}|${entry.variant}`;
    ownedByPrinting.set(key, (ownedByPrinting.get(key) || 0) + entry.count);
  }
  let owned = 0;
  const missing: CollectionCoverage["missing"] = [];
  for (const deckCard of deck.cards) {
    for (const printing of deckCard.printings) {
      const have = ownedByPrinting.get(`${printing.key}|${printing.variant}`) || 0;
      owned += Math.min(printing.count, have);
      if (have < printing.count) {
        const card = database.cards[deckCard.id];
        if (card) missing.push({ card, short: printing.count - have, variant: printing.variant, kind: "main" });
      }
    }
  }
  const checkFeatured = (selection: Deck["leader"], kind: "leader" | "base") => {
    const have = ownedByPrinting.get(`${selection.printing}|${selection.variant}`) || 0;
    if (have > 0) return true;
    const card = database.cards[selection.id];
    if (card) missing.push({ card, short: 1, variant: selection.variant, kind });
    return false;
  };
  const leaderOwned = checkFeatured(deck.leader, "leader");
  const baseOwned = checkFeatured(deck.base, "base");
  return { owned, leaderOwned, baseOwned, complete: owned === 50 && leaderOwned && baseOwned, missing };
}

/** Prestige score per the documented model: 45% gameplay, 30% rarity, 25% collector. */
export function prestigeScore(scores: Pick<DerivedDeckScores, "gameplay" | "rarity" | "collector">): number {
  return Math.round(0.45 * scores.gameplay + 0.30 * scores.rarity + 0.25 * scores.collector);
}

/** Showcase score: 55% deck quality, 30% cosmetic density, 15% cosmetic variety. */
export function showcaseScore(gameplay: number, cosmeticCopies: number, varietyKinds: number): number {
  return Math.round(0.55 * gameplay + 0.30 * (cosmeticCopies / 50) * 100 + 0.15 * (varietyKinds / 3) * 100);
}

const RARITY_WEIGHTS: Record<string, number> = { Common: 15, Uncommon: 35, Special: 50, Rare: 70, Legendary: 100 };

export function rarityScore(deck: Deck, database: CardDatabase): number {
  const weighted = deck.cards.reduce((sum, entry) => sum + (RARITY_WEIGHTS[database.cards[entry.id]?.rarity] || 0) * entry.count, 0);
  return Math.round(weighted / 50);
}

export function deckMarketValue(deck: Deck, database: CardDatabase): number {
  return deck.cards.reduce((sum, entry) => sum + entry.printings.reduce((printingSum, printing) => {
    const record = database.cards[printing.key];
    const price = record?.printings[printing.variant]?.marketPrice
      ?? database.cards[entry.id]?.printings.Standard?.marketPrice
      ?? 0;
    return printingSum + printing.count * price;
  }, 0), 0);
}

export function derivedDeckScores(deck: Deck, database: CardDatabase, portfolio: Deck[]): DerivedDeckScores {
  const marketValue = deckMarketValue(deck, database);
  const maxMarketValue = Math.max(...portfolio.map((item) => deckMarketValue(item, database)), 0);
  const collector = maxMarketValue > 0 ? Math.round(100 * Math.log1p(marketValue) / Math.log1p(maxMarketValue)) : 0;
  let cosmeticCopies = 0;
  const cosmeticKinds = new Set<string>();
  for (const entry of deck.cards) {
    for (const printing of entry.printings) {
      if (printing.variant === "Standard") continue;
      cosmeticCopies += printing.count;
      cosmeticKinds.add(printing.variant);
    }
  }
  const scores: DerivedDeckScores = {
    gameplay: deck.scores.gameplay,
    rarity: rarityScore(deck, database),
    collector,
    prestige: 0,
    cosmeticCopies,
    cosmeticVariety: cosmeticKinds.size,
    showcase: showcaseScore(deck.scores.gameplay, cosmeticCopies, cosmeticKinds.size),
    marketValue,
  };
  scores.prestige = prestigeScore(scores);
  return scores;
}
