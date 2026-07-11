import type { CardRecord } from "../types";

/**
 * SWU-DB describes foil printings with an F-suffixed image URL, but its CDN
 * does not serve those files. Foils use the same artwork as their matching
 * non-foil printing, while ownership and variant labels remain distinct.
 */
export function cardImage(card: CardRecord, variant?: string): string {
  if (!variant) return card.images.front;
  const nonFoilVariant = variant.replace(/\s+Foil$/i, "");
  if (nonFoilVariant !== variant && card.printings[nonFoilVariant]?.image) {
    return card.printings[nonFoilVariant].image;
  }
  return card.printings[variant]?.image || card.images.front;
}

