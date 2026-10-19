# Tekken Book — updated app and combo updater

The existing app at `C:\Users\mjiya\Desktop\Tekken Book\azucena-tekken8-movelist` has already been updated in place. The ZIP is a portable copy. The original app is saved separately in the backup ZIP.

## What changed

- Simpler layout with Moves as the default view; extra filters and notation help expand when needed.
- Light/dark mode button at the top. It starts with your system theme and remembers your choice.
- Searchable Season 3 combo cards showing damage, hits, patch, Heat/Wall/Counter Hit conditions, contributor, and original source link.
- Sort combos by highest damage or fewest hits. Existing move data and PDF export are retained.

## Run the app

1. Use the updated Desktop folder, or extract `Tekken-Book-Updated.zip` into a new folder.
2. Install Node.js 22 or newer from https://nodejs.org/ if `node --version` is unavailable.
3. Double-click **Start Tekken Book.cmd**. Keep its terminal open.
4. Open http://127.0.0.1:8080 in your browser. Press Ctrl+C in the terminal to stop the server.

Do not open index.html directly: the app fetches local JSON and needs an HTTP server.

Equivalent PowerShell commands:

```powershell
Set-Location 'C:\Users\mjiya\Desktop\Tekken Book\azucena-tekken8-movelist'
node tools/serve.mjs
```

## Extract and update the combos

Double-click **Update Combos.cmd**. The first step installs the locked Cheerio dependency with npm. An internet connection is required. When it finishes, refresh the browser.

Or run these commands from the app folder:

```powershell
npm ci --prefix tools
node tools/update-combos.mjs
```

To check the source without changing the data file:

```powershell
node tools/update-combos.mjs --dry-run
```

To run parser checks:

```powershell
npm test --prefix tools
```

The updater follows the source collection's Next links, with a delay between requests. It reads factual combo notation, damage, hit counts, explicit v3.x patch tags, conditions, contributor names, and source URLs. It does not copy images or guide prose. Jin is mapped to the app's `jin-kazama` ID. It prints a character coverage report and merges the curated supplemental reference file. See SEASON3-SOURCES.md for those references and their patch precision.

The entire download must match the collection's declared count before anything is replaced. HTTP failures, changed markup, missing numeric damage, older patches, looping pagination, or an incomplete download stop the update. The previous complete file is kept as `data/combos-season3.json.bak` on subsequent updates. If the site changes during a download, rerun once; if it keeps failing, adjust `parsePage()` to the new markup. Do not replace missing values with guessed damage.

## Publish to GitHub Pages

Repository: [Mjiyako/azucena-tekken8-movelist](https://github.com/Mjiyako/azucena-tekken8-movelist).

Live app: https://mjiyako.github.io/azucena-tekken8-movelist/

GitHub Pages builds and deploys this static app from `main`. There is no application build step. After refreshing combos locally, publish the updated data with:

```powershell
Set-Location 'C:\Users\mjiya\Desktop\Tekken Book\azucena-tekken8-movelist'
node tools/update-combos.mjs
git add data/combos-season3.json
git commit -m "Refresh Season 3 combos"
git push origin main
```

If you edited curated references, also run `git add data/combos-season3-supplemental.json` before committing. For code or layout changes, stage the specific changed source files too. If Git reports nothing to commit, the tracked content is already current.

Wait for the **pages build and deployment** run under the repository's Actions tab to succeed, then reload the live app online. Installed copies may need to be closed and reopened after the deployment. The service worker uses the network first and caches successful responses for offline use.

`Update Combos.cmd` refreshes the local data; publishing requires the Git commands above. Dependencies and data backups are ignored by Git. `_config.yml` excludes local tools and launchers from the Pages output, while keeping them in the repository so you can run the updater after cloning it.

## Sources and coverage — 19 October 2026

All **41 of 41 app characters** now have combo entries. The dataset contains 206 primary source records plus 14 curated supplemental records; 215 of these records belong to the app roster and five Miary Zo records are retained outside that roster.

Primary source: [Tekken 8 Combo Season 3 collection](https://tekken8combo.kagewebsite.com/selection-season-3-combo/).

Supplemental sources: [Anna's Season 3 video by TheFURY](https://www.youtube.com/watch?v=HKGx3Syazxw), and the Season 3-era Tekken 8 combo references for [Armor King](https://wavu.wiki/t/Armor_King_combos), [Lars](https://wavu.wiki/t/Lars_combos), [Leo](https://wavu.wiki/t/Leo_combos), [Leroy](https://wavu.wiki/t/Leroy_combos), [Nina](https://wavu.wiki/t/Nina_combos), and [Shaheen](https://wavu.wiki/t/Shaheen_combos).

The wiki references' Season 3 association is inferred from their Season 3-era revisions and explicitly linked Season 3 guides. Individual routes do not identify an exact patch; the app displays that limitation on each card. Damage is taken from the source or obtained by adding an explicitly listed launcher value to a source extension marked +N. No hit counts or exact patch numbers are invented. See **SEASON3-SOURCES.md** for all added notation, totals, arithmetic, snapshot links, and execution notes.

The updater preserves `data/combos-season3-supplemental.json` on every refresh. Those curated references require manual source review if future patches change them. Jack-8's source alias is now correctly mapped, so its four existing v3.02 combos appear in the app.

Damage depends on the listed route, Heat, counter hits, walls, stage conditions, and game version. Source values have not been independently tested in practice mode.

## Validation

Five importer tests pass, including character alias mapping and preservation/validation of supplemental records. The complete 21-page refresh succeeds. JavaScript syntax checks pass. Browser checks confirm damage cards for all eight previously missing characters. The prior theme and search behavior remain intact. The existing PDF export code is retained; PDF output has not been independently revalidated.
