# Weekly creator video reviews

Live app: https://mjiyako.github.io/azucena-tekken8-movelist/

Channels:

- RyzingSol: https://www.youtube.com/@ryzingsol/videos
- TheFURY: https://www.youtube.com/@TK_TheFURY/videos

The weekly AI review runs in this Codex chat on Mondays at 09:00 Africa/Johannesburg, covering existing registered guides as well as later uploads. It inspects both channels, selects the newest relevant Season 3 character combo video independently for each creator, and reviews all of that video's combo routes before replacing that creator's routes for a character. Both creators and community references coexist. Exact publication dates decide which video is newest; relative upload labels alone are insufficient for close comparisons.

This review runs on the local computer, which must be on with the desktop app running. GitHub continues to perform the six-hour collection refresh and website deployments independently. A simple channel feed cannot transcribe visual button overlays or verify combo damage, so the weekly review uses the AI's browser/video inspection capabilities. If a video cannot be fully inspected, existing data is preserved and the limitation is reported rather than claiming an update.

## Data contract

`data/creator-review-policy.json` identifies the channels, Season 3 scope and activation baseline. `data/creator-combo-overrides.json` uses schemaVersion 2 and stores complete reviews in `characters.<roster-id>.creators.<author>`. Both author keys can be present for one character. Each review has:

- `author`: `RyzingSol` or `TheFURY`.
- `videoUrl`: the exact HTTPS YouTube watch URL.
- `publishedAt`: verified ISO publication date/time.
- `verifiedAt`: ISO review date/time.
- `complete`: true only after the full relevant video has been inspected.
- `verificationNotes`: how the Season 3 scope, source identity, route completeness and final damage counters were checked; list the chapters covered.
- `combos`: every combo route from the chosen video, with duplicates consolidated only when both input sequence and conditions are identical.

Each combo needs `category` (`normal`, `counter`, `heat`, `follow-up`, `wall`, `wall-carry`, or `situational`), `id` (`creator-<character-id>-<author>-<stable-route-id>`), `character`, `characterName`, `notation`, positive integer `damage`, integer `hits` or null, `conditions` array, `sourceUrl` for the same video (with timestamp), numeric `videoTimestampSeconds`, and `damageBasis`. Include `patch` only if explicitly verified as v3.x, otherwise null. Add `notes` for execution, hold, whiff, spacing, opponent/body-size restrictions and abbreviations. Damage must be the completed route's final total, including its stated starter. The training display's historical Max Combo Damage is not a route total. A missing total must not be guessed from other routes.

Preserve older data when the extraction is incomplete. Do not substitute a link-only record, a thumbnail number, a sample of the guide, or a combo from a different video for the complete character replacement. The currently empty overrides document intentionally leaves existing data intact until a guide is fully reviewed. Save incomplete transcription work to `data/creator-review-progress.json`; never treat the guide-link registry as a completed import.

## Apply and publish a completed review

1. Synchronize with `origin/main`, preserving unrelated local edits.
2. Write the complete character entry in `data/creator-combo-overrides.json` and update the matching author link in `data/combo-guides.json`. Do not add an unverified publication time.
3. Run `npm test --prefix tools`.
4. Run `node tools/apply-creator-reviews.mjs` to update the merged app data without requiring another network download.
5. Check that all routes for the reviewed creator come from the selected video, and the other creator, community references and other characters are retained. Inspect the visual inputs in the browser if the notation introduces a new format.
6. Commit the override, guide links, merged data and any required notation support; push to `main`.
7. Wait for the GitHub Pages workflow to succeed and verify the deployed data before reporting completion.

`tools/update-combos.mjs` reapplies these per-creator replacements after its normal source/supplemental merge on every six-hour run. This prevents a subsequent collection refresh from restoring older routes for a creator-reviewed character. `tools/apply-creator-reviews.mjs` validates the replacement before modifying the merged file and preserves a backup.

Do not re-import the same processed video each week. Track the selected video ID and publication time in its character review. No-change reviews need no public data commit or notification. Report meaningful published changes, failures, or required user action in this chat only.

## Presentation and review backlog

Cards are grouped in RyzingSol chapter order: Normal Hit, Counter Hit, Heat, Guaranteed Follow-ups, At the Wall, Wall Carry / Stage Hazards, then Situational. Explicit reviewed categories take precedence over condition-based grouping for community entries. Every reviewed video route must have a numeric start timestamp, final total damage and accurate visual inputs. The app reports actual timestamped route counts per creator. A general guide link is not evidence of an imported route. Full guide coverage is not yet complete.
