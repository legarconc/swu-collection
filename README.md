# SWU Collection

SWU Collection is a private, mobile-first collection manager for Star Wars Unlimited cards. The site is static and runs on GitHub Pages. Your collection stays in your browser and can be backed up as a file; it is never uploaded to this public repository.

The included card database currently contains the sets listed in [`data/sets.json`](data/sets.json). A weekly GitHub Action refreshes it from the community [SWU-DB API](https://api.swu-db.com).

## 1. Create the public repository and publish this code

The easiest route is GitHub Desktop. Install it from [desktop.github.com](https://desktop.github.com) and sign in to your GitHub account first.

1. Open GitHub Desktop.
2. Choose **File → Add Local Repository**.
3. Click **Choose…** and select this whole project folder (the folder containing this README).
4. If GitHub Desktop says it is not a Git repository, click **create a repository**.
5. Set the repository name to `swu-collection`. Leave the Git ignore and license choices as **None** because this project already supplies them, then click **Create Repository**.
6. In GitHub Desktop, check that the two personal files `Master_Collection.txt` and `Master_Collection_(All_cards).csv` do **not** appear in the Changes list. They are intentionally ignored so your collection is never published.
7. Enter `Initial SWU Collection site` in the Summary box and click **Commit to main**.
8. Click **Publish repository**.
9. Confirm the name is `swu-collection`, uncheck **Keep this code private**, and click **Publish Repository**.

If the folder was already a Git repository, step 4 will not appear; continue with the commit and publish steps.

## 2. Enable GitHub Pages

1. Open the repository on GitHub.com.
2. Click **Settings** in the repository’s top navigation.
3. In the left sidebar, click **Pages**.
4. Under **Build and deployment**, set **Source** to **GitHub Actions**.
5. Return to the repository’s **Actions** tab. The **Build and deploy site** workflow should be running after the first push.
6. Wait for its green check mark. A first deployment usually takes a few minutes.

## 3. Run the card-data refresh for the first time

The repository already contains a generated database so the first deployment works immediately. Run the Action once to confirm automatic updates can commit correctly:

1. Open the repository’s **Actions** tab.
2. In the left list, choose **Refresh card data**.
3. Click **Run workflow** on the right, keep the branch set to `main`, then click the green **Run workflow** button.
4. Refresh the page after a few seconds and open the new workflow run.
5. Wait for a green check mark. If SWU-DB has changed, the Action commits a new `data/cards.json`; if nothing changed, its log says the data is already current.
6. Any new commit automatically starts **Build and deploy site** again. Wait for that workflow to finish too.

No API key or repository secret is needed.

## 4. Open the site and add it to an iPhone Home Screen

For a repository named `swu-collection`, the address is:

`https://YOUR-GITHUB-USERNAME.github.io/swu-collection/`

Replace `YOUR-GITHUB-USERNAME` with the username shown on your GitHub profile. The exact live address also appears in **Settings → Pages** after deployment.

On an iPhone:

1. Open the site in **Safari** while online and wait for the collection screen to appear.
2. Tap Safari’s **Share** button (the square with an upward arrow).
3. Scroll down and tap **Add to Home Screen**.
4. Keep the name **SWU Collection** and tap **Add**.
5. Open it once from the new Home Screen icon. After that first load, the interface and card database work offline. Card images you have already viewed are cached too, up to a sensible device-friendly limit.

## 5. Import the HoloDeck TXT export

1. Save or send the HoloDeck / HoloScan `.txt` export to the Files app on the iPhone.
2. Open **SWU Collection** and tap **Import / Export** in the bottom navigation.
3. Tap **Choose file** under **Import collection**.
4. Pick the TXT file from Files.
5. Review the counts and any skipped rows. Unknown or invalid rows are always listed; none are silently dropped.
6. Choose **Replace collection** for a complete fresh export, or **Merge and add counts** only when the file contains additional cards whose counts should be added to what is already stored.
7. After the import, open **Stats** to check the total. Use **Download full TXT** periodically to keep a backup outside the browser.

The importer also accepts SWUDB CSV files. Imported names, subtitles, rarity, text, and images always come from the synced card database rather than potentially stale text in the import.

## 6. Add a new set when packs release

1. Open `data/sets.json` on GitHub.com.
2. Click the pencil icon (**Edit this file**).
3. Add the new uppercase set code on its own line. Keep a comma after every line except the last. For example:

   ```json
   [
     "SOR",
     "JTL",
     "NEW"
   ]
   ```

4. Click **Commit changes…**, keep **Commit directly to the main branch** selected, and click **Commit changes**.
5. Go to **Actions → Refresh card data → Run workflow** and run it manually.
6. Wait for both the refresh and subsequent deploy workflows to finish. The new set is then searchable in **Add card**.

Use the exact set code used by SWU-DB. If the refresh fails with a 404, check that the set is already available at `https://api.swu-db.com/cards/SETCODE`.

## 7. Troubleshooting

### The deployed site is blank

Open **Settings → Pages** and confirm the source is **GitHub Actions**, not “Deploy from a branch.” Then open **Actions → Build and deploy site**, select the failed run, and read the first red step. The workflow automatically builds Vite with the repository’s project-page path, so do not manually change the base path.

### Card images or card details are missing

Run **Actions → Refresh card data → Run workflow**. When it finishes, wait for **Build and deploy site** to complete and reopen the app while online. If a new set is involved, add its code to `data/sets.json` first.

### A file reports unknown cards

The import summary lists every unknown `SET NUMBER`. Sync card data and try again. If the set is not configured, follow step 6 above. Keep the import summary or original file; skipped rows are never added invisibly.

### The collection disappeared on a new phone or after clearing Safari data

Collections live only in each browser. Open **Import / Export** and import your latest TXT or CSV backup. GitHub Pages does not store a copy.

## Decks (Phase 2)

The **Decks** tab ships 15 researched, deterministic deck recommendations built exclusively from the owner's collection — no AI runs in the app. Deck data lives in `site/src/data/decks.json` and is validated on every build by `scripts/validate-decks.mjs` (exactly 50 cards, 3-copy limit by card identity, zero aspect penalties, real printings, SWUDB export round-trip). When the ignored collection export is present locally, the script additionally verifies every copy and printing against owned quantities; in CI that check is skipped.

Each deck guide shows the full list with owned variants, cost curve, type and arena distribution, opening-hand and mulligan advice, key combos, weaknesses, owned alternatives, clearly separated unowned "future acquisitions" (never part of the 50 or the export), and a copy/download SWUDB JSON export. One deck is the prestige build and one the cosmetic showcase build.

Reusable game knowledge, update instructions, scoring rules, and set-specific research live in [Deck Intelligence documentation](docs/deck-intelligence/README.md). Add one guide under `docs/deck-intelligence/sets/` whenever a new set enters the collection; keep general principles in `general-strategy.md` so later deck batches build on the same foundation.

Spark of Rebellion rotated out of Premier in March 2026, so the decks are labeled Premier-style / Eternal-legal rather than Premier-legal.

## Local development

Node.js 22 or newer is recommended.

```bash
cd site
npm install
npm test
npm run dev
```

To refresh card data locally, run `node scripts/fetch-cards.mjs` from the repository root. To verify a production build, run `npm run build` inside `site`.

The refresh script validates and reapplies `data/card-overrides.json` after downloading card metadata. Add an override only after checking the printed card; collection set/number mistakes should instead be corrected in the private HoloScan export.

## Decisions

- SWU-DB returns foil API numbers such as `379F`, while collection exports use numeric `379` plus a foil flag or variant. The normalizer groups the suffixed and unsuffixed API records under one numeric key and preserves every raw printing record.
- “Unique cards” and set completion use the underlying card identity, so Standard and Hyperspace printings do not inflate completion. Collection tiles remain separated by owned card number so the artwork and printing are clear.
- Future variant strings (for example Showcase or Prestige) are preserved instead of being restricted to a fixed enum.
- Confirmed upstream name/subtitle errors are kept in `data/card-overrides.json` and reapplied by every refresh; collection exports never need to imitate a public API typo.
- Prices are optional estimates from imported HoloDeck data. The site labels totals as estimated and does not fetch live prices.
- The disabled Deck Builder navigation entry is reserved for Phase 2. No recommendation service or secret is included in Phase 1.

## Privacy and data source

Never add personal collection exports to Git. The two provided master collection filenames are already ignored, and generated exports should be kept outside the repository. The committed `data/cards.json` contains public card information only.

SWU-DB is a community data source. This project is not affiliated with Lucasfilm, Disney, Fantasy Flight Games, or SWU-DB.
