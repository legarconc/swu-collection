import type { CardDatabase, CollectionEntry } from "../types";

export const entryKey = (entry: Pick<CollectionEntry, "set" | "number" | "variant">) =>
  `${entry.set.toUpperCase()}-${entry.number}-${entry.variant.trim().toLowerCase()}`;

export function cleanEntries(entries: CollectionEntry[]): CollectionEntry[] {
  const merged = new Map<string, CollectionEntry>();
  for (const raw of entries) {
    const entry = {
      ...raw,
      set: raw.set.trim().toUpperCase(),
      number: Number(raw.number),
      variant: raw.variant.trim() || "Standard",
      count: Math.max(0, Math.floor(Number(raw.count))),
    };
    if (!entry.set || !Number.isInteger(entry.number) || !Number.isFinite(entry.count) || entry.count <= 0) continue;
    const key = entryKey(entry);
    const current = merged.get(key);
    if (current) {
      current.count += entry.count;
      if (entry.priceEach !== undefined) current.priceEach = entry.priceEach;
    } else {
      merged.set(key, entry);
    }
  }
  return [...merged.values()].sort((a, b) =>
    a.set.localeCompare(b.set) || a.number - b.number || a.variant.localeCompare(b.variant),
  );
}

export function mergeCollections(
  current: CollectionEntry[],
  incoming: CollectionEntry[],
  mode: "replace" | "merge",
): CollectionEntry[] {
  return cleanEntries(mode === "replace" ? incoming : [...current, ...incoming]);
}

export function setEntryCount(
  entries: CollectionEntry[],
  target: Omit<CollectionEntry, "count">,
  count: number,
): CollectionEntry[] {
  const key = entryKey(target);
  const without = entries.filter((entry) => entryKey(entry) !== key);
  return cleanEntries(count > 0 ? [...without, { ...target, count }] : without);
}

export function deriveVariant(database: CardDatabase, set: string, number: number, isFoil: boolean): string | null {
  const card = database.cards[`${set.toUpperCase()}-${number}`];
  if (!card) return null;
  const base = card.defaultVariant === "Standard" ? "Standard" : card.defaultVariant.replace(/ Foil$/i, "");
  const wanted = isFoil ? `${base} Foil` : base;
  if (card.printings[wanted]) return wanted;
  const direct = Object.keys(card.printings).find((variant) => /foil/i.test(variant) === isFoil);
  return direct || wanted;
}

