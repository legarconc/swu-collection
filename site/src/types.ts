export interface CardPrinting {
  variant: string;
  apiNumber: string;
  image: string;
  backImage: string | null;
  marketPrice: number | null;
  raw: Record<string, unknown>;
}

export interface CardRecord {
  key: string;
  set: string;
  number: number;
  name: string;
  subtitle: string;
  type: string;
  aspects: string[];
  cost: number | null;
  power: number | null;
  hp: number | null;
  traits: string[];
  rarity: string;
  text: string;
  arena: string[];
  images: { front: string; back: string | null };
  defaultVariant: string;
  identityKey: string;
  printings: Record<string, CardPrinting>;
}

export interface CardDatabase {
  generatedAt: string;
  source: string;
  sets: Array<{ code: string; cardRecords: number; setSize: number }>;
  cardCount: number;
  cards: Record<string, CardRecord>;
}

export interface CollectionEntry {
  set: string;
  number: number;
  variant: string;
  count: number;
  priceEach?: number;
}

export interface UnknownRow {
  row: number;
  set: string;
  number: number;
  reason: string;
}

