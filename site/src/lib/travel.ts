import type { CardDatabase, CollectionEntry } from "../types";
import type { DeckCard } from "./decks";

/**
 * A travel deck is a full 50-card deck plus leader and base, chosen so that the
 * whole roster shares no physical card, leader, or base — every copy is used at
 * most as many times as it is owned across all five decks at once.
 */
export interface TravelDeck {
  id: string;
  name: string;
  archetype: string;
  identity: string;
  aspects: string[];
  leader: { id: string; printing: string; variant: string };
  base: { id: string; printing: string; variant: string };
  cards: DeckCard[];
}

export interface TravelFile {
  generatedAt: string;
  note: string;
  roster: TravelDeck[];
}

export interface RosterConflict {
  identityKey: string;
  name: string;
  used: number;
  owned: number;
  /** Set when the conflict is a specific printing (e.g. a single owned foil) rather than the card as a whole. */
  variant?: string;
}

export interface RosterCheck {
  /** Total main-deck cards across the roster (5 × 50 when complete). */
  mainCards: number;
  /** Main-deck cards + one leader and one base per deck. */
  physicalCards: number;
  /** Any identity used more times than the live collection owns. */
  conflicts: RosterConflict[];
  buildable: boolean;
}

/** Sum a live collection down to owned copies per card identity. */
export function ownedByIdentity(entries: CollectionEntry[], database: CardDatabase): Map<string, number> {
  const owned = new Map<string, number>();
  for (const entry of entries) {
    const card = database.cards[`${entry.set}-${entry.number}`];
    if (!card) continue;
    owned.set(card.identityKey, (owned.get(card.identityKey) || 0) + entry.count);
  }
  return owned;
}

/**
 * Verify the whole roster is simultaneously buildable from the given collection:
 * every leader, base, and card identity is used no more than it is owned.
 */
export function rosterCheck(roster: TravelDeck[], entries: CollectionEntry[], database: CardDatabase): RosterCheck {
  const owned = ownedByIdentity(entries, database);
  const ownedPrinting = new Map<string, number>();
  for (const entry of entries) {
    const card = database.cards[`${entry.set}-${entry.number}`];
    if (!card) continue;
    const key = `${card.key}|${entry.variant}`;
    ownedPrinting.set(key, (ownedPrinting.get(key) || 0) + entry.count);
  }

  const used = new Map<string, number>();
  const usedPrinting = new Map<string, number>();
  const add = (id: string, count: number) => used.set(id, (used.get(id) || 0) + count);
  const addPrinting = (key: string, variant: string, count: number) => {
    const k = `${key}|${variant}`;
    usedPrinting.set(k, (usedPrinting.get(k) || 0) + count);
  };
  let mainCards = 0;
  for (const deck of roster) {
    add(deck.leader.id, 1);
    addPrinting(deck.leader.printing, deck.leader.variant, 1);
    add(deck.base.id, 1);
    addPrinting(deck.base.printing, deck.base.variant, 1);
    for (const card of deck.cards) {
      add(card.id, card.count);
      mainCards += card.count;
      for (const printing of card.printings) addPrinting(printing.key, printing.variant, printing.count);
    }
  }

  const conflicts: RosterConflict[] = [];
  for (const [identityKey, count] of used) {
    const have = owned.get(identityKey) || 0;
    if (count > have) {
      conflicts.push({ identityKey, name: database.cards[identityKey]?.name || identityKey, used: count, owned: have });
    }
  }
  for (const [key, count] of usedPrinting) {
    const have = ownedPrinting.get(key) || 0;
    if (count > have) {
      const [recordKey, variant] = key.split("|");
      conflicts.push({ identityKey: recordKey, name: database.cards[recordKey]?.name || recordKey, used: count, owned: have, variant });
    }
  }
  conflicts.sort((a, b) => b.used - b.owned - (a.used - a.owned));
  return {
    mainCards,
    physicalCards: mainCards + roster.length * 2,
    conflicts,
    buildable: conflicts.length === 0,
  };
}
