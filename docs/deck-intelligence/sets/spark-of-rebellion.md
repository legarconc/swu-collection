# Spark of Rebellion — Deck Intelligence set guide

Set-specific notes behind the original 15 recommendations in `site/src/data/decks.json`.
Compiled 11 July 2026 and reviewed against the expanded collection on 22 July
2026. General rules and reusable best practices live in
[`../general-strategy.md`](../general-strategy.md). No private collection data
appears in this file or in the deck data; the decks themselves are intentionally
published as part of the site.

## Construction rules enforced (official)

Per the official Premier format description and Quickstart rules:

- 1 leader, 1 base, and a draw deck of **minimum 50 cards** (units, events, upgrades).
  This project deliberately uses **exactly 50** for consistency.
- **Maximum 3 copies** of any card, counted by gameplay identity — cosmetic
  printings (Foil, Hyperspace, Showcase) share the limit.
- Cards may be played outside your leader/base aspects at an **aspect penalty of
  +2 resources per missing aspect icon** (multiset matching: a double-icon card
  needs two matching icons). Off-aspect cards are legal but discouraged; this
  portfolio's policy is **zero penalized cards**, enforced by
  `scripts/validate-decks.mjs`.

## Format status (official)

Spark of Rebellion (with Shadows of the Galaxy and Twilight of the Republic)
**rotated out of Premier in March 2026** when *A Lawless Time* released. The
Eternal format launched at the same time and permits every printed card. These
SOR-only decks are therefore labeled **"Premier-style construction · Eternal/
casual legal"** and never claim current Premier legality. As of the April 2026
Eternal update, no card in this pool is suspended.

## Deck-building guidance applied (recommendation, not rules)

- Roughly 70% units in a typical deck; 12+ genuine early plays for proactive
  decks; explicit space policy (contest / race / answer / dominate).
- Cost-curve templates by archetype (aggro lower, control/ramp higher) and
  3/2/1-copy guidelines: 3 for engine cards, 2 for conditional or expensive
  cards, 1 for owned-limited or situational cards. Collection-limited one-ofs
  are called out honestly in each guide.
- Mulligan guidance names actual cards; resource-priority tags follow the
  keep / situational / resource-first model.

## Scoring models (documented, deterministic)

- **Prestige** = 45% expert gameplay rating + 30% quantity-weighted rarity
  (C15/U35/Sp50/R70/L100) + 25% collector value. Rarity is calculated directly
  from the 50 cards. Collector value is calculated from each selected printing's
  dated public card-database price, log-normalized against the most valuable
  deck in the current portfolio; no price is entered by hand or fetched at runtime.
- **Showcase** = 55% deck quality + 30% cosmetic density (non-Standard cards
  of 50) + 15% cosmetic variety (of 3 variant kinds).
- Gameplay ratings are the only expert-judgment input and are grounded in the
  historical SOR archetype tiers (sources below). All other score components and
  both weighted totals are derived at runtime and rechecked by the build validator.

## Validation pipeline

- `scripts/validate-decks.mjs` — runs in CI (structure, 50-card totals, copy
  limits, leader/base/main-deck printings, aspect policy, SWUDB round-trip,
  prestige/showcase winner derivation) and locally also checks owned quantities
  and exact selected printings against the ignored collection export.
- `site/src/lib/decks.ts` + `decks.test.ts` — the same rules as typed
  utilities with unit tests, plus live validation displayed in the UI.
- SWUDB export uses the community JSON deck format (`{leader, base, deck:
  [{id: "SOR_045", count: n}], sideboard: []}`).

## July 2026 collection revision

The later SOR boosters did not justify replacing every established list. Two
newly available double-aspect legendaries did materially improve existing plans:

- **Inferno Redline** moved from Aggression to a mono-Vigilance Iden control
  shell and now uses both owned copies of *Vigilance* as its reset and recovery
  turn.
- **The Senate's Long Game** moved from Cunning to Command and now uses the
  newly owned *Command* alongside Imperial ramp and recursion.

All other original recommendations remain unchanged because the additions did
not create a clearer improvement within their leader, aspect, curve, and
ownership constraints.

## Sources

Official:

1. [Premier format overview](https://starwarsunlimited.com/how-to-play?chapter=premier) — deck size, copy limit, leaders/bases.
2. [Quickstart Rules PDF](https://images-cdn.fantasyflightgames.com/filer_public/36/f6/36f6e0a5-a7a9-4cbe-8d73-70e61fe6f548/sw_unlimited_quickstart_rules.pdf) — aspect penalty, play flow, mulligan.
3. [Updates and Rotations](https://starwarsunlimited.com/articles/updates-and-rotations) — SOR rotation.
4. [Eternally Unlimited](https://starwarsunlimited.com/articles/eternally-unlimited) — Eternal format launch.
5. [Eternal Format Update, April 2026](https://starwarsunlimited.com/articles/eternal-format-update-april-2026) — suspension status.
6. [Behind Unlimited: On the Color Pie](https://starwarsunlimited.com/articles/behind-unlimited-on-the-color-pie) — aspect identities.
7. [Behind Unlimited: Lessons and Accomplishments of 2024](https://starwarsunlimited.com/articles/behind-unlimited-lessons-accomplishments-2024) — SOR leader power retrospective (basis for "Experimental"/"Challenge" power bands).
8. [Behind Unlimited: Designing for Draft](https://starwarsunlimited.com/articles/behind-unlimited-designing-for-draft) — unit density and early-cost density.

Community/historical (strategy templates only — lists were not copied and could
not be: several defining cards are not in the collection):

9. [StarWarsUnlimited.gg SOR Meta Report #1](https://starwarsunlimited.gg/star-wars-unlimited-spark-of-rebellion-meta-report-1/) — historical archetype tiers.
10. [TCGplayer: 5 Tips for Building Your First SWU Deck](https://www.tcgplayer.com/content/article/5-Tips-for-Building-Your-First-Star-Wars-Unlimited-Deck/8f333d8f-926e-4a4e-a0a9-bcefcc861e56/) — baseline curve/type ranges.
11. [Limitless TCG decklist docs](https://docs.limitlesstcg.com/player/decklists) — SWUDB JSON deck format reference.

Confidence: official rules and rotation status verified 11 July 2026; historical
tier ordering is time-bounded to the original SOR environment; curve templates
are heuristics to tune with play.
