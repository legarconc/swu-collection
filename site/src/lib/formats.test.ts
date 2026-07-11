import { describe, expect, it } from "vitest";
import type { CardDatabase } from "../types";
import { mergeCollections } from "./collection";
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
  it("parses quoted HoloDeck fields and prices", () => {
    const text = '# count,name,subtitle,set,number,variant,rarity,is_foil,price_each,price_total\n2,"Open, Fire",,SOR,172,Standard,Common,False,0.02 €,0.04 €\n1,Agent Kallus,Seeking the Rebels,SOR,379,Hyperspace Foil,Rare,True,2.00 €,2.00 €';
    const result = parseCollectionFile(text, database);
    expect(result.importedCount).toBe(3);
    expect(result.unknown).toHaveLength(0);
    expect(result.entries[1]).toMatchObject({ number: 379, variant: "Hyperspace Foil", priceEach: 2 });
  });

  it("reports every unknown and invalid row", () => {
    const text = "Set,CardNumber,Count,IsFoil\nSOR,999,1,False\nBAD,12,2,False\nSOR,nope,1,False";
    const result = parseCollectionFile(text, database);
    expect(result.unknown).toHaveLength(2);
    expect(result.invalid).toHaveLength(1);
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
