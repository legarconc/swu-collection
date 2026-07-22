import { useMemo, useState } from "react";
import deckFile from "./data/decks.json";
import type { CardDatabase, CardRecord, CollectionEntry } from "./types";
import { cardImage } from "./lib/cards";
import {
  collectionCoverage, deckStats, derivedDeckScores, swudbDeckJson, validateDeck,
  type Deck, type DeckFile,
} from "./lib/decks";
import { downloadText } from "./lib/download";
import { Modal } from "./Modal";

const decksData = deckFile as DeckFile;

const specialLabel = (deck: Deck) =>
  deck.special === "prestige" ? "★ Prestige" : deck.special === "showcase" ? "✦ Showcase" : deck.powerBand === "Challenge" ? "◇ Challenge" : null;

function cardName(database: CardDatabase, id: string): string {
  const card = database.cards[id];
  return card ? `${card.name}${card.subtitle ? ` — ${card.subtitle}` : ""}` : id;
}

export function DecksView({ database, entries, onSelectCard }: {
  database: CardDatabase;
  entries: CollectionEntry[];
  onSelectCard: (key: string) => void;
}) {
  const [archetype, setArchetype] = useState("");
  const [leaderSet, setLeaderSet] = useState("");
  const [leaderFilter, setLeaderFilter] = useState("");
  const [aspect, setAspect] = useState("");
  const [special, setSpecial] = useState("");
  const [openDeck, setOpenDeck] = useState<Deck | null>(null);

  const openCard = (key: string) => {
    setOpenDeck(null);
    onSelectCard(key);
  };

  const decks = decksData.decks;
  const archetypes = [...new Set(decks.map((deck) => deck.archetype))].sort();
  const leaders = [...new Set(decks.map((deck) => cardName(database, deck.leader.id)))].sort();
  const colorAspects = ["Vigilance", "Command", "Aggression", "Cunning"];

  const filtered = decks.filter((deck) =>
    (!leaderSet || deck.leader.id.startsWith(`${leaderSet}-`))
    && (!archetype || deck.archetype === archetype)
    && (!leaderFilter || cardName(database, deck.leader.id) === leaderFilter)
    && (!aspect || deck.aspects.includes(aspect))
    && (!special
      || (special === "prestige" && deck.special === "prestige")
      || (special === "showcase" && deck.special === "showcase")
      || (special === "challenge" && deck.powerBand === "Challenge")));

  return <main>
    <div className="page-heading">
      <div>
        <p className="eyebrow">Deck intelligence</p>
        <h1>Decks</h1>
        <p>{decks.length} researched builds from your collection · updated {decksData.generatedAt}</p>
      </div>
    </div>
    <p className="format-note">{decksData.formatLabel}. <span title={decksData.notes}>Not Premier-legal since the March 2026 rotation — great for Eternal and kitchen-table play.</span></p>
    <div className="filters" aria-label="Deck filters">
      <select aria-label="Leader set" value={leaderSet} onChange={(e) => setLeaderSet(e.target.value)}>
        <option value="">All leader sets</option>
        <option value="SOR">Spark of Rebellion</option>
        <option value="ASH">Ashes of the Empire</option>
      </select>
      <select aria-label="Archetype" value={archetype} onChange={(e) => setArchetype(e.target.value)}>
        <option value="">All archetypes</option>{archetypes.map((x) => <option key={x}>{x}</option>)}
      </select>
      <select aria-label="Leader" value={leaderFilter} onChange={(e) => setLeaderFilter(e.target.value)}>
        <option value="">All leaders</option>{leaders.map((x) => <option key={x}>{x}</option>)}
      </select>
      <select aria-label="Aspect" value={aspect} onChange={(e) => setAspect(e.target.value)}>
        <option value="">All aspects</option>{colorAspects.map((x) => <option key={x}>{x}</option>)}
      </select>
      <select aria-label="Special category" value={special} onChange={(e) => setSpecial(e.target.value)}>
        <option value="">All categories</option>
        <option value="prestige">★ Prestige</option>
        <option value="showcase">✦ Showcase</option>
        <option value="challenge">◇ Challenge</option>
      </select>
    </div>
    {!filtered.length
      ? <div className="empty-state"><div className="empty-icon">◇</div><h2>No decks match</h2><p>Remove a filter to see the full portfolio.</p></div>
      : <div className="deck-grid">{filtered.map((deck) => <DeckTile key={deck.id} deck={deck} database={database} entries={entries} onOpen={() => setOpenDeck(deck)} />)}</div>}
    {openDeck && <DeckSheet deck={openDeck} database={database} entries={entries} onClose={() => setOpenDeck(null)} onSelectCard={openCard} />}
  </main>;
}

function DeckTile({ deck, database, entries, onOpen }: { deck: Deck; database: CardDatabase; entries: CollectionEntry[]; onOpen: () => void }) {
  const leader = database.cards[deck.leader.printing] || database.cards[deck.leader.id];
  const coverage = collectionCoverage(deck, entries, database);
  const badge = specialLabel(deck);
  return (
    <button className="deck-tile" onClick={onOpen}>
      <div className="deck-art">
        {leader && <img src={cardImage(leader, deck.leader.variant)} alt="" loading="lazy" />}
        {badge && <span className={`deck-badge ${deck.special || "challenge"}`}>{badge}</span>}
      </div>
      <div className="deck-copy">
        <h3>{deck.name}</h3>
        <p className="deck-meta">{deck.archetype}{deck.secondary ? ` · ${deck.secondary}` : ""}</p>
        <p className="deck-leader">{cardName(database, deck.leader.id)}</p>
        <div className="aspect-row">{deck.aspects.map((item, i) => <span className={`aspect ${item.toLowerCase()}`} key={`${item}${i}`}>{item}</span>)}</div>
        <p className="deck-identity">{deck.identity}</p>
        <p className="deck-owned">{coverage.complete
          ? "All selected printings, leader, and base owned"
          : `${coverage.owned} / 50 selected printings owned`} · {deck.powerBand}</p>
      </div>
    </button>
  );
}

function DeckSheet({ deck, database, entries, onClose, onSelectCard }: {
  deck: Deck; database: CardDatabase; entries: CollectionEntry[]; onClose: () => void; onSelectCard: (key: string) => void;
}) {
  const stats = useMemo(() => deckStats(deck, database), [deck, database]);
  const validation = useMemo(() => validateDeck(deck, database), [deck, database]);
  const coverage = useMemo(() => collectionCoverage(deck, entries, database), [deck, entries, database]);
  const scores = useMemo(() => derivedDeckScores(deck, database, decksData.decks), [deck, database]);
  const [exportStatus, setExportStatus] = useState<"copied" | "downloaded" | null>(null);
  const leader = database.cards[deck.leader.id];
  const base = database.cards[deck.base.id];
  const maxCurve = Math.max(...stats.curve.map((c) => c.count), 1);

  const groups: Array<{ label: string; test: (card: CardRecord) => boolean }> = [
    { label: "Ground units", test: (card) => card.type === "Unit" && card.arena.includes("Ground") },
    { label: "Space units", test: (card) => card.type === "Unit" && card.arena.includes("Space") },
    { label: "Events", test: (card) => card.type === "Event" },
    { label: "Upgrades", test: (card) => card.type === "Upgrade" },
  ];

  const copyExport = async () => {
    const payload = swudbDeckJson(deck);
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Clipboard timed out")), 1500);
        navigator.clipboard.writeText(payload).then(
          () => { clearTimeout(timeout); resolve(); },
          (error) => { clearTimeout(timeout); reject(error); },
        );
      });
      setExportStatus("copied");
      setTimeout(() => setExportStatus(null), 3000);
    } catch {
      downloadText(`${deck.id}-swudb.json`, payload, "application/json");
      setExportStatus("downloaded");
      setTimeout(() => setExportStatus(null), 3000);
    }
  };

  return <Modal title={deck.name} onClose={onClose}>
    <div className="deck-sheet">
      <div className="deck-sheet-head">
        <div className="deck-sheet-art">
          {leader && <img src={cardImage(database.cards[deck.leader.printing] || leader, deck.leader.variant)} alt={`Leader: ${cardName(database, deck.leader.id)}`} />}
          {base && <img src={cardImage(database.cards[deck.base.printing] || base, deck.base.variant)} alt={`Base: ${cardName(database, deck.base.id)}`} />}
        </div>
        <div>
          {specialLabel(deck) && <span className={`deck-badge inline ${deck.special || "challenge"}`}>{specialLabel(deck)}</span>}
          <p className="eyebrow">{deck.archetype}{deck.secondary ? ` · ${deck.secondary}` : ""} · {deck.difficulty}</p>
          <h2>{deck.name}</h2>
          <p><strong>Leader:</strong> {cardName(database, deck.leader.id)}{deck.leader.variant !== "Standard" ? ` (${deck.leader.variant})` : ""}</p>
          <p><strong>Base:</strong> {cardName(database, deck.base.id)}{deck.base.variant !== "Standard" ? ` (${deck.base.variant})` : ""}</p>
          <div className="aspect-row">{deck.aspects.map((item, i) => <span className={`aspect ${item.toLowerCase()}`} key={`${item}${i}`}>{item}</span>)}</div>
          <p className="deck-identity">{deck.identity}</p>
          <p className={validation.errors.length ? "deck-validation bad" : "deck-validation"}>
            {validation.errors.length
              ? `⚠ ${validation.errors.length} validation problem(s)`
              : `✓ Exactly 50 cards · copy limits respected · ${validation.penalized.length ? `${validation.penalized.length} aspect-penalty card(s)` : "no aspect penalties"}`}
          </p>
          {validation.errors.map((error) => <p key={error} className="error-message">{error}</p>)}
          <p className="deck-owned">{coverage.complete
            ? "Your collection covers all 50 selected printings, leader, and base."
            : `Your on-device collection covers ${coverage.owned} of 50 selected main-deck printings${!coverage.leaderOwned || !coverage.baseOwned ? "; leader or base is also missing" : ""}.`}</p>
          {coverage.missing.length > 0 && <details><summary>Missing from this device's collection</summary>
            <ul>{coverage.missing.map(({ card, short, variant, kind }) => <li key={`${kind}-${card.key}-${variant}`}>{short}× {card.name}{card.subtitle ? ` — ${card.subtitle}` : ""} · {variant}{kind !== "main" ? ` (${kind})` : ""}</li>)}</ul>
          </details>}
          <div className="deck-actions">
            <button className="primary" onClick={copyExport}>{exportStatus === "copied" ? "Copied — paste in SWUDB ✓" : exportStatus === "downloaded" ? "JSON downloaded ✓" : "Copy JSON for SWUDB"}</button>
            <button onClick={() => downloadText(`${deck.id}-swudb.json`, swudbDeckJson(deck), "application/json")}>Download export</button>
          </div>
          <p className="muted export-help">In SWUDB, start a deck import, choose JSON, and paste the copied content. If clipboard access is blocked, this button downloads the same JSON instead.</p>
        </div>
      </div>

      <section aria-label="Deck statistics" className="deck-stats">
        <div className="curve" role="img" aria-label={`Cost curve: ${stats.curve.map((c) => `${c.count} cards at cost ${c.bucket}`).join(", ")}`}>
          {stats.curve.map(({ bucket, count }) => (
            <div className="curve-col" key={bucket}>
              <span className="curve-count">{count}</span>
              <i style={{ height: `${(count / maxCurve) * 64}px` }} />
              <span className="curve-label">{bucket}</span>
            </div>
          ))}
        </div>
        <div className="deck-stat-list">
          <span><b>{stats.types.Unit || 0}</b> units</span>
          <span><b>{stats.types.Event || 0}</b> events</span>
          <span><b>{stats.types.Upgrade || 0}</b> upgrades</span>
          <span><b>{stats.arenas.Ground || 0}</b> ground</span>
          <span><b>{stats.arenas.Space || 0}</b> space</span>
          <span><b>{stats.earlyUnits}</b> units at cost ≤ 2</span>
        </div>
        <p className="muted">{deck.spacePolicy}</p>
      </section>

      <section aria-label="Deck list">
        <h3>Deck list — 50 cards</h3>
        {groups.map((group) => {
          const rows = deck.cards.filter((entry) => { const card = database.cards[entry.id]; return card && group.test(card); });
          if (!rows.length) return null;
          const total = rows.reduce((sum, row) => sum + row.count, 0);
          return <div key={group.label} className="deck-group">
            <h4>{group.label} · {total}</h4>
            <ul className="deck-list">
              {rows.map((entry) => {
                const card = database.cards[entry.id];
                const fancy = entry.printings.filter((p) => p.variant !== "Standard");
                return <li key={entry.id}>
                  <button className="deck-card-row" onClick={() => onSelectCard(entry.id)}>
                    <b>{entry.count}×</b>
                    <span>{card.name}{card.subtitle ? ` — ${card.subtitle}` : ""}</span>
                    <em>{card.cost}c</em>
                    {fancy.map((p) => <i className="variant-chip" key={p.variant}>{p.count}× {p.variant}</i>)}
                  </button>
                </li>;
              })}
            </ul>
          </div>;
        })}
      </section>

      <section aria-label="Strategy guide" className="deck-guide">
        <h3>How to play it</h3>
        <p><strong>Win condition.</strong> {deck.guide.winCondition}</p>
        <p><strong>Early game.</strong> {deck.guide.earlyGame}</p>
        <p><strong>Mid game.</strong> {deck.guide.midGame}</p>
        <p><strong>Late game.</strong> {deck.guide.lateGame}</p>

        <h4>Opening-hand priorities</h4>
        <div className="chip-row">{deck.guide.openingPriorities.map((name) => <span className="chip" key={name}>{name}</span>)}</div>

        <h4>Mulligan</h4>
        <ul>{deck.guide.mulligan.map((line) => <li key={line}>{line}</li>)}</ul>

        <h4>Key combinations</h4>
        <ul className="combo-list">{deck.guide.combos.map((combo) => (
          <li key={combo.cards.join("+")}><b>{combo.cards.join(" + ")}</b><br />{combo.note}</li>
        ))}</ul>

        <h4>Resource priorities</h4>
        <ul>{deck.guide.resourcePriorities.map((line) => <li key={line}>{line}</li>)}</ul>

        <h4>Weaknesses</h4>
        <ul>{deck.guide.weaknesses.map((line) => <li key={line}>{line}</li>)}</ul>

        <h4>Collection adjustments <small>(cards you already own)</small></h4>
        <ul>{deck.guide.adjustments.map((line) => <li key={line}>{line}</li>)}</ul>

        <div className="acquisitions">
          <h4>Future acquisitions <small>· not owned · never included in the deck or export</small></h4>
          <ul>{deck.guide.acquisitions.map((line) => <li key={line}>{line}</li>)}</ul>
        </div>

        {deck.special && <p className="muted score-note">
          {deck.special === "prestige"
            ? `Prestige score ${scores.prestige}/100 = 45% expert gameplay rating (${scores.gameplay}) + 30% rarity (${scores.rarity}) + 25% collector value (${scores.collector}). Rarity and collector value are calculated from this deck and the dated card-database price snapshot (€${scores.marketValue.toFixed(2)}), not entered by hand or fetched at runtime.`
            : `Showcase score ${scores.showcase}/100 = 55% expert deck quality (${scores.gameplay}) + 30% cosmetic density (${scores.cosmeticCopies}/50 non-Standard cards) + 15% variety (${scores.cosmeticVariety}/3 variant kinds). Every printing is verified against your collection.`}
        </p>}
      </section>
    </div>
  </Modal>;
}
