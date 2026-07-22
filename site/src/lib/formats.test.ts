import { describe, expect, it } from "vitest";
import type { CardDatabase } from "../types";
import { deriveVariant, mergeCollections } from "./collection";
import { cardImage } from "./cards";
import { exportFull, exportSwudb, parseCollectionFile } from "./formats";

const database: CardDatabase = {
  generatedAt: "2026-01-01T00:00:00Z",
  source: "test",
  sets: [{ code: "SOR", cardRecords: 2, setSize: 2 }],
  cardCount: 2,
  cards: {
    "SOR-172": {
      key: "SOR-172", set: "SOR", number: 172, name: "Open Fire", subtitle: "", type: "Event",
      aspects: ["Aggression"], cost: 3, power: null, hp: null, traits: ["TACTIC"], rarity: "Common", text: "Deal 4 damage.",
      arena: [], images: { front: "172.png", back: null }, defaultVariant: "Standard", identityKey: "SOR-172",
      printings: { Standard: { variant: "Standard", apiNumber: "172", image: "172.png", backImage: null, marketPrice: null, raw: {} }, "Standard Foil": { variant: "Standard Foil", apiNumber: "172F", image: "172F.png", backImage: null, marketPrice: null, raw: {} } },
    },
    "SOR-379": {
      key: "SOR-379", set: "SOR", number: 379, name: "Agent Kallus", subtitle: "Seeking the Rebels", type: "Unit",
      aspects: ["Command"], cost: 5, power: 4, hp: 4, traits: ["IMPERIAL"], rarity: "Rare", text: "Ambush", arena: ["Ground"],
      images: { front: "379.png", back: null }, defaultVariant: "Hyperspace", identityKey: "SOR-115",
      printings: { Hyperspace: { variant: "Hyperspace", apiNumber: "379", image: "379.png", backImage: null, marketPrice: null, raw: {} }, "Hyperspace Foil": { variant: "Hyperspace Foil", apiNumber: "379F", image: "379F.png", backImage: null, marketPrice: null, raw: {} } },
    },
  },
};

describe("collection imports", () => {
  it("uses the matching non-foil artwork for CDN-blocked foil images", () => {
    expect(cardImage(database.cards["SOR-172"], "Standard Foil")).toBe("172.png");
    expect(cardImage(database.cards["SOR-379"], "Hyperspace Foil")).toBe("379.png");
  });

  it("parses quoted HoloDeck fields and prices", () => {
    const text = '# count,name,subtitle,set,number,variant,rarity,is_foil,price_each,price_total\n2,"Open, Fire",,SOR,172,Standard,Common,False,0.02 €,0.04 €\n1,Agent Kallus,Seeking the Rebels,SOR,379,Hyperspace Foil,Rare,True,2.00 €,2.00 €';
    const result = parseCollectionFile(text, database);
    expect(result.importedCount).toBe(3);
    expect(result.unknown).toHaveLength(0);
    expect(result.entries[1]).toMatchObject({ number: 379, variant: "Hyperspace Foil", priceEach: 2 });
  });

  it("parses US and European thousands-separated prices", () => {
    const us = '# count,name,subtitle,set,number,variant,rarity,is_foil,price_each,price_total\n1,Open Fire,,SOR,172,Standard,Common,False,"1,234.56 €","1,234.56 €"';
    const eu = '# count,name,subtitle,set,number,variant,rarity,is_foil,price_each,price_total\n1,Open Fire,,SOR,172,Standard,Common,False,"1.234,56 €","1.234,56 €"';
    expect(parseCollectionFile(us, database).entries[0].priceEach).toBe(1234.56);
    expect(parseCollectionFile(eu, database).entries[0].priceEach).toBe(1234.56);
  });

  it("reports every unknown and invalid row", () => {
    const text = "Set,CardNumber,Count,IsFoil\nSOR,999,1,False\nBAD,12,2,False\nSOR,nope,1,False";
    const result = parseCollectionFile(text, database);
    expect(result.unknown).toHaveLength(2);
    expect(result.invalid).toHaveLength(1);
  });

  it("imports valid rows while reporting short and unclosed-quote rows", () => {
    const short = "Set,CardNumber,Count,IsFoil\nSOR,172,1,False\nTOTAL,3";
    const shortResult = parseCollectionFile(short, database);
    expect(shortResult.importedCount).toBe(1);
    expect(shortResult.invalid).toHaveLength(1);
    expect(shortResult.invalid[0].row).toBe(3);

    const quote = 'Set,CardNumber,Count,IsFoil\nSOR,172,1,False\n"SOR,379,1,True';
    const quoteResult = parseCollectionFile(quote, database);
    expect(quoteResult.importedCount).toBe(1);
    expect(quoteResult.invalid).toHaveLength(1);
    expect(quoteResult.invalid[0].row).toBe(3);
  });

  it("rejects a foil flag when that printing does not exist", () => {
    const showcase = {
      ...database,
      cards: {
        ...database.cards,
        "SOR-265": {
          ...database.cards["SOR-379"],
          key: "SOR-265", number: 265, defaultVariant: "Showcase",
          printings: { Showcase: { variant: "Showcase", apiNumber: "265", image: "265.png", backImage: null, marketPrice: null, raw: {} } },
        },
      },
    } satisfies CardDatabase;
    expect(deriveVariant(showcase, "SOR", 265, true)).toBeNull();
    const result = parseCollectionFile("Set,CardNumber,Count,IsFoil\nSOR,265,1,True", showcase);
    expect(result.entries).toHaveLength(0);
    expect(result.unknown).toHaveLength(1);
  });

  it("round-trips SWUDB counts and derives hyperspace foil", () => {
    const original = [
      { set: "SOR", number: 172, count: 3, variant: "Standard" },
      { set: "SOR", number: 172, count: 1, variant: "Standard Foil" },
      { set: "SOR", number: 379, count: 2, variant: "Hyperspace Foil" },
    ];
    const restored = parseCollectionFile(exportSwudb(original), database).entries;
    expect(restored).toEqual(original);
  });

  it("normalizes HoloScan's foil-first Prestige variant name", () => {
    const withPrestige = {
      ...database,
      cards: {
        ...database.cards,
        "ASH-835": {
          ...database.cards["SOR-379"],
          key: "ASH-835", set: "ASH", number: 835, name: "Grand Admiral Thrawn",
          defaultVariant: "Prestige Foil", identityKey: "ASH-33",
          printings: {
            "Prestige Foil": {
              variant: "Prestige Foil", apiNumber: "835F", image: "835F.png",
              backImage: null, marketPrice: 17.95, raw: {},
            },
          },
        },
      },
    } satisfies CardDatabase;
    const text = "# count,name,subtitle,set,number,variant,rarity,is_foil,price_each,price_total\n1,Grand Admiral Thrawn,Orchestrating His Return,ASH,835,Foil Prestige,Rare,True,17.95 €,17.95 €";
    const result = parseCollectionFile(text, withPrestige);
    expect(result.unknown).toHaveLength(0);
    expect(result.entries).toEqual([
      { set: "ASH", number: 835, count: 1, variant: "Prestige Foil", priceEach: 17.95 },
    ]);
  });

  it("exports a HoloDeck-compatible full TXT backup", () => {
    const original = [{ set: "SOR", number: 379, count: 2, variant: "Hyperspace Foil", priceEach: 2 }];
    const text = exportFull(original, database);
    expect(text.startsWith("# count,name,subtitle,set,number,variant,rarity,is_foil,price_each,price_total")).toBe(true);
    expect(parseCollectionFile(text, database).entries).toEqual(original);
  });
});

describe("collection merge", () => {
  it("adds matching counts and keeps distinct variants", () => {
    const result = mergeCollections(
      [{ set: "SOR", number: 172, variant: "Standard", count: 2 }],
      [{ set: "sor", number: 172, variant: "Standard", count: 3 }, { set: "SOR", number: 172, variant: "Standard Foil", count: 1 }],
      "merge",
    );
    expect(result).toEqual([
      { set: "SOR", number: 172, variant: "Standard", count: 5 },
      { set: "SOR", number: 172, variant: "Standard Foil", count: 1 },
    ]);
  });

  it("replace discards the old collection", () => {
    expect(mergeCollections([{ set: "SOR", number: 172, variant: "Standard", count: 2 }], [{ set: "SOR", number: 379, variant: "Hyperspace", count: 1 }], "replace"))
      .toEqual([{ set: "SOR", number: 379, variant: "Hyperspace", count: 1 }]);
  });
});
