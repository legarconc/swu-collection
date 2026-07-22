import { useEffect, useMemo, useRef, useState } from "react";
import type { CardDatabase, CardRecord, CollectionEntry } from "./types";
import { cardImage } from "./lib/cards";
import { mergeCollections, setEntryCount } from "./lib/collection";
import { downloadText } from "./lib/download";
import { exportFull, exportSwudb, parseCollectionFile, type ImportResult } from "./lib/formats";
import { DecksView } from "./DecksView";
import { TravelView } from "./TravelView";
import { Modal } from "./Modal";

type View = "collection" | "decks" | "travel" | "stats" | "transfer" | "settings";
const STORAGE_KEY = "swu-collection-v1";
const MODIFIED_KEY = "swu-collection-modified-v1";

function readCollection(): CollectionEntry[] {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

const totalCount = (entries: CollectionEntry[]) => entries.reduce((sum, item) => sum + item.count, 0);
const cardKey = (entry: Pick<CollectionEntry, "set" | "number">) => `${entry.set}-${entry.number}`;
const cardsLabel = (count: number) => `${count} ${count === 1 ? "card" : "cards"}`;

function App() {
  const [database, setDatabase] = useState<CardDatabase | null>(null);
  const [loadError, setLoadError] = useState("");
  const [entries, setEntries] = useState<CollectionEntry[]>(readCollection);
  const [lastModified, setLastModified] = useState(() => localStorage.getItem(MODIFIED_KEY) || "");
  const [view, setView] = useState<View>("collection");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}cards.json`)
      .then((response) => {
        if (!response.ok) throw new Error(`Card database returned ${response.status}`);
        return response.json();
      })
      .then(setDatabase)
      .catch((error: Error) => setLoadError(error.message));
  }, []);

  // On a device that has never stored a collection, seed it from the published
  // baseline (data/collection.txt) so a new phone or browser opens populated.
  // A device that already has data — or was deliberately cleared to "[]" — is
  // left untouched; the Import / Export tab can reload the published copy.
  useEffect(() => {
    if (!database || localStorage.getItem(STORAGE_KEY) !== null) return;
    let cancelled = false;
    fetch(`${import.meta.env.BASE_URL}collection.txt`)
      .then((response) => (response.ok ? response.text() : null))
      .then((text) => {
        if (cancelled || !text) return;
        const result = parseCollectionFile(text, database);
        if (result.entries.length) save(result.entries);
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [database]);

  const save = (next: CollectionEntry[]) => {
    const now = new Date().toISOString();
    setEntries(next);
    setLastModified(now);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    localStorage.setItem(MODIFIED_KEY, now);
  };

  const selected = selectedKey && database ? database.cards[selectedKey] : null;

  if (loadError) return <main className="load-state"><div className="empty-icon">!</div><h1>Card data could not load</h1><p>{loadError}</p><button onClick={() => location.reload()}>Try again</button></main>;
  if (!database) return <main className="load-state"><div className="spinner" /><h1>Opening your collection…</h1><p>Loading the offline card database.</p></main>;

  return (
    <div className="app-shell">
      <aside className="side-nav">
        <Brand />
        <Navigation view={view} onChange={setView} />
        <p className="side-note">Edits stay on this device</p>
      </aside>
      <div className="content-shell">
        <header className="topbar"><Brand /><span className="collection-total">{cardsLabel(totalCount(entries))}</span></header>
        {view === "collection" && <CollectionView database={database} entries={entries} onSelect={setSelectedKey} onAdd={() => setAdding(true)} />}
        {view === "decks" && <DecksView database={database} entries={entries} onSelectCard={setSelectedKey} />}
        {view === "travel" && <TravelView database={database} entries={entries} onSelectCard={setSelectedKey} />}
        {view === "stats" && <StatsView database={database} entries={entries} />}
        {view === "transfer" && <TransferView database={database} entries={entries} onImport={(incoming, mode) => save(mergeCollections(entries, incoming, mode))} />}
        {view === "settings" && <SettingsView database={database} entries={entries} lastModified={lastModified} onClear={() => save([])} />}
      </div>
      <nav className="bottom-nav"><Navigation view={view} onChange={setView} /></nav>
      {selected && <CardSheet card={selected} entries={entries} onClose={() => setSelectedKey(null)} onCount={(variant, count) => save(setEntryCount(entries, { set: selected.set, number: selected.number, variant }, count))} />}
      {adding && <AddCardSheet database={database} entries={entries} onClose={() => setAdding(false)} onAdd={(card, variant, count) => { save(setEntryCount(entries, { set: card.set, number: card.number, variant }, count)); setAdding(false); }} />}
    </div>
  );
}

function Brand() {
  return <div className="brand"><span className="brand-mark">SC</span><span>SWU Collection</span></div>;
}

function Navigation({ view, onChange }: { view: View; onChange: (view: View) => void }) {
  const tabs: Array<{ id?: View; icon: string; label: string; disabled?: boolean }> = [
    { id: "collection", icon: "▦", label: "Collection" },
    { id: "decks", icon: "◇", label: "Decks" },
    { id: "travel", icon: "◪", label: "Travel" },
    { id: "stats", icon: "⌁", label: "Stats" },
    { id: "transfer", icon: "⇅", label: "Import / Export" },
    { id: "settings", icon: "⚙", label: "Settings" },
  ];
  return <div className="nav-items">{tabs.map((tab) => <button key={tab.label} className={tab.id === view ? "active" : ""} disabled={tab.disabled} title={tab.disabled ? "Coming soon" : undefined} onClick={() => tab.id && onChange(tab.id)}><span>{tab.icon}</span><small>{tab.label}</small>{tab.disabled && <em>Soon</em>}</button>)}</div>;
}

interface OwnedCard { card: CardRecord; entries: CollectionEntry[]; count: number }

function CollectionView({ database, entries, onSelect, onAdd }: { database: CardDatabase; entries: CollectionEntry[]; onSelect: (key: string) => void; onAdd: () => void }) {
  const [search, setSearch] = useState("");
  const [aspect, setAspect] = useState("");
  const [type, setType] = useState("");
  const [rarity, setRarity] = useState("");
  const [variant, setVariant] = useState("");
  const [depth, setDepth] = useState("");
  const owned = useMemo(() => {
    const grouped = new Map<string, CollectionEntry[]>();
    entries.forEach((entry) => grouped.set(cardKey(entry), [...(grouped.get(cardKey(entry)) || []), entry]));
    return [...grouped.entries()].flatMap(([key, cardEntries]): OwnedCard[] => {
      const card = database.cards[key];
      return card ? [{ card, entries: cardEntries, count: totalCount(cardEntries) }] : [];
    });
  }, [database, entries]);
  const filtered = owned.filter(({ card, entries: cardEntries, count }) => {
    const needle = search.trim().toLowerCase();
    return (!needle || `${card.name} ${card.subtitle}`.toLowerCase().includes(needle))
      && (!aspect || card.aspects.includes(aspect))
      && (!type || card.type === type)
      && (!rarity || card.rarity === rarity)
      && (!variant || cardEntries.some((entry) => entry.variant === variant))
      && (!depth || (depth === "3" ? count >= 3 : count === Number(depth)));
  });
  const options = (field: "aspects" | "type" | "rarity") => [...new Set(Object.values(database.cards).flatMap((card) => field === "aspects" ? card.aspects : [card[field]]).filter(Boolean))].sort();
  const variants = [...new Set(entries.map((entry) => entry.variant))].sort();
  return <main>
    <div className="page-heading"><div><p className="eyebrow">Your library</p><h1>Collection</h1><p>{owned.length} unique {owned.length === 1 ? "printing" : "printings"} · {cardsLabel(totalCount(entries))}</p></div><button className="primary add-button" onClick={onAdd}>＋ Add card</button></div>
    <div className="search-wrap"><span>⌕</span><input aria-label="Search collection" type="search" placeholder="Search name or subtitle" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
    <div className="filters" aria-label="Collection filters">
      <select aria-label="Aspect" value={aspect} onChange={(e) => setAspect(e.target.value)}><option value="">All aspects</option>{options("aspects").map((x) => <option key={x}>{x}</option>)}</select>
      <select aria-label="Type" value={type} onChange={(e) => setType(e.target.value)}><option value="">All types</option>{options("type").map((x) => <option key={x}>{x}</option>)}</select>
      <select aria-label="Rarity" value={rarity} onChange={(e) => setRarity(e.target.value)}><option value="">All rarities</option>{options("rarity").map((x) => <option key={x}>{x}</option>)}</select>
      <select aria-label="Variant" value={variant} onChange={(e) => setVariant(e.target.value)}><option value="">All variants</option>{variants.map((x) => <option key={x}>{x}</option>)}</select>
      <select aria-label="Ownership depth" value={depth} onChange={(e) => setDepth(e.target.value)}><option value="">All copies</option><option value="3">Playset 3+</option><option value="2">2 copies</option><option value="1">1 copy</option></select>
    </div>
    {!entries.length ? <EmptyCollection onAdd={onAdd} /> : !filtered.length ? <div className="empty-state"><div className="empty-icon">⌕</div><h2>No matches</h2><p>Try removing a filter or using a shorter search.</p></div> : <div className="card-grid">{filtered.map(({ card, entries: cardEntries, count }) => {
      const lead = cardEntries[0];
      const image = cardImage(card, lead.variant);
      const foil = cardEntries.some((entry) => /foil/i.test(entry.variant));
      const hyper = cardEntries.some((entry) => /hyperspace/i.test(entry.variant));
      return <button className="card-tile" key={card.key} onClick={() => onSelect(card.key)}><div className="card-image"><img src={image} alt={`${card.name}${card.subtitle ? ` — ${card.subtitle}` : ""}`} loading="lazy" /><strong>{count}</strong><div className="printing-flags">{hyper && <span>H</span>}{foil && <span>✦</span>}</div></div><h3>{card.name}</h3><p>{card.subtitle || `${card.set} ${card.number}`}</p></button>;
    })}</div>}
  </main>;
}

function EmptyCollection({ onAdd }: { onAdd: () => void }) {
  return <div className="empty-state"><div className="empty-icon">▦</div><h2>Your collection is empty</h2><p>Import your HoloDeck export to get started, or add your first card by hand.</p><button onClick={onAdd}>Add a card</button></div>;
}

function CardSheet({ card, entries, onClose, onCount }: { card: CardRecord; entries: CollectionEntry[]; onClose: () => void; onCount: (variant: string, count: number) => void }) {
  const variants = [...new Set([...Object.keys(card.printings), ...entries.filter((e) => cardKey(e) === card.key).map((e) => e.variant)])];
  const owned = entries.filter((entry) => cardKey(entry) === card.key);
  const [activeVariant, setActiveVariant] = useState(owned[0]?.variant || card.defaultVariant);
  const [editing, setEditing] = useState(false);
  return <Modal title={card.name} onClose={onClose}><div className="detail-layout"><div className="detail-art"><img src={cardImage(card, activeVariant)} alt={card.name} onError={(event) => { event.currentTarget.src = card.images.front; }} /><div className="variant-pills">{variants.map((item) => <button className={item === activeVariant ? "active" : ""} key={item} onClick={() => setActiveVariant(item)}>{item}</button>)}</div></div><div className="detail-copy"><p className="eyebrow">{card.set} · {String(card.number).padStart(3, "0")} · {card.rarity}</p><h2>{card.name}</h2>{card.subtitle && <p className="subtitle">{card.subtitle}</p>}<div className="aspect-row">{card.aspects.map((item) => <span className={`aspect ${item.toLowerCase()}`} key={item}>{item}</span>)}</div><div className="stat-row"><Stat label="Cost" value={card.cost} /><Stat label="Power" value={card.power} /><Stat label="HP" value={card.hp} /><Stat label="Arena" value={card.arena.join(", ") || "—"} /></div>{card.traits.length > 0 && <p className="traits">{card.traits.join(" · ")}</p>}<div className="ability">{card.text || "No ability text."}</div><div className="owned-heading"><h3>Owned printings</h3><button onClick={() => setEditing((value) => !value)}>{editing ? "Done" : "Edit counts"}</button></div>{editing ? <div className="steppers">{variants.map((variant) => { const count = owned.find((entry) => entry.variant === variant)?.count || 0; return <div className="stepper" key={variant}><span>{variant}</span><div><button aria-label={`Remove one ${variant}`} onClick={() => onCount(variant, count - 1)}>−</button><strong>{count}</strong><button aria-label={`Add one ${variant}`} onClick={() => onCount(variant, count + 1)}>＋</button></div></div>; })}</div> : <div className="owned-list">{owned.length ? owned.map((entry) => <div key={entry.variant}><span>{entry.variant}</span><strong>{entry.count}</strong></div>) : <p>None owned yet.</p>}</div>}</div></div></Modal>;
}

function Stat({ label, value }: { label: string; value: string | number | null }) {
  return <div><small>{label}</small><strong>{value ?? "—"}</strong></div>;
}

function AddCardSheet({ database, entries, onClose, onAdd }: { database: CardDatabase; entries: CollectionEntry[]; onClose: () => void; onAdd: (card: CardRecord, variant: string, count: number) => void }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<CardRecord | null>(null);
  const [variant, setVariant] = useState("");
  const [count, setCount] = useState("1");
  const parsedCount = Number(count);
  const validCount = Number.isInteger(parsedCount) && parsedCount > 0;
  const matches = query.trim().length < 2 ? [] : Object.values(database.cards).filter((card) => `${card.name} ${card.subtitle} ${card.set} ${card.number}`.toLowerCase().includes(query.toLowerCase())).slice(0, 30);
  return <Modal title="Add card" onClose={onClose}>{!selected ? <><label className="field-label" htmlFor="add-search">Search the full card database</label><div className="search-wrap"><span>⌕</span><input id="add-search" autoFocus type="search" placeholder="Card name, set, or number" value={query} onChange={(e) => setQuery(e.target.value)} /></div><div className="search-results">{query.length < 2 && <p>Type at least two characters.</p>}{matches.map((card) => <button key={card.key} onClick={() => { setSelected(card); setVariant(card.defaultVariant); }}><img src={card.images.front} alt="" /><span><strong>{card.name}</strong><small>{card.subtitle || "No subtitle"}</small><em>{card.set} {card.number} · {card.defaultVariant}</em></span></button>)}</div></> : <div className="add-selection"><button className="back-link" onClick={() => setSelected(null)}>← Search again</button><div className="selected-card"><img src={cardImage(selected, variant)} alt={selected.name} onError={(event) => { event.currentTarget.src = selected.images.front; }} /><div><h2>{selected.name}</h2><p>{selected.subtitle}</p><label>Printing<select value={variant} onChange={(e) => setVariant(e.target.value)}>{Object.keys(selected.printings).map((item) => <option key={item}>{item}</option>)}</select></label><label>Count<input type="number" min="1" inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value)} /></label><button className="primary wide" disabled={!validCount} onClick={() => validCount && onAdd(selected, variant, parsedCount)}>{entries.some((entry) => cardKey(entry) === selected.key && entry.variant === variant) ? "Update count" : "Add to collection"}</button></div></div></div>}</Modal>;
}

function TransferView({ database, entries, onImport }: { database: CardDatabase; entries: CollectionEntry[]; onImport: (entries: CollectionEntry[], mode: "replace" | "merge") => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<ImportResult | null>(null);
  const [summary, setSummary] = useState<ImportResult | null>(null);
  const [error, setError] = useState("");
  const readFile = async (file?: File) => {
    if (!file) return;
    try { setError(""); setPending(parseCollectionFile(await file.text(), database)); } catch (err) { setError(err instanceof Error ? err.message : "Could not read this file."); }
    if (fileRef.current) fileRef.current.value = "";
  };
  const commit = (mode: "replace" | "merge") => { if (!pending) return; onImport(pending.entries, mode); setSummary(pending); setPending(null); };
  const loadPublished = async () => {
    try {
      setError("");
      const response = await fetch(`${import.meta.env.BASE_URL}collection.txt`);
      if (!response.ok) throw new Error("No published collection is available for this site yet.");
      setPending(parseCollectionFile(await response.text(), database));
    } catch (err) { setError(err instanceof Error ? err.message : "Could not load the published collection."); }
  };
  return <main><div className="page-heading"><div><p className="eyebrow">Portable by design</p><h1>Import / Export</h1><p>Your files stay on this device.</p></div></div><div className="panel-grid"><section className="panel"><div className="panel-icon">⇧</div><h2>Import collection</h2><p>Choose a HoloDeck / HoloScan TXT or a SWUDB CSV file, or reload the collection published with this site. You’ll review it before anything changes.</p><input ref={fileRef} hidden type="file" accept=".txt,.csv,text/plain,text/csv" onChange={(e) => readFile(e.target.files?.[0])} /><button className="primary wide" onClick={() => fileRef.current?.click()}>Choose file</button><button className="wide" onClick={loadPublished}>Load published collection</button>{error && <p className="error-message">{error}</p>}</section><section className="panel"><div className="panel-icon">⇩</div><h2>Export a backup</h2><p>Keep a copy somewhere safe before clearing browser data or changing phones.</p><button className="wide" disabled={!entries.length} onClick={() => downloadText("swu-collection-swudb.csv", exportSwudb(entries), "text/csv;charset=utf-8")}>Download SWUDB CSV</button><button className="wide" disabled={!entries.length} onClick={() => downloadText("swu-collection-full.txt", exportFull(entries, database))}>Download full TXT</button></section></div>{summary && <ImportSummary result={summary} onClose={() => setSummary(null)} />}{pending && <Modal title="How should this import be applied?" onClose={() => setPending(null)}><ImportPreview result={pending} /><div className="dialog-actions"><button onClick={() => commit("replace")}>Replace collection</button><button className="primary" onClick={() => commit("merge")}>Merge and add counts</button></div></Modal>}</main>;
}

function ImportPreview({ result }: { result: ImportResult }) {
  const total = result.importedCount;
  return <div className="import-preview"><div className="summary-numbers"><Stat label="Cards ready" value={total} /><Stat label="Entries" value={result.entries.length} /><Stat label="Skipped" value={result.unknown.length + result.invalid.length} /></div>{result.unknown.length > 0 && <details open><summary>{result.unknown.length} unknown card rows</summary><ul>{result.unknown.map((item) => <li key={item.row}>Row {item.row}: {item.set} {item.number} — {item.reason}</li>)}</ul></details>}{result.invalid.length > 0 && <details open><summary>{result.invalid.length} invalid rows</summary><ul>{result.invalid.map((item) => <li key={item.row}>Row {item.row}: {item.reason}</li>)}</ul></details>}<p className="muted">No skipped row will be silently added. Sync card data first if a set is missing.</p></div>;
}

function ImportSummary({ result, onClose }: { result: ImportResult; onClose: () => void }) {
  return <section className="panel import-summary"><button className="dismiss" onClick={onClose}>×</button><p className="eyebrow">Import complete</p><h2>{result.importedCount} cards imported</h2><p>{result.unknown.length + result.invalid.length} rows skipped · {result.entries.length} collection entries processed.</p>{result.unknown.length > 0 && <ul>{result.unknown.map((item) => <li key={item.row}>{item.set} {item.number}: {item.reason}</li>)}</ul>}</section>;
}

function StatsView({ database, entries }: { database: CardDatabase; entries: CollectionEntry[] }) {
  const ownedCards = new Map<string, { card: CardRecord; count: number }>();
  entries.forEach((entry) => { const card = database.cards[cardKey(entry)]; if (!card) return; const current = ownedCards.get(card.identityKey); if (current) current.count += entry.count; else ownedCards.set(card.identityKey, { card, count: entry.count }); });
  const foilCount = entries.filter((entry) => /foil/i.test(entry.variant)).reduce((sum, entry) => sum + entry.count, 0);
  const value = entries.reduce((sum, entry) => sum + (entry.priceEach || 0) * entry.count, 0);
  return <main><div className="page-heading"><div><p className="eyebrow">At a glance</p><h1>Stats</h1><p>Completion uses unique card identities, across all printings.</p></div></div><div className="stat-cards"><section><small>Total cards</small><strong>{totalCount(entries)}</strong></section><section><small>Unique cards</small><strong>{ownedCards.size}</strong></section><section><small>Foils</small><strong>{foilCount}</strong></section><section><small>Estimated value</small><strong>{value ? new Intl.NumberFormat("en", { style: "currency", currency: "EUR" }).format(value) : "—"}</strong><em>{value ? "Based on imported prices" : "Import prices not available"}</em></section></div><h2 className="section-title">Sets</h2><div className="set-stats">{database.sets.map((set) => { const setOwned = [...ownedCards.values()].filter(({ card }) => card.set === set.code); const unique = setOwned.length; const percent = set.setSize ? Math.round(unique / set.setSize * 100) : 0; const playsets = setOwned.filter((item) => item.count >= 3).length; const twos = setOwned.filter((item) => item.count === 2).length; const ones = setOwned.filter((item) => item.count === 1).length; return <section key={set.code}><div className="set-stat-head"><div><strong>{set.code}</strong><span>{unique} / {set.setSize} unique</span></div><b>{percent}%</b></div><div className="progress"><i style={{ width: `${Math.min(100, percent)}%` }} /></div><div className="depth-stats"><span><b>{playsets}</b> Playsets 3+</span><span><b>{twos}</b> At 2</span><span><b>{ones}</b> At 1</span></div></section>; })}</div></main>;
}

function SettingsView({ database, entries, lastModified, onClear }: { database: CardDatabase; entries: CollectionEntry[]; lastModified: string; onClear: () => void }) {
  const repo = import.meta.env.VITE_GITHUB_REPOSITORY || (location.hostname.endsWith(".github.io") ? `${location.hostname.split(".")[0]}/${location.pathname.split("/").filter(Boolean)[0]}` : "");
  const syncUrl = repo ? `https://github.com/${repo}/actions/workflows/refresh-cards.yml` : "";
  const clear = () => { if (confirm(`Clear all ${totalCount(entries)} cards from this device? This cannot be undone unless you exported a backup.`)) onClear(); };
  return <main><div className="page-heading"><div><p className="eyebrow">Device and data</p><h1>Settings</h1><p>Collection data never leaves your browser.</p></div></div><div className="settings-list"><section><div><h2>Card database</h2><p>Generated {new Date(database.generatedAt).toLocaleString()} · {database.cardCount} printing records</p></div>{syncUrl ? <a className="button primary" href={syncUrl} target="_blank" rel="noreferrer">Sync card data ↗</a> : <button disabled>Sync available after deploy</button>}<p className="setting-help">This opens GitHub. Sign in, choose “Run workflow”, and wait for the Action to finish. The updated database loads on your next visit.</p></section><section><div><h2>Collection</h2><p>Last modified {lastModified ? new Date(lastModified).toLocaleString() : "never"}</p></div><button className="danger" disabled={!entries.length} onClick={clear}>Clear collection</button></section><section><h2>About / how it works</h2><p>SWU Collection is an offline-first library. Your working collection is saved in this browser’s local storage. A baseline copy is also published with this site, so a new device opens already populated; per-device edits then stay local until you export them. Export a backup before clearing browser data or changing devices.</p><p>Card data comes from the community SWU-DB API through a GitHub Action. The app never calls that API directly.</p></section><section className="coming-soon"><span>◇</span><div><h2>Decks</h2><p>Thirty researched, collection-valid decks live in the Decks tab, including one for every owned Ashes of the Empire leader plus aggressive alternate builds for several of them. Deck data ships with the site and is validated against the card database at build time — the app never calls an AI service.</p></div></section></div></main>;
}

export default App;
