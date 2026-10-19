# Tekken Book — updated app and combo updater

The existing app at `C:\Users\mjiya\Desktop\Tekken Book\azucena-tekken8-movelist` has already been updated in place. The ZIP is a portable copy. The original app is saved separately in the backup ZIP.

## What changed

- Simpler layout with Moves as the default view; extra filters and notation help expand when needed.
- Light/dark mode button at the top. It starts with your system theme and remembers your choice.
- Searchable Season 3 combo cards showing damage, hits, patch, Heat/Wall/Counter Hit conditions, contributor, and original source link.
- Combo cards display direction arrows and four-button diagrams, including simultaneous presses and held directions. Text notation can be expanded underneath.
- Season 3 video guide links from RyzingSol and TheFURY appear above the cards where verified. These character-level guide links are separate from each combo's own source attribution.
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

## Automatic GitHub updates

[Refresh combos and deploy Pages](https://github.com/Mjiyako/azucena-tekken8-movelist/actions/workflows/combos-and-pages.yml) checks the primary Season 3 collection every six hours: **02:17, 08:17, 14:17, and 20:17 South Africa time** (00:17, 06:17, 12:17, and 18:17 UTC). GitHub may delay scheduled runs.

The workflow installs the locked dependencies, runs parser tests, downloads and validates the entire collection, and merges the curated supplemental references. When combo content changes, it commits only `data/combos-season3.json` to `main` and explicitly deploys the updated static app to GitHub Pages. Unchanged downloads preserve the data timestamp and create no commit or scheduled deployment. Source errors fail the job before publication, preserving the last live site.

The primary source collection is downloaded every six hours. A separate weekly AI review inspects new RyzingSol and TheFURY Season 3 character combo videos and publishes complete character replacements after verification. Those replacements take priority over collection and supplemental routes. See CREATOR-REVIEWS.md for the review schedule, local runtime requirement, source selection, data contract and publishing steps.

To check immediately, open the workflow above, select **Run workflow**, and choose `main`. A manual run checks combos and redeploys even if data is unchanged, which is useful for recovery or verification. Actions logs show whether the collection changed and whether deployment succeeded. No personal token or additional repository secret is needed at runtime; the workflow uses GitHub's built-in token with job-specific permissions.

GitHub can disable schedules in a public repository after 60 days without repository activity. If that happens, re-enable this workflow in Actions. The site keeps serving its last successful version.

## Publish code changes to GitHub Pages

Repository: [Mjiyako/azucena-tekken8-movelist](https://github.com/Mjiyako/azucena-tekken8-movelist).

Live app: https://mjiyako.github.io/azucena-tekken8-movelist/

GitHub Pages uses **GitHub Actions** as its publishing source. Push app changes to `main` to deploy them. The workflow packages only runtime files and JSON character/combo data; local launchers, dependencies, backup files, and scraper tools are excluded from the published site. `deployment.json` identifies the deployed source commit.

The updater can still run locally with `Update Combos.cmd`. To publish a local refresh manually:

```powershell
Set-Location 'C:\Users\mjiya\Desktop\Tekken Book\azucena-tekken8-movelist'
node tools/update-combos.mjs
git add data/combos-season3.json
git commit -m "Refresh Season 3 combos"
git push origin main
```

If you edited curated references, also stage `data/combos-season3-supplemental.json` before committing. For layout/code changes, stage the specific changed source files. If Git reports nothing to commit, tracked content is already current.

Wait for **Refresh combos and deploy Pages** to succeed in Actions, then reload the live app online. The service worker uses the network first and caches successful responses for offline use.

## Sources and coverage — 19 October 2026

All **41 of 41 app characters** now have combo entries. The dataset contains 206 primary source records plus 15 curated supplemental records; 216 of these records belong to the app roster and five Miary Zo records are retained outside that roster.

Primary source: [Tekken 8 Combo Season 3 collection](https://tekken8combo.kagewebsite.com/selection-season-3-combo/).

Supplemental sources: [Anna's Season 3 video by TheFURY](https://www.youtube.com/watch?v=HKGx3Syazxw), and the Season 3-era Tekken 8 combo references for [Armor King](https://wavu.wiki/t/Armor_King_combos), [Lars](https://wavu.wiki/t/Lars_combos), [Leo](https://wavu.wiki/t/Leo_combos), [Leroy](https://wavu.wiki/t/Leroy_combos), [Nina](https://wavu.wiki/t/Nina_combos), and [Shaheen](https://wavu.wiki/t/Shaheen_combos).

The wiki references' Season 3 association is inferred from their Season 3-era revisions and explicitly linked Season 3 guides. Individual routes do not identify an exact patch; the app displays that limitation on each card. Damage is taken from the source or obtained by adding an explicitly listed launcher value to a source extension marked +N. No hit counts or exact patch numbers are invented. See **SEASON3-SOURCES.md** for all added notation, totals, arithmetic, snapshot links, and execution notes.

The updater preserves `data/combos-season3-supplemental.json` on every refresh. Those curated references require manual source review if future patches change them. Jack-8's source alias is now correctly mapped, so its four existing v3.02 combos appear in the app.

Damage depends on the listed route, Heat, counter hits, walls, stage conditions, and game version. Source values have not been independently tested in practice mode.

## Validation

Thirteen tests pass, including character alias mapping, no-op detection, preservation/validation of supplemental records, and visual input parsing. The complete 21-page refresh succeeds. JavaScript syntax checks pass. Browser checks confirm damage cards for all eight previously missing characters. The prior theme and search behavior remain intact. The existing PDF export code is retained; PDF output has not been independently revalidated.

## Combo video guides

`data/combo-guides.json` contains checked Season 3 links for 39 characters. RyzingSol links are sourced from the respective Wavu Wiki character combo pages, which label them Season 3 Combo Guide. Selected TheFURY links come from explicitly titled Season 3 videos, including Anna, Armor King, Bryan, Fahkumram, and Feng. Bob and Kunimitsu have no confirmed creator guide in this registry yet; their combo cards still display input diagrams.

The linked guide does not imply that every combo card was created by that creator. The Source link on each card preserves its actual attribution. Guide links are curated separately from the automatic combo data updater.

## Weekly creator reviews

See [CREATOR-REVIEWS.md](CREATOR-REVIEWS.md). The weekly AI review is scheduled in Codex; GitHub performs publication and continues its independent six-hour collection refresh. Keep the local computer and desktop app running for the video review. Existing entries are retained whenever a newer video cannot be fully verified.

## Categorized video routes

The Combos tab groups routes in RyzingSol chapter order and offers an All / RyzingSol / TheFURY filter. Reviewed video cards show a direct start-time link beside visual inputs and damage. Anna currently has one individually checked RyzingSol follow-up (44 damage at 4:25) and two checked TheFURY normal-hit routes. This is not the complete output of either guide. `data/creator-review-progress.json` tracks the existing-guide backlog; the weekly review now backfills it and selects future videos independently for each creator.
