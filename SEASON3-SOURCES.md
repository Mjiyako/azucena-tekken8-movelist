# Remaining eight characters — combo update

Updated locally on 19 October 2026. All 41 characters in the app now have combo entries.

14 supplemental records were added for seven characters. Four existing Jack-8 records were corrected from source ID `jack8` to app ID `jack-8`; this was an importer error in the first release. The full merged dataset has 220 records, of which 215 belong to the app's 41-character roster. Five additional Miary Zo source records are retained in the dataset but are outside the app roster.

## Entries now visible

| Character | Damage totals | Entries |
| --- | --- | ---: |
| Anna Williams | 75, 63 | 2 |
| Armor King | 81, 74 | 2 |
| Jack-8 | 108, 93, 92, 67 | 4 |
| Lars Alexandersson | 67, 58 | 2 |
| Leo | 70, 69 | 2 |
| Leroy Smith | 71, 70 | 2 |
| Nina Williams | 77, 75 | 2 |
| Shaheen | 70, 68 | 2 |

## Source precision

Anna's video explicitly identifies Season 3. Its input overlay and completed damage counters were read directly: 63 damage / 9 hits at about 0:19 and 75 damage / 11 hits at about 0:27. These are totals including the df+2 starter, not the training display's historical Max Combo Damage value.

The other six characters use Wavu Wiki's Tekken 8 combo pages. Each cited revision was maintained during Season 3 and links a Season 3 Combo Guide by RyzingSol. **Their Season 3 association is inferred from that page context; individual routes do not specify an exact patch.** The app labels them “Season 3 wiki reference · patch unspecified” and exposes the source evidence, fixed wiki revision, and video guide under Execution & source notes. They have not been independently tested in the game.

Wavu lists some route damage as `+N`, meaning damage added after the launcher. Where that notation appears, the app adds the explicitly documented launcher damage. A plain `N` is retained as the total. Recoverable damage after a semicolon is not added. Unknown hit counts are omitted and sort after known hit counts.

Jack-8's existing entries explicitly identify v3.02. Their wall/Heat/stage conditions are retained.

## Per-combo source and notation

### Anna Williams — 63 damage

`df+2 ► 4 ► b+4 ► HAM.2,1 ► uf+2 ► HAM.2,2 T! ► TOM.2`

[Source](https://www.youtube.com/watch?v=HKGx3Syazxw&t=12s)

Final on-screen combo counter, including the df+2 launcher.

Beginner route. Final counter: 9 hits, 63 damage at about 0:19. HAM = Hammer Chance; TOM = Pleasure Time. Alternative ender shown in the video is not included in this damage total.

### Anna Williams — 75 damage

`df+2 ► 4 ► uf+2 ► HAM.2,1 ► dash uf+2 ► HAM.2,2 T! ► (TOM.3) ► CJM.uf+3 ► db+2 ► TOM.2`

[Source](https://www.youtube.com/watch?v=HKGx3Syazxw&t=20s)

Final on-screen combo counter, including the df+2 launcher.

Staple route. Final counter: 11 hits, 75 damage at about 0:27. (TOM.3) is a whiffed stance transition; do not count it as a hit. CJM = Chaos Judgment.

### Armor King — 74 damage

`uf+4 ► df+3 ► df+1 ► f+3,2~DF ► CD.1 ► f+3,2,1 T! ► run f+1+2 ► BAD.2+4`

[Source](https://wavu.wiki/t/Armor_King_combos#Staples) · [Fixed wiki revision](https://wavu.wiki/w/index.php?title=Armor_King_combos&oldid=60491) · [Season 3 guide](https://www.youtube.com/watch?v=Oogc_SUmFjo)

Launcher [13] plus the source extension [+61; 39] = 74 total damage. 39 is recoverable damage, not the total.

CD = crouch dash; BAD = Bad Jaguar. The BAD throw ender is part of the route.

### Armor King — 81 damage

`f,n,d,df+2 ► df+3 ► df+1 ► f+3,2~DF ► CD.1 ► f+3,2,1 T! ► run f+1+2 ► BAD.2+4`

[Source](https://wavu.wiki/t/Armor_King_combos#Staples) · [Fixed wiki revision](https://wavu.wiki/w/index.php?title=Armor_King_combos&oldid=60491) · [Season 3 guide](https://www.youtube.com/watch?v=Oogc_SUmFjo)

Launcher [20] plus the source extension [+61; 39] = 81 total damage. 39 is recoverable damage, not the total.

CD = crouch dash; BAD = Bad Jaguar. The BAD throw ender is part of the route.

### Lars Alexandersson — 58 damage

`f+1+2 ► df+3~d ► DEN.2 ► 2 ► f,F+4,2 ► DEN.1 ► b+3~f ► SEN.1+2 T! ► f+2,1 ► SEN.1`

[Source](https://wavu.wiki/t/Lars_combos#Staples) · [Fixed wiki revision](https://wavu.wiki/w/index.php?title=Lars_combos&oldid=59536) · [Season 3 guide](https://www.youtube.com/watch?v=gczHYUpuqCU)

Source lists [58] for this complete route under f+1+2. It has no plus sign, so the launcher is not added again.

DEN = Dynamic Entry; SEN = Silent Entry. Source does not specify hit count.

### Lars Alexandersson — 67 damage

`uf+3 ► FC.df+2 ► db+2~f ► SEN.1+2 T! ► ssl f,F+4,2 ► DEN.1 ► b+3~f ► SEN.1`

[Source](https://wavu.wiki/t/Lars_combos#Staples) · [Fixed wiki revision](https://wavu.wiki/w/index.php?title=Lars_combos&oldid=59536) · [Season 3 guide](https://www.youtube.com/watch?v=gczHYUpuqCU)

Launcher [26] plus source extension [+41] = 67 total damage.

SSL = sidestep left; FC = full crouch.

### Leo — 70 damage

`df+2 ► 4 ► f+2 ► b+1,1+2,d ► BOK.1,2 T! ► b+1+2,1+2,qcf+2`

[Source](https://wavu.wiki/t/Leo_combos#Staples) · [Fixed wiki revision](https://wavu.wiki/w/index.php?title=Leo_combos&oldid=60603) · [Season 3 guide](https://www.youtube.com/watch?v=udvAa3o_MCc)

df+2 launcher [15] plus extension [+55; 34] = 70 total damage.

BOK = Fo Bu. BBP ender expanded in notation. Source warns that this route can whiff off-axis and f+2 can miss at maximum range.

### Leo — 69 damage

`df+2 ► 4 ► b+1,1+2,d ► BOK.1,2 T! ► ssr b+4,1~4~df >CD.2,4`

[Source](https://wavu.wiki/t/Leo_combos#Staples) · [Fixed wiki revision](https://wavu.wiki/w/index.php?title=Leo_combos&oldid=60603) · [Season 3 guide](https://www.youtube.com/watch?v=udvAa3o_MCc)

df+2 launcher [15] plus extension [+54; 32] = 69 total damage.

DLS ender expanded in notation. Source warns it can whiff off-axis right. SSR = sidestep right; > indicates a delay.

### Leroy Smith — 71 damage

`df+2 ► qcf+2 ► 2,2 ► f+3,1+2,4 T! ► dash 3+4 ► HRM.1,2 ► dash uf+3+4,1+2`

[Source](https://wavu.wiki/t/Leroy_combos#Staples) · [Fixed wiki revision](https://wavu.wiki/w/index.php?title=Leroy_combos&oldid=62149) · [Season 3 guide](https://www.youtube.com/watch?v=0eKO_2O-BaQ)

Source bread-and-butter regular-launch entry lists [71] as total damage.

HRM = Hermit. Damage is for the shown df+2 starter; do not substitute another launcher and assume the same total.

### Leroy Smith — 70 damage

`df+2 ► f+4,4 ► f+3,1+2,4 T! ► dash 3+4 ► HRM.1,2 ► f,f+3 ► f,f+4,2`

[Source](https://wavu.wiki/t/Leroy_combos#Staples) · [Fixed wiki revision](https://wavu.wiki/w/index.php?title=Leroy_combos&oldid=62149) · [Season 3 guide](https://www.youtube.com/watch?v=0eKO_2O-BaQ)

Source bread-and-butter regular-launch entry lists [70] as total damage.

Wall-carry option; the listed total does not add a wall combo.

### Nina Williams — 77 damage

`df+2 ► uf+4 ► uf+3 ► df+3,2~db+2 ► df+3,2~b+4 T! ► qcf+4,3,1+2`

[Source](https://wavu.wiki/t/Nina_combos#Staples) · [Fixed wiki revision](https://wavu.wiki/w/index.php?title=Nina_combos&oldid=60807) · [Season 3 guide](https://www.youtube.com/watch?v=dtO5RgN1Y80)

df+2 [12] plus the regular-launch extension [+65] = 77 total damage.

Midscreen route; no wall ender. Source reports extension damage separately from the launcher.

### Nina Williams — 75 damage

`df+2 ► uf+4 ► uf+3 ► df+3,2 ► b+3+4,3 T! ► uf+4 ► qcf+4,3,1+2`

[Source](https://wavu.wiki/t/Nina_combos#Staples) · [Fixed wiki revision](https://wavu.wiki/w/index.php?title=Nina_combos&oldid=60807) · [Season 3 guide](https://www.youtube.com/watch?v=dtO5RgN1Y80)

df+2 [12] plus source staple extension [+63] = 75 total damage.

Source abbreviation LKS is expanded to qcf+4,3,1+2. Midscreen ender carries the opponent too far for a wall follow-up.

### Shaheen — 68 damage

`df+2 ► 3~DF ► SNK.2 ► df+4,1~DF ► SNKc ws3,3 T! ► FC.df+2 ► f,F+3`

[Source](https://wavu.wiki/t/Shaheen_combos#Staples) · [Fixed wiki revision](https://wavu.wiki/w/index.php?title=Shaheen_combos&oldid=61820) · [Season 3 guide](https://www.youtube.com/watch?v=yHeSPqlRRsI)

Source lists [68; 35] as total and recoverable damage. Total is 68; the launcher is not added again.

SNK = Stealth Step; SNKc = cancel Stealth Step; FC = full crouch.

### Shaheen — 70 damage

`df+2 ► 3~DF ► SNKc ws1 ► 4,1 ► f+2,3 T! ► FC.df+2 ► f,F+3`

[Source](https://wavu.wiki/t/Shaheen_combos#Staples) · [Fixed wiki revision](https://wavu.wiki/w/index.php?title=Shaheen_combos&oldid=61820) · [Season 3 guide](https://www.youtube.com/watch?v=yHeSPqlRRsI)

Source lists [70; 37] as total and recoverable damage. Total is 70; the launcher is not added again.

SNKc = cancel Stealth Step. This route is listed on the Season 3-era wiki snapshot; exact patch unspecified.

## Updating later

Run `Update Combos.cmd` as before. The updater now merges the source collection with `data/combos-season3-supplemental.json`, so future downloads preserve these manually researched references. It validates character IDs, positive integer damage, source links, season evidence, optional hit counts, and unique record IDs before replacing the merged dataset. The automatic source parser now handles both `jin` → `jin-kazama` and `jack8` → `jack-8`.

The supplemental references are curated snapshots; the updater preserves them but does not automatically re-verify their routes against future game patches. To revise a reference, review its source, edit the supplemental JSON, and run the updater again.

## Publishing these changes

Repository: https://github.com/Mjiyako/azucena-tekken8-movelist

Live app: https://mjiyako.github.io/azucena-tekken8-movelist/

GitHub Actions checks the primary collection every six hours and explicitly deploys Pages after changed data is committed to `main`. Commit and push application changes to that branch. After a later combo refresh, commit `data/combos-season3.json` and push; when editing curated references, commit the supplemental JSON as well. See README.md for the exact commands. Local dependencies and backups are ignored, and local tool scripts are excluded from the published Pages output. Cache/assets are v19.

Validation: six importer tests pass, the complete 21-page refresh succeeds, all 41 roster coverage counts are nonzero, and browser checks show damage cards for each of the eight characters.
