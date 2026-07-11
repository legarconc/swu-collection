import Papa from "papaparse";
import type { CardDatabase, CollectionEntry, UnknownRow } from "../types";
import { cleanEntries, deriveVariant } from "./collection";

export type ImportFormat = "holodeck" | "swudb";
export interface ImportResult {
  format: ImportFormat;
  entries: CollectionEntry[];
  unknown: UnknownRow[];
  invalid: Array<{ row: number; reason: string }>;
  importedCount: number;
}

const normalizeHeader = (value: string) => value.trim().replace(/^#\s*/, "").toLowerCase();

export function detectFormat(text: string): ImportFormat {
  const first = text.replace(/^\uFEFF/, "").split(/\r?\n/, 1)[0];
  const fields = Papa.parse<string[]>(first.replace(/^#\s*/, "")).data[0]?.map(normalizeHeader) || [];
  if (fields.includes("variant") && fields.includes("price_each")) return "holodeck";
  if (fields.includes("cardnumber") && fields.includes("isfoil")) return "swudb";
  throw new Error("Unknown file format. Use a HoloDeck TXT or SWUDB CSV export.");
}

const parsePrice = (value: unknown): number | undefined => {
  if (typeof value !== "string" || !value.trim()) return undefined;
  let normalized = value.replace(/€/g, "").replace(/\s/g, "");
  const comma = normalized.lastIndexOf(",");
  const dot = normalized.lastIndexOf(".");
  if (comma >= 0 && dot >= 0) {
    normalized = comma > dot
      ? normalized.replace(/\./g, "").replace(",", ".")
      : normalized.replace(/,/g, "");
  } else if (comma >= 0) {
    normalized = /,\d{1,2}$/.test(normalized) ? normalized.replace(",", ".") : normalized.replace(/,/g, "");
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
};

export function parseCollectionFile(text: string, database: CardDatabase): ImportResult {
  const format = detectFormat(text);
  const cleanText = text.replace(/^\uFEFF/, "").replace(/^#\s*/, "");
  const parsed = Papa.parse<Record<string, string>>(cleanText, {
    delimiter: ",",
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: normalizeHeader,
  });
  const entries: CollectionEntry[] = [];
  const unknown: UnknownRow[] = [];
  const malformed = new Map<number, string[]>();
  for (const error of parsed.errors) {
    if (error.code === "UndetectableDelimiter" || error.row === undefined) {
      throw new Error(`CSV problem: ${error.message}`);
    }
    // Papa reports quote-error rows against physical lines, while field
    // mismatch rows are indexed against parsed data rows when header=true.
    const dataIndex = error.type === "Quotes" ? Math.max(0, error.row - 1) : error.row;
    const messages = malformed.get(dataIndex) || [];
    if (!messages.includes(error.message)) messages.push(error.message);
    malformed.set(dataIndex, messages);
  }
  const invalid: Array<{ row: number; reason: string }> = [...malformed.entries()]
    .map(([index, messages]) => ({ row: index + 2, reason: messages.join("; ") }));
  parsed.data.forEach((row, index) => {
    const rowNumber = index + 2;
    if (malformed.has(index)) return;
    const set = String(row.set || "").trim().toUpperCase();
    const number = Number(format === "holodeck" ? row.number : row.cardnumber);
    const count = Number(row.count);
    if (!set || !Number.isInteger(number) || !Number.isInteger(count) || count <= 0) {
      invalid.push({ row: rowNumber, reason: "Set, card number, or count is invalid" });
      return;
    }
    const card = database.cards[`${set}-${number}`];
    if (!card) {
      unknown.push({ row: rowNumber, set, number, reason: "Card is not in the synced database" });
      return;
    }
    const isFoil = /^(true|1|yes)$/i.test(String(row.isfoil ?? row.is_foil ?? ""));
    const variant = format === "holodeck"
      ? String(row.variant || deriveVariant(database, set, number, isFoil) || "Standard").trim()
      : deriveVariant(database, set, number, isFoil);
    if (!variant) {
      unknown.push({ row: rowNumber, set, number, reason: "Printing variant could not be determined" });
      return;
    }
    entries.push({ set, number, count, variant, priceEach: parsePrice(row.price_each) });
  });
  const cleaned = cleanEntries(entries);
  return {
    format,
    entries: cleaned,
    unknown,
    invalid,
    importedCount: cleaned.reduce((sum, entry) => sum + entry.count, 0),
  };
}

const csv = (rows: Array<Array<string | number | boolean>>) => Papa.unparse(rows, { newline: "\r\n" });

export function exportSwudb(entries: CollectionEntry[]): string {
  const grouped = new Map<string, { set: string; number: number; count: number; foil: boolean }>();
  for (const entry of cleanEntries(entries)) {
    const foil = /foil/i.test(entry.variant);
    const key = `${entry.set}-${entry.number}-${foil}`;
    const current = grouped.get(key);
    if (current) current.count += entry.count;
    else grouped.set(key, { set: entry.set, number: entry.number, count: entry.count, foil });
  }
  return csv([
    ["Set", "CardNumber", "Count", "IsFoil"],
    ...[...grouped.values()].map((item) => [item.set, item.number, item.count, item.foil ? "True" : "False"]),
  ]);
}

export function exportFull(entries: CollectionEntry[], database: CardDatabase): string {
  const rows: Array<Array<string | number | boolean>> = [[
    "# count", "name", "subtitle", "set", "number", "variant", "rarity", "is_foil", "price_each", "price_total",
  ]];
  for (const entry of cleanEntries(entries)) {
    const card = database.cards[`${entry.set}-${entry.number}`];
    const price = entry.priceEach;
    rows.push([
      entry.count,
      card?.name || "",
      card?.subtitle || "",
      entry.set,
      entry.number,
      entry.variant,
      card?.rarity || "",
      /foil/i.test(entry.variant) ? "True" : "False",
      price === undefined ? "" : `${price.toFixed(2)} €`,
      price === undefined ? "" : `${(price * entry.count).toFixed(2)} €`,
    ]);
  }
  return csv(rows);
}
