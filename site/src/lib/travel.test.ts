import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import travelFileJson from "../data/travel-decks.json";
import type { CardDatabase } from "../types";
import { aspectPenalty } from "./decks";
import { parseCollectionFile } from "./formats";
import { rosterCheck, type TravelFile } from "./travel";

const travel = travelFileJson as TravelFile;
const db: CardDatabase = JSON.parse(
  readFileSync(path.resolve(__dirname, "../../../data/cards.json"), "utf8"),
);
const collectionText = readFileSync(path.resolve(__dirname, "../../../data/collection.txt"), "utf8");
const entries = parseCollectionFile(collectionText, db).entries;

describe("travel deck roster", () => {
  it("ships five legal 50-card decks with zero aspect penalties", () => {
    expect(travel.roster).toHaveLength(5);
    for (const deck of travel.roster) {
      const total = deck.cards.reduce((sum, card) => sum + card.count, 0);
      expect(total, deck.name).toBe(50);
      const leader = db.cards[deck.leader.id];
      const base = db.cards[deck.base.id];
      expect(leader?.type, deck.name).toBe("Leader");
      expect(base?.type, deck.name).toBe("Base");
      const icons = [...leader.aspects, ...base.aspects];
      const titleCounts = new Map<string, number>();
      for (const card of deck.cards) {
        const record = db.cards[card.id];
        expect(record, `${deck.name}: ${card.id}`).toBeTruthy();
        expect(card.count, `${deck.name}: ${record.name}`).toBeLessThanOrEqual(3);
        expect(aspectPenalty(record.aspects, icons), `${deck.name}: ${record.name}`).toBe(0);
        const printed = card.printings.reduce((sum, p) => sum + p.count, 0);
        expect(printed, `${deck.name}: ${record.name}`).toBe(card.count);
        const title = `${record.name}|${record.subtitle}`;
        titleCounts.set(title, (titleCounts.get(title) || 0) + card.count);
      }
      for (const [title, count] of titleCounts) {
        expect(count, `${deck.name}: ${title}`).toBeLessThanOrEqual(3);
      }
    }
  });

  it("uses a distinct leader per deck (bases may repeat within owned copies)", () => {
    const leaders = travel.roster.map((deck) => deck.leader.id);
    expect(new Set(leaders).size).toBe(leaders.length);
  });

  it("is simultaneously buildable from the published collection", () => {
    const check = rosterCheck(travel.roster, entries, db);
    expect(check.conflicts).toEqual([]);
    expect(check.buildable).toBe(true);
    expect(check.mainCards).toBe(250);
  });
});
