# Ashes of the Empire — Deck Intelligence set guide

Initial set guide compiled 22 July 2026. General construction rules and reusable
best practices live in [`../general-strategy.md`](../general-strategy.md). This
guide records public game knowledge only; owned quantities and private prices
remain in the ignored collection exports.

## Release and format status

*Ashes of the Empire* (`ASH`) is the eighth standard set and released on 17 July
2026. Its prerelease box launched one week earlier and contains six boosters.
The set has more than 260 gameplay cards and is Premier-legal on release. Under
the announced rotation cadence, it is expected to rotate with the other Year 3
sets in March 2028. Re-check the official format page before publishing future
deck recommendations because suspensions and legality can change independently
of set rotation.

The Luke Skywalker and Emperor Palpatine cards included with the prerelease
product are Hyperspace versions of the set's Spotlight Deck leaders. Spotlight
Decks are ready-to-play 50-card products and mix new ASH cards with cards from
older sets; do not assume every card in those lists has the `ASH` set code.

## Mechanical identity

### Support

Support is an action-economy keyword: when a Support unit is played, another
unit may attack and gains the Support unit's other abilities for that attack.
It rewards having a useful attacker already in play and can convert an enter-play
action into immediate pressure, removal, healing, or another On Attack effect.

Deck-building implications:

- keep enough inexpensive units to ensure Support is live on curve;
- value On Attack text that becomes unusually strong when temporarily shared;
- sequence the intended attacker before the Support unit, and preserve a ready
  attacker when the opponent cannot punish that delay;
- remember that a Support-heavy hand without an established unit can be slow.

### Advantage tokens

Each Advantage token is an upgrade that temporarily grants +1 power. Its boost
expires after the attached unit attacks or defends, so it rewards deliberate
timing rather than long-term stat accumulation. Support is a natural partner:
it can turn a newly created Advantage boost into an attack immediately.

Strategic implications:

- Overwhelm and Saboteur make temporary power more likely to convert into base
  damage instead of being absorbed by a small defender;
- spreading Advantage can reduce exposure to a single removal spell, while
  stacking it creates a higher-impact but more fragile attack;
- opponents can attack an exhausted boosted unit to consume its Advantage while
  defending, so Sentinel, removal, and initiative management matter;
- upgrades that remove, blank, move, or exploit other upgrades have elevated
  relevance in this environment.

### Mandalorian tokens and upgrade density

The second new token type is a resilient Mandalorian unit token. ASH also has
more upgrades and more ways to use upgrades than a typical set, a high density
of Shield tokens, and strong Mandalorian and New Republic representation.
When evaluating an ASH pool, distinguish permanent upgrades from temporary
Advantage and verify whether a payoff cares about any upgrade, a token upgrade,
or a named subtype.

## Spotlight leader shells

### Luke Skywalker — I Can Save Him

Luke is Vigilance/Heroism and turns unit healing into an attrition engine. His
leader side heals a friendly unit after it attacks; after deployment he can
also sustain the base. The official shell pairs him with units that damage
themselves for value, healing payoffs, defensive upgrades, and Support units.

Construction priorities:

- a reliable early unit curve so healing and Support have targets;
- high-HP units or profitable self-damage abilities;
- enough interaction to prevent an opponent from ignoring the board and racing;
- a clear closer, because healing extends the game but does not win it alone;
- space defense such as a Sentinel or efficient answer rather than conceding an
  entire arena.

The official examples include Leia Organa for self-damage and base healing,
Doctor Pershing for repeatable value, R5-D4 for upgrade interaction, and Han
Solo or Follow Me for Advantage. Treat these as synergy examples, not an
automatic list: ownership, aspect access, curve, and copy counts still control
the final 50.

### Emperor Palpatine — According to My Design

Palpatine is Cunning/Villainy and grants Advantage according to the size of his
board. He therefore wants inexpensive bodies, ways to keep enough units in play,
and attacks that convert temporary power efficiently. Support helps the deck add
to the board without surrendering all its attack tempo.

Construction priorities:

- multiple playable units in the first two turns;
- cheap units that remain useful as Advantage contributors later;
- Overwhelm, Sentinel control, or other ways to convert a large boosted attack;
- protection, recursion, or replacement value against sweepers and efficient
  removal;
- avoid overloading the curve with expensive finishers merely because the
  leader scales into the late game.

The official shell highlights Rukh, Flanking TIE Interceptor, Emperor's
Messenger, Moff Gideon, Long Live the Empire, and late threats such as Executor.
The core tension is board width versus vulnerability: test the deck after losing
two early units, not only when its ideal engine survives.

## Early constructed archetype seeds

These are research directions, not established tier claims five days after
release:

- Luke healing midrange: resilient Heroism units, self-damage value, Support,
  and a measured late game.
- Palpatine Advantage swarm: cheap Villainy bodies, Support tempo, token
  multipliers, and selective top-end.
- Mandalorian token go-wide: token generation plus tribal or upgrade payoffs;
  verify that the deck still functions without its best payoff.
- Upgrade tempo: efficient bodies carrying permanent upgrades, backed by ways
  to exploit the set's unusually upgrade-heavy environment.
- New Republic midrange: trait density and flexible value units rather than
  forcing a tribal label without enough actual payoffs.
- Cross-set engines: ASH deliberately supports earlier leaders including JTL
  Grand Admiral Thrawn, LOF Rey, and SEC Padmé Amidala. Validate those shells
  against the full owned pool when cross-set decks are researched.

## Research and validation notes

- Do not label an ASH deck “best” from prerelease impressions alone. Separate
  official mechanical intent from results earned through playtesting.
- A newly scanned Prestige treatment may be named `Foil Prestige` by HoloScan
  and `Prestige Foil` by the public API. The importer canonicalizes that naming
  difference; deck data must use the public database's canonical variant.
- Keep identity and printing separate. For example, the prerelease Hyperspace
  leader and its Standard printing are the same gameplay identity for copy and
  deck purposes.
- Before adding ASH decks to the published portfolio, run the exact ownership,
  aspect, 50-card, copy-limit, printing, and SWUDB round-trip validators already
  required by the deck data schema.

## Official sources

1. [Ashes of the Empire product page](https://starwarsunlimited.com/products/set-8-ashes-of-the-empire) — release date, product contents, set features, Spotlight leaders, and Prestige variants.
2. [Ashes of the Empire first look](https://starwarsunlimited.com/articles/ashes-of-the-empire) — Support, Advantage, Luke and Palpatine mechanical introductions.
3. [A Fated Confrontation](https://starwarsunlimited.com/articles/a-fated-confrontation) — official Spotlight Deck strategy and named synergy examples.
4. [From the Ashes](https://starwarsunlimited.com/articles/from-the-ashes) — upgrade density, traits, Shield density, and cross-set design targets.
5. [Icons 2027 First Look](https://starwarsunlimited.com/articles/unlimited-icons) — announced March 2028 rotation grouping.

Confidence: release and product facts verified 22 July 2026 from official
Fantasy Flight Games material. Archetype seeds are deliberately provisional and
must be revised after testing and stable post-release results.
