# Deck data and export contract

The deck system is data-driven. Recommendations live in `site/src/data/decks.json`; React renders them and shared utilities derive validation, statistics, ownership coverage, and scores.

## Card identity versus printing

- `id` is the canonical gameplay identity, such as `SOR-179`.
- `printing` or `printings[].key` identifies the physical collector number.
- `variant` identifies Standard, Standard Foil, Hyperspace, Hyperspace Foil, or a future variant.
- Main-deck copy limits apply to `id`.
- Ownership checks apply to the exact `printing + variant`.

This separation prevents cosmetic cards from bypassing the three-copy limit while still allowing the showcase deck to prescribe physical copies.

## Required deck fields

```text
id, name, special
archetype, secondary, powerBand, difficulty
leader { id, printing, variant }
base { id, printing, variant }
aspects[]
cards[] { id, count, printings[] }
identity, spacePolicy
guide
scores { gameplay }
```

Only `gameplay` is stored as a score input. Rarity, market value, prestige, cosmetic density, cosmetic variety, and showcase score are calculated from the current card database and deck contents.

## Guide contract

Every guide supplies:

- win condition;
- early, middle, and late game;
- opening priorities;
- mulligan rules;
- named combinations;
- resource priorities;
- weaknesses;
- owned collection adjustments;
- future acquisitions that are never included in the deck or export.

Names in combinations must refer to cards actually present in the main deck,
leader, or base; the release validator accepts either the canonical card name
or its full `Name — Subtitle` display form. Opening priorities may combine those
names with concise matchup instructions.

## Validation contract

Before release:

- `expectedDeckCount` is a positive integer and equals the number of published decks, so a deliberate portfolio expansion updates the contract without hard-coded validator changes;
- exactly 50 main-deck cards per deck;
- no identity above three copies;
- leader and base resolve to the correct card types;
- leader, base, and main-deck printing variants exist;
- zero unexplained aspect penalties;
- exact ownership locally when private exports are present;
- SWUDB identifiers round-trip to canonical identities;
- the prestige badge belongs to the highest derived prestige score;
- the showcase badge belongs to the highest derived showcase score.

## SWUDB paste JSON

The copy button emits the minimal SWUDB-compatible structure:

```json
{
  "leader": { "id": "SOR_015", "count": 1 },
  "base": { "id": "SOR_023", "count": 1 },
  "deck": [
    { "id": "SOR_179", "count": 1 },
    { "id": "SOR_211", "count": 3 }
  ],
  "sideboard": []
}
```

SWUDB identifies gameplay cards, not owned cosmetic variants, in this export. The site continues displaying which physical printings to use.

When clipboard access succeeds, the user can paste this JSON into SWUDB's JSON import. When it is unavailable, the same button downloads the identical JSON payload.

Reference: [Limitless documentation showing SWUDB's exported JSON structure](https://docs.limitlesstcg.com/player/decklists#star-wars-unlimited).
