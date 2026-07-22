import { useMemo, useState } from "react";
import travelFileJson from "./data/travel-decks.json";
import type { CardDatabase, CardRecord, CollectionEntry } from "./types";
import { cardImage } from "./lib/cards";
import { collectionCoverage, deckStats, swudbDeckJson } from "./lib/decks";
import { rosterCheck, type TravelDeck, type TravelFile } from "./lib/travel";
import { downloadText } from "./lib/download";
import { Modal } from "./Modal";

const travelData = travelFileJson as TravelFile;

function cardName(database: CardDatabase, id: string): string {
  const card = database.cards[id];
  return card ? `${card.name}${card.subtitle ? ` — ${card.subtitle}` : ""}` : id;
}

export function TravelView({ database, entries, onSelectCard }: {
  database: CardDatabase;
  entries: CollectionEntry[];
  onSelectCard: (key: string) => void;
}) {
  const [openDeck, setOpenDeck] = useState<TravelDeck | null>(null);
  const roster = travelData.roster;
  const check = useMemo(() => rosterCheck(roster, entries, database), [roster, entries, database]);

  const openCard = (key: string) => { setOpenDeck(null); onSelectCard(key); };

  return <main>
    <div className="page-heading">
      <div>
        <p className="eyebrow">Deck boxes</p>
        <h1>Travel Decks</h1>
        <p>{roster.length} decks · one per box · updated {travelData.generatedAt}</p>
      </div>
    </div>
    <p className="format-note">{travelData.note}</p>

    <section className={check.buildable ? "roster-check ok" : "roster-check bad"}>
      {check.buildable
        ? <p><strong>✓ All {roster.length} decks build at once.</strong> {check.physicalCards} physical cards allocated ({check.mainCards} main-deck + {roster.length} leaders + {roster.length} bases), and no card, leader, or base is used more than you own.</p>
        : <>
            <p><strong>⚠ {check.conflicts.length} card{check.conflicts.length === 1 ? "" : "s"} over-allocated.</strong> Your current collection no longer covers every copy — these decks can't all be built at once until the counts are restored:</p>
            <ul>{check.conflicts.map((c) => <li key={c.identityKey}>{c.name}: uses {c.used}, owns {c.owned}</li>)}</ul>
          </>}
    </section>

    <div className="deck-grid">
      {roster.map((deck) => <TravelTile key={deck.id} deck={deck} database={database} entries={entries} onOpen={() => setOpenDeck(deck)} />)}
    </div>

    {openDeck && <TravelSheet deck={openDeck} database={database} entries={entries} onClose={() => setOpenDeck(null)} onSelectCard={openCard} />}
  </main>;
}

function TravelTile({ deck, database, entries, onOpen }: { deck: TravelDeck; database: CardDatabase; entries: CollectionEntry[]; onOpen: () => void }) {
  const leader = database.cards[deck.leader.printing] || database.cards[deck.leader.id];
  const coverage = collectionCoverage(deck, entries, database);
  const cardCount = deck.cards.reduce((sum, card) => sum + card.count, 0);
  return (
    <button className="deck-tile" onClick={onOpen}>
      <div className="deck-art">
        {leader && <img src={cardImage(leader, deck.leader.variant)} alt="" loading="lazy" />}
        <span className="deck-badge showcase">◪ Box</span>
      </div>
      <div className="deck-copy">
        <h3>{deck.name}</h3>
        <p className="deck-meta">{deck.archetype}</p>
        <p className="deck-leader">{cardName(database, deck.leader.id)}</p>
        <div className="aspect-row">{deck.aspects.map((item, i) => <span className={`aspect ${item.toLowerCase()}`} key={`${item}${i}`}>{item}</span>)}</div>
        <p className="deck-identity">{deck.identity}</p>
        <p className="deck-owned">{coverage.complete ? "All 50 cards, leader, and base owned" : `${coverage.owned} / 50 cards owned`} · {cardCount + 2} cards in the box</p>
      </div>
    </button>
  );
}

function TravelSheet({ deck, database, entries, onClose, onSelectCard }: {
  deck: TravelDeck; database: CardDatabase; entries: CollectionEntry[]; onClose: () => void; onSelectCard: (key: string) => void;
}) {
  const stats = useMemo(() => deckStats(deck, database), [deck, database]);
  const coverage = useMemo(() => collectionCoverage(deck, entries, database), [deck, entries, database]);
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
          <p className="eyebrow">{deck.archetype}</p>
          <h2>{deck.name}</h2>
          <p><strong>Leader:</strong> {cardName(database, deck.leader.id)}{deck.leader.variant !== "Standard" ? ` (${deck.leader.variant})` : ""}</p>
          <p><strong>Base:</strong> {cardName(database, deck.base.id)}{deck.base.variant !== "Standard" ? ` (${deck.base.variant})` : ""}</p>
          <div className="aspect-row">{deck.aspects.map((item, i) => <span className={`aspect ${item.toLowerCase()}`} key={`${item}${i}`}>{item}</span>)}</div>
          <p className="deck-identity">{deck.identity}</p>
          <p className="deck-owned">{coverage.complete
            ? "Your collection covers all 50 cards, the leader, and the base for this box."
            : `Your collection currently covers ${coverage.owned} of 50 cards${!coverage.leaderOwned || !coverage.baseOwned ? "; leader or base is also short" : ""}.`}</p>
          <div className="deck-actions">
            <button className="primary" onClick={copyExport}>{exportStatus === "copied" ? "Copied — paste in SWUDB ✓" : exportStatus === "downloaded" ? "JSON downloaded ✓" : "Copy JSON for SWUDB"}</button>
            <button onClick={() => downloadText(`${deck.id}-swudb.json`, swudbDeckJson(deck), "application/json")}>Download export</button>
          </div>
          <p className="muted export-help">Copy the deck into SWUDB, or use the list below to fill the physical deck box.</p>
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
    </div>
  </Modal>;
}
