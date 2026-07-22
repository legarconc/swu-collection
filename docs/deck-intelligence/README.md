# Deck Intelligence knowledge base

This directory is the durable research layer behind the site's deterministic deck recommendations. It keeps game knowledge in the project so future sets and deck batches can extend the same rules, vocabulary, scoring, and quality standards without adding runtime AI.

## Structure

- [general-strategy.md](general-strategy.md) — format-independent rules, archetypes, deck-building heuristics, curves, mulligans, sequencing, and playtesting.
- [deck-data-schema.md](deck-data-schema.md) — the contract between researched deck data, validation, UI, and SWUDB export.
- [sets/spark-of-rebellion.md](sets/spark-of-rebellion.md) — Spark of Rebellion mechanics, historical archetypes, current format status, and research sources.
- [sets/ashes-of-the-empire.md](sets/ashes-of-the-empire.md) — Ashes of the Empire mechanics, Spotlight leaders, archetype seeds, and current format status.
- Add future set guides as `sets/<set-name>.md`. Keep collection quantities and private exports out of these committed documents.

## Sources of truth

1. Official rules and format legality come from Fantasy Flight Games.
2. Public card metadata comes from generated `data/cards.json`; confirmed upstream name/subtitle corrections live in `data/card-overrides.json` and are reapplied by every refresh.
3. General recommendations come from the strategy guide and cited historical sources.
4. Owned quantities and variants come only from ignored local collection exports or on-device collection data.
5. Published recommendations live in `site/src/data/decks.json`.
6. `scripts/validate-decks.mjs` is the release gate for deck structure, card references, aspects, printings, ownership when locally available, and derived special-deck rankings.

Rules and recommendations must remain visibly distinct. A minimum deck size or copy limit is a rule; a 70% unit target or twelve early plays is a tunable heuristic.

## Adding a set

1. Add the set code to `data/sets.json` and refresh the public card database.
2. Add `sets/<set-name>.md` with:
   - release and rotation information;
   - mechanics, traits, leaders, bases, and important role-players;
   - supported archetypes and cross-set synergies;
   - known weaknesses or unsupported strategies;
   - official and historical sources with an access date.
3. Re-import or refresh the private collection locally.
4. Generate candidate decks from owned cards only.
5. Add or revise entries in `site/src/data/decks.json`.
6. Run `node scripts/validate-decks.mjs` from the project root.
7. Run `npm test` and `npm run build` inside `site/`.
8. Goldfish opening hands, then test against at least one aggro, midrange, and control reference deck.
9. Record meaningful strategic conclusions in the relevant set guide; do not record private collection rows.

If a scan disagrees with public metadata, verify the printed card before changing the private collection. A wrong set code or collector number belongs in the collection export; a confirmed API spelling or subtitle error belongs in `data/card-overrides.json`. Overrides use canonical gameplay identity keys and therefore apply to Standard, Hyperspace, and foil printings together.

## Adding more decks

Every deck needs a distinct plan, not merely a different leader:

- a unique name;
- leader, base, aspects, and intended format;
- exactly 50 validated main-deck cards;
- selected owned printings;
- primary archetype and useful secondary tags;
- one-sentence win-condition contract;
- early, middle, and late-game instructions;
- opening priorities and mulligan rules;
- combinations, resource priorities, weaknesses, owned adjustments, and clearly separated future acquisitions;
- explicit ground/space policy;
- expert gameplay score;
- automatically derived rarity, collector, prestige, and showcase scores.

When the portfolio grows, preserve a range of difficulties and play experiences. Do not describe every deck as “strongest”; use honest bands such as Strongest available, Strong, Experimental, and Challenge.

## Keeping the system scalable

- Prefer canonical card identity keys such as `SOR-95`; printings remain separate selections under that identity.
- Treat aspects as a multiset because double-aspect cards need two matching icons.
- Derive statistics and scores from deck/card data instead of copying totals into prose.
- Date-stamp legality and market-value inputs.
- Keep set research modular. Cross-set conclusions can be promoted into the general guide once they prove broadly applicable.
- Never commit collection exports, collection-derived price rows, or temporary optimization output.
- Runtime behavior remains deterministic: no model call, secret, account, or network recommendation service is required.
