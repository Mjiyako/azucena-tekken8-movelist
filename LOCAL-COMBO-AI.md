# Mji's Local Combo AI

The tool uses your own GPU/CPU through Ollama. No Codex, OpenAI, Gemini or paid API analyzes the videos. Internet is used for initial software/models, YouTube discovery/downloads and GitHub publication. Frame images go only to Ollama at the fixed loopback address `127.0.0.1:11434`.

## Start

Folder: `C:\Users\mjiya\Desktop\Tekken Book\azucena-tekken8-movelist`.

Double-click **Start Local Combo AI.cmd**, then use http://127.0.0.1:18765/. For recording, open the local UI in Brave, Chrome or Edge if the in-app browser lacks screen-sharing support.

Ollama, Tesseract, OpenCV, Python dependencies and local vision models are installed on this computer. For a fresh installation, run these from the repository in PowerShell:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File local-combo-ai/Setup.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File local-combo-ai/Install-Weekly-Task.ps1
```

Model downloads take several GB. The RTX 3050 Laptop GPU has 4 GB VRAM and the computer has about 16 GB RAM. Ollama uses GPU acceleration where possible and may offload layers to CPU/RAM. Decoding can be quick; visual inference can take longer than playback, especially in exhaustive mode. No real-time guarantee is made.

## Download or import

1. Choose RyzingSol/TheFURY and the correct character.
2. Enter the exact YouTube guide URL. Checked sources are in `data/combo-guides.json`. New sources must identify Season 3 combos and pass official-handle/channel verification.
3. Leave **Local copy** blank to try downloading, or enter a full path to a copy of that exact guide.
4. Click **Start / resume extraction**. Frames, observations and candidates save incrementally.
5. **Pause** stops after the current model request/extraction phase. Re-enter the same source/character to resume cached work.

YouTube blocked our download test with a sign-in/bot-check response. The tool does not bypass it or read browser cookies. Use a local file or browser recording when downloads fail. Local copies must match their stated source.

## Record the whole video

1. Open a checked guide in a separate browser tab/window. Finish ads; select normal 1× playback speed and pause at 0:00.
2. In the local tool, select its creator/character and enter that guide URL.
3. Click **Record a browser tab / window**, then select only the video tab/window in your browser's sharing picker.
4. Play the whole guide. Prefer full-screen video for readable inputs/counters. No audio is needed.
5. Click **Stop recording & analyze** at the end. Five-second chunks save locally; the tool converts the recording and starts analysis.

The sharing picker requires your interaction. If unavailable, use another supported browser or a local file. Recording lead-in, buffering, pauses and ads can shift timestamps: **check/correct every YouTube start time before approval**. Reaching a recording's end does not prove the whole original guide was captured.

## Sampled and frame-by-frame modes

Default: decode at 2 fps and run local OCR over current combo counters. Counter appearance/reset and the highest observed total select completed-route frames for vision analysis. Chapter starts and overlay snapshots fill gaps. This avoids repeatedly running the vision model on identical notation. If OCR cannot recognize counters, overlay snapshots are used instead. Brief routes/titles can still be missed.

- **Extract every video frame** saves the full sequence and can use several GB per guide. Full-frame timestamp mapping requires constant-frame-rate input; use sampled mode for variable-frame-rate files.
- **Analyze every extracted frame** sends every saved frame to the model. Both boxes together inspect the video frame by frame. This can take many hours and still does not guarantee correct recognition.
- The model receives the full frame plus source-specific notation/counter crops. RyzingSol's inputs are at the bottom; TheFURY's are at the top. A calibrated image reader also recognizes button colors/positions, direction glyphs and selected stance labels. Its draft remains unverified: held directions, timing, whiffs, new labels and changed layouts can require correction.
- Independent Tesseract OCR cross-checks the current damage/hit counters. If the number is missing, unreadable or contradictory, damage stays blank. An unverified language-model reading is shown separately; it cannot bypass your approval.
- Raw observations retain title/section reads. Candidates retain notation, counters, setup, sampled timestamps and supporting frames. Counter resets separate repeated demonstrations.
- A repeated reading is evidence, not approval or a calibrated confidence score. See all saved readings/title observations in each job. **Add a missed route at current video time** lets you record a route the automatic pass missed.

Settings: `local-combo-ai/config.json`. Supported local models: `qwen3-vl:2b-instruct` (lighter), `qwen3-vl:4b-instruct` (larger), `qwen3-vl:8b-instruct` (very demanding here). Edit `model` and rerun setup to download the chosen model. Cloud tags are rejected. The default is 2B Instruct. Explicit -instruct tags avoid the thinking-parser issue encountered in the initial tests. Larger Instruct models are optional downloads.

CLI examples from the repository:

```powershell
.\.local-combo-ai\venv\Scripts\python.exe local-combo-ai/engine.py doctor
.\.local-combo-ai\venv\Scripts\python.exe local-combo-ai/engine.py scan --url 'https://www.youtube.com/watch?v=IKaAPbrhZxo' --character anna --author RyzingSol --file 'C:\Videos\Anna.mp4'
.\.local-combo-ai\venv\Scripts\python.exe local-combo-ai/engine.py scan --url 'https://www.youtube.com/watch?v=IKaAPbrhZxo' --character anna --author RyzingSol --file 'C:\Videos\Anna.mp4' --every-frame --dense
```

`--max-frames N` is a partial smoke test, never a completed scan. Cache keys include image, model, prompt, chapter and character.

## Review and publish

Open a saved job. Compare each candidate with its video and frame evidence. Correct notation, total damage, hit count, category, conditions and exact YouTube start time. Click thumbnails to seek the local video; use frame stepping to inspect counters/inputs. Shared Kuma/Panda guides have separate character jobs; check which routes apply to each.

Check **Start time checked** and **Inputs and final damage checked / approve** only after verification. Missing damage cannot be approved. Unapproved candidates remain local.

- **Save review** keeps corrections locally.
- **Update app locally** writes approved records to `data/local-video-combos.json`, regenerates creator-only app data and runs tests.
- **Publish approved routes to GitHub Pages** also commits those two JSON files and pushes main. The button reports the push; check GitHub Actions and the live site for deployment completion.

Publishing refuses unrelated staged files, a non-main branch, or a HEAD different from origin/main. It never resets/stashes/force-pushes. Synchronize your checkout if needed. Approved routes are added without erasing the other creator. Fully reviewed newer-guide replacements use the contract in `CREATOR-REVIEWS.md`.

GitHub publication requires a Git checkout with the repository remote and your GitHub credentials. The installed Desktop checkout is already configured. A ZIP copy can analyze/review/export locally; use a clone of the repository for the push button.

Only RyzingSol/TheFURY routes appear publicly. Many characters will remain empty until their guides are extracted and reviewed. Former community routes are excluded and their GitHub scraper schedule is disabled.

## Weekly Windows task

Task: **Mji Local Combo AI - Weekly**, Mondays at 09:00 local time. It discovers official uploads, backfills checked guides, resumes incomplete scans and skips completed scans. `weeklyVideoLimit` limits attempts per run (default 100). Ambiguous character titles need manual source selection.

For offline backlog processing, put a guide's MP4 in `.local-combo-ai/inbox/<YouTube-video-ID>.mp4`; the weekly runner will use it. For example, `IKaAPbrhZxo.mp4` is the registered RyzingSol Anna guide. The copy must match the stated source.

Review-first means the task saves candidates and cannot approve/publish them for you. Keep Windows signed in and the computer on and plugged in. Missed tasks can run later. There is a two-day run limit and only one local extraction runs at a time. Codex and the review browser tab need not be open. The old Codex heartbeat is paused.

Logs and saved files: `.local-combo-ai/weekly.log`, `server.log`, `server-error.log`, and `jobs/`. Failures appear in the dashboard/log; no Codex wakeups are generated.

```powershell
Disable-ScheduledTask -TaskName 'Mji Local Combo AI - Weekly'
Enable-ScheduledTask -TaskName 'Mji Local Combo AI - Weekly'
Start-ScheduledTask -TaskName 'Mji Local Combo AI - Weekly'
```

## Storage and troubleshooting

`.local-combo-ai/` is ignored by Git and excluded from Pages. Only approved factual combo records/source links are published. The review server binds to loopback and requires a local token for changes. Close its process to stop it; the launcher starts it when needed. Ollama may hold the model in memory for 15 minutes after use.

If Ollama is missing, rerun setup. If memory is exhausted, use 2B, close other GPU-heavy apps and resume. If storage is low, use sampled mode or archive completed job folders outside this repository. Frame extraction estimates disk use and reserves 2 GB; recording also stops accepting chunks below that reserve.

Browser capture requires your sharing selection, and automated YouTube downloads may remain blocked. Installing this tool does not complete all-guide transcription. Check every route before publication as requested.

References: [Ollama vision](https://docs.ollama.com/capabilities/vision), [structured generation API](https://docs.ollama.com/api/generate), [local Qwen3-VL models](https://ollama.com/library/qwen3-vl), [yt-dlp](https://github.com/yt-dlp/yt-dlp).
