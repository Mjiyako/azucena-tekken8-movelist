# Creator video reviews

The Codex heartbeat is paused. Analysis now runs locally through Ollama and Windows Task Scheduler, with human approval before publication. See [LOCAL-COMBO-AI.md](LOCAL-COMBO-AI.md).

Allowed channels: https://www.youtube.com/@ryzingsol/videos and https://www.youtube.com/@TK_TheFURY/videos.

`data/combo-source-policy.json` disables community imports. `tools/refresh-creator-data.mjs` merges timestamped creator routes from checked supplemental references, approved local extractions and complete creator overrides. The old updater delegates to this merger under the current policy.

## Review requirements

Check the full notation, starter, simultaneous buttons, holds, delays, whiffs, stance transitions, exact start time, final current combo damage, hits and setup conditions. Never substitute health, recoverable damage or historical Max Combo Damage. Leave unreadable damage null until checked.

Section IDs: `normal`, `counter`, `heat`, `follow-up`, `wall`, `wall-carry`, `situational`. Both creators coexist. Do not attribute wiki/community routes to a creator merely because their guide is linked.

The local app writes approved individual routes to `data/local-video-combos.json`. A partial guide may contribute approved routes but remains incomplete. Model agreement is not approval. Local `scanComplete` means processing reached the end, not that all routes were correctly recognized or reviewed.

## Complete replacement contract

`data/creator-combo-overrides.json` uses schemaVersion 2: `characters.<roster-id>.creators.<author>`. Each review requires `author`, exact `videoUrl`, verified ISO `publishedAt`/`verifiedAt`, `complete: true`, `verificationNotes` listing all covered chapters, and every route in `combos`.

Each route requires a unique `creator-<character>-<author>-<route>` ID, character, notation, positive integer damage, hits integer or null, conditions array, category, sourceUrl for the same video, numeric videoTimestampSeconds and damageBasis. Include characterName and execution notes. Do not set complete after a sample, partial recording or failed extraction.

Only a complete review replaces that creator's prior routes for the character; the other creator remains intact. Apply with `node tools/apply-creator-reviews.mjs`, test, push main and verify Pages. Individually approved local routes are otherwise added without erasing earlier routes.
