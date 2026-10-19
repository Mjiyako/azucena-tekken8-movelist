# Mji's Tek Info

Live app: https://mjiyako.github.io/azucena-tekken8-movelist/

The app has remembered light/dark mode, character moves, frame data, PDF export, and categorized Season 3 combos with visual button inputs, damage and source timestamps.

## Creator-only combo policy

Only **RyzingSol** and **TheFURY** video routes with recorded timestamps are published. Other community sources are excluded. Historical reference files remain in the repository but are not imported. Currently only three individually reviewed Anna routes are imported. Other characters show an empty state and any known guide links. Full creator-guide coverage is not yet complete.

The old six-hour community scraper schedule is disabled. `node tools/update-combos.mjs` now merges approved creator data under `data/combo-source-policy.json`. `data/local-video-combos.json` stores routes approved through the local AI tool; complete manually reviewed overrides are supported separately.

## Local video AI

See [LOCAL-COMBO-AI.md](LOCAL-COMBO-AI.md) for setup, recording, extraction, review and publishing.

1. Double-click **Start Local Combo AI.cmd** in this folder.
2. Open http://127.0.0.1:18765/ if necessary.
3. Choose the creator/character and exact video URL. Download directly, import a local file, or record the browser tab/window.
4. Your local Ollama model saves candidates and frame evidence. No Codex/OpenAI API is used for analysis.
5. Correct and approve each route, then publish approved routes to GitHub Pages.

The Windows task **Mji Local Combo AI - Weekly** runs Mondays at 09:00 local time, checking official uploads and the checked-guide backlog. It saves candidates for human review. Keep Windows signed in and the computer on and plugged in. Codex does not need to run; its prior weekly heartbeat is paused. Review-first means scans do not automatically publish.

## Run the website locally

Double-click **Start Tekken Book.cmd**, or run `node tools/serve.mjs`. Open http://127.0.0.1:8080/. Do not open index.html directly because it fetches JSON.

## Merge and publish approved data

```powershell
npm ci --prefix tools
node tools/refresh-creator-data.mjs
npm test --prefix tools
```

The local review app can run these checks and push its two data files to main. It refuses unrelated staged files, another branch or a HEAD different from origin/main. It never resets, stashes or force-pushes.

The [Pages workflow](https://github.com/Mjiyako/azucena-tekken8-movelist/actions/workflows/combos-and-pages.yml) deploys code/data pushes and supports manual redeployment. GitHub hosts the site; video AI runs on your PC. Models, recordings, downloaded video, frames and caches are excluded from Git and Pages.

## Validation and limits

Run `npm test --prefix tools` for importer/source-policy/input-diagram checks. Run `.local-combo-ai\venv\Scripts\python.exe -m unittest discover -s local-combo-ai -p "test_*.py"` for local pipeline tests.

Neither sampled nor exhaustive scanning guarantees complete/correct transcription. Check the final current combo counter, exact inputs and timestamps before approving. Unknown patch numbers remain unspecified. A general guide link is separate from an imported individual route.
