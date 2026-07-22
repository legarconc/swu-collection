import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { CardDatabase } from "../types";
import {
  aspectPenalty, collectionCoverage, deckStats, derivedDeckScores, prestigeScore, rarityScore, showcaseScore,
  swudbDeckJson, validateDeck, type Deck, type DeckFile,
} from "./decks";
import deckFileJson from "../data/decks.json";

const printing = (variant: string, apiNumber: string) =>
  ({ variant, apiNumber, image: `${apiNumber}.png`, backImage: null, marketPrice: null, raw: {} });

const unit = (key: string, over: Partial<CardDatabase["cards"][string]> = {}) => ({
  key, set: "SOR", number: Number(key.split("-")[1]), name: `Card ${key}`, subtitle: "", type: "Unit",
  aspects: ["Command"], cost: 2, power: 2, hp: 2, traits: [], rarity: "Common", text: "",
  arena: ["Ground"], images: { front: "x.png", back: null }, defaultVariant: "Standard",
  identityKey: key, printings: { Standard: printing("Standard", key.split("-")[1]) },
  ...over,
});

const fixtureDb: CardDatabase = {
  generatedAt: "2026-01-01", source: "test", sets: [{ code: "SOR", cardRecords: 6, setSize: 6 }], cardCount: 6,
  cards: {
    "SOR-1": unit("SOR-1", { type: "Leader", aspects: ["Command", "Villainy"], name: "Test Leader" }),
    "SOR-20": unit("SOR-20", { type: "Base", aspects: ["Aggression"], name: "Test Base", cost: null, power: null, hp: 30, arena: [] }),
    "SOR-100": unit("SOR-100", { name: "Filler", printings: { Standard: printing("Standard", "100"), "Standard Foil": printing("Standard Foil", "100F") } }),
    "SOR-101": unit("SOR-101", { name: "Villain Ship", aspects: ["Command", "Villainy"], type: "Unit", arena: ["Space"], cost: 6 }),
    "SOR-102": unit("SOR-102", { name: "Off Aspect", aspects: ["Vigilance"] }),
    "SOR-103": unit("SOR-103", { name: "Double Command", aspects: ["Command", "Command"], type: "Event", arena: [], cost: 4 }),
  },
};

const makeDeck = (cards: Deck["cards"]): Deck => ({
  id: "test", name: "Test Deck", special: null, archetype: "Midrange", powerBand: "Strong", difficulty: "Beginner",
  leader: { id: "SOR-1", printing: "SOR-1", variant: "Standard" },
  base: { id: "SOR-20", printing: "SOR-20", variant: "Standard" },
  aspects: ["Command", "Villainy", "Aggression"], cards,
  identity: "", spacePolicy: "",
  guide: { winCondition: "", earlyGame: "", midGame: "", lateGame: "", openingPriorities: [], mulligan: [], combos: [], resourcePriorities: [], weaknesses: [], adjustments: [], acquisitions: [] },
  scores: { gameplay: 70 },
});

const entry = (id: string, count: number): Deck["cards"][number] =>
  ({ id, count, printings: [{ key: id, variant: "Standard", count }] });

const fill = (total: number) => {
  // spread `total` copies over enough distinct filler ids at <=3 each
  const cards: Deck["cards"] = [];
  let remaining = total;
  let n = 200;
  while (remaining > 0) {
    const take = Math.min(3, remaining);
    const id = `SOR-${n++}`;
    (fixtureDb.cards as Record<string, unknown>)[id] = unit(id, { name: `Filler ${id}` });
    cards.push(entry(id, take));
    remaining -= take;
  }
  return cards;
};

describe("deck validation", () => {
  it("accepts a valid 50-card deck", () => {
    const result = validateDeck(makeDeck(fill(50)), fixtureDb);
    expect(result.errors).toEqual([]);
    expect(result.total).toBe(50);
    expect(result.penalized).toEqual([]);
  });

  it("rejects too few and too many cards", () => {
    expect(validateDeck(makeDeck(fill(49)), fixtureDb).errors.join()).toMatch(/49 cards/);
    expect(validateDeck(makeDeck(fill(51)), fixtureDb).errors.join()).toMatch(/51 cards/);
  });

  it("rejects more than three copies", () => {
    const deck = makeDeck([...fill(46), { id: "SOR-100", count: 4, printings: [{ key: "SOR-100", variant: "Standard", count: 4 }] }]);
    expect(validateDeck(deck, fixtureDb).errors.join()).toMatch(/4 copies/);
  });

  it("rejects a missing leader or base and unknown cards", () => {
    const deck = { ...makeDeck(fill(50)), leader: { id: "SOR-999", printing: "SOR-999", variant: "Standard" } };
    expect(validateDeck(deck, fixtureDb).errors.join()).toMatch(/Unknown leader/);
    const noBase = { ...makeDeck(fill(50)), base: { id: "SOR-100", printing: "SOR-100", variant: "Standard" } };
    expect(validateDeck(noBase, fixtureDb).errors.join()).toMatch(/not a Base/);
    const ghost = makeDeck([...fill(47), entry("SOR-998", 3)]);
    expect(validateDeck(ghost, fixtureDb).errors.join()).toMatch(/Unknown card SOR-998/);
  });

  it("rejects invalid leader and base printings or variants", () => {
    const wrongLeaderPrinting = { ...makeDeck(fill(50)), leader: { id: "SOR-1", printing: "SOR-100", variant: "Standard" } };
    expect(validateDeck(wrongLeaderPrinting, fixtureDb).errors.join()).toMatch(/leader printing/);
    const wrongBaseVariant = { ...makeDeck(fill(50)), base: { id: "SOR-20", printing: "SOR-20", variant: "Hyperspace" } };
    expect(validateDeck(wrongBaseVariant, fixtureDb).errors.join()).toMatch(/base variant Hyperspace/);
  });

  it("rejects printings that do not exist or mismatch the identity", () => {
    const wrongVariant = makeDeck([...fill(47), { id: "SOR-100", count: 3, printings: [{ key: "SOR-100", variant: "Hyperspace", count: 3 }] }]);
    expect(validateDeck(wrongVariant, fixtureDb).errors.join()).toMatch(/no Hyperspace printing/);
    const shortSplit = makeDeck([...fill(47), { id: "SOR-100", count: 3, printings: [{ key: "SOR-100", variant: "Standard", count: 2 }] }]);
    expect(validateDeck(shortSplit, fixtureDb).errors.join()).toMatch(/printings cover 2 of 3/);
  });

  it("flags aspect penalties with multiset icon matching", () => {
    // icons: Command, Villainy, Aggression
    expect(aspectPenalty(["Command", "Villainy"], ["Command", "Villainy", "Aggression"])).toBe(0);
    expect(aspectPenalty(["Vigilance"], ["Command", "Villainy", "Aggression"])).toBe(2);
    expect(aspectPenalty(["Command", "Command"], ["Command", "Villainy", "Aggression"])).toBe(2);
    expect(aspectPenalty(["Vigilance", "Vigilance"], ["Command", "Villainy", "Aggression"])).toBe(4);
    const deck = makeDeck([...fill(44), entry("SOR-102", 3), entry("SOR-103", 3)]);
    const result = validateDeck(deck, fixtureDb);
    expect(result.errors).toEqual([]);
    expect(result.penalized).toEqual([
      { id: "SOR-102", name: "Off Aspect", penalty: 2 },
      { id: "SOR-103", name: "Double Command", penalty: 2 },
    ]);
  });
});

describe("deck stats and export", () => {
  it("computes curve, types, arenas and early units", () => {
    const deck = makeDeck([...fill(44), entry("SOR-101", 3), entry("SOR-103", 3)]);
    const stats = deckStats(deck, fixtureDb);
    expect(stats.curve.find((c) => c.bucket === "2")?.count).toBe(44);
    expect(stats.curve.find((c) => c.bucket === "6")?.count).toBe(3);
    expect(stats.types).toMatchObject({ Unit: 47, Event: 3 });
    expect(stats.arenas).toMatchObject({ Ground: 44, Space: 3 });
    expect(stats.earlyUnits).toBe(44);
  });

  it("produces SWUDB-format JSON with padded ids", () => {
    const deck = makeDeck([...fill(47), entry("SOR-101", 3)]);
    const parsed = JSON.parse(swudbDeckJson(deck));
    expect(Object.keys(parsed).sort()).toEqual(["base", "deck", "leader", "sideboard"]);
    expect(parsed.leader).toEqual({ id: "SOR_001", count: 1 });
    expect(parsed.base).toEqual({ id: "SOR_020", count: 1 });
    expect(parsed.sideboard).toEqual([]);
    expect(parsed.deck.find((row: { id: string }) => row.id === "SOR_101")).toEqual({ id: "SOR_101", count: 3 });
    const total = parsed.deck.reduce((sum: number, row: { count: number }) => sum + row.count, 0);
    expect(total).toBe(50);
  });

  it("reports exact-printing coverage plus leader and base ownership", () => {
    const deck = makeDeck([...fill(47), { id: "SOR-100", count: 3, printings: [{ key: "SOR-100", variant: "Standard Foil", count: 3 }] }]);
    const owned = [
      { set: "SOR", number: 1, variant: "Standard", count: 1 },
      { set: "SOR", number: 20, variant: "Standard", count: 1 },
      { set: "SOR", number: 100, variant: "Standard", count: 3 },
      { set: "SOR", number: 100, variant: "Standard Foil", count: 1 },
    ];
    const coverage = collectionCoverage(deck, owned, fixtureDb);
    expect(coverage.owned).toBe(1);
    expect(coverage.leaderOwned).toBe(true);
    expect(coverage.baseOwned).toBe(true);
    expect(coverage.complete).toBe(false);
    expect(coverage.missing.find((m) => m.card.key === "SOR-100" && m.variant === "Standard Foil")?.short).toBe(2);
  });
});

describe("scoring", () => {
  it("applies the documented prestige weights (45/30/25)", () => {
    expect(prestigeScore({ gameplay: 100, rarity: 100, collector: 100 })).toBe(100);
    expect(prestigeScore({ gameplay: 80, rarity: 28, collector: 8 })).toBe(46);
  });

  it("applies the documented showcase weights (55/30/15)", () => {
    expect(showcaseScore(100, 50, 3)).toBe(100);
    expect(showcaseScore(70, 13, 3)).toBe(61);
  });

  it("derives rarity, collector, cosmetic, and weighted scores from deck data", () => {
    const deck = makeDeck([...fill(47), { id: "SOR-100", count: 3, printings: [{ key: "SOR-100", variant: "Standard Foil", count: 3 }] }]);
    expect(rarityScore(deck, fixtureDb)).toBe(15);
    const scores = derivedDeckScores(deck, fixtureDb, [deck]);
    expect(scores.gameplay).toBe(70);
    expect(scores.cosmeticCopies).toBe(3);
    expect(scores.cosmeticVariety).toBe(1);
    expect(scores.rarity).toBe(15);
    expect(scores.prestige).toBe(prestigeScore(scores));
    expect(scores.showcase).toBe(showcaseScore(70, 3, 1));
  });
});

describe("shipped deck portfolio", () => {
  const deckFile = deckFileJson as DeckFile;
  const realDb: CardDatabase = JSON.parse(
    readFileSync(path.resolve(__dirname, "../../../data/cards.json"), "utf8"),
  );

  it("contains the declared deck portfolio with one prestige and one showcase", () => {
    expect(deckFile.expectedDeckCount).toBe(30);
    expect(deckFile.decks).toHaveLength(deckFile.expectedDeckCount);
    expect(deckFile.decks.filter((deck) => deck.leader.id.startsWith("ASH-"))).toHaveLength(15);
    expect(deckFile.decks.filter((deck) => deck.special === "prestige")).toHaveLength(1);
    expect(deckFile.decks.filter((deck) => deck.special === "showcase")).toHaveLength(1);
    expect(deckFile.premierLegal).toBe(false);
  });

  it("every shipped deck passes validation with zero aspect penalties", () => {
    for (const deck of deckFile.decks) {
      const result = validateDeck(deck, realDb);
      expect(result.errors, deck.name).toEqual([]);
      expect(result.penalized, deck.name).toEqual([]);
      expect(result.total, deck.name).toBe(50);
    }
  });

  it("every shipped deck exports valid SWUDB JSON that round-trips identity counts", () => {
    for (const deck of deckFile.decks) {
      const parsed = JSON.parse(swudbDeckJson(deck));
      const exported = new Map(parsed.deck.map((row: { id: string; count: number }) => [row.id, row.count]));
      for (const entry of deck.cards) {
        const [set, number] = entry.id.split("-");
        expect(exported.get(`${set}_${number.padStart(3, "0")}`), `${deck.name}: ${entry.id}`).toBe(entry.count);
      }
      expect(parsed.deck.reduce((sum: number, row: { count: number }) => sum + row.count, 0)).toBe(50);
    }
  });

  it("derives the prestige and showcase winners from actual deck contents", () => {
    const scores = deckFile.decks.map((deck) => ({ deck, scores: derivedDeckScores(deck, realDb, deckFile.decks) }));
    const prestige = scores.reduce((best, item) => item.scores.prestige > best.scores.prestige ? item : best);
    const showcase = scores.reduce((best, item) => item.scores.showcase > best.scores.showcase ? item : best);
    expect(prestige.deck.special).toBe("prestige");
    expect(showcase.deck.special).toBe("showcase");
  });

  it("the showcase deck only uses printings that exist in the database", () => {
    const showcase = deckFile.decks.find((deck) => deck.special === "showcase")!;
    let cosmetics = 0;
    for (const entry of showcase.cards) {
      for (const p of entry.printings) {
        const record = realDb.cards[p.key];
        expect(record?.printings[p.variant], `${entry.id} ${p.variant}`).toBeTruthy();
        if (p.variant !== "Standard") cosmetics += p.count;
      }
    }
    expect(cosmetics).toBe(derivedDeckScores(showcase, realDb, deckFile.decks).cosmeticCopies);
    expect(cosmetics).toBeGreaterThanOrEqual(10);
  });
});
