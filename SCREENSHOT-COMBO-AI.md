# Screenshot Combo AI — run it yourself

Double-click **Start Screenshot Combo AI.cmd** in your Tekken Book folder. The new tool opens at **http://127.0.0.1:18766/**. This is a different page from the older video tool on port 18765.

The launcher starts local Ollama if needed and opens a console for the screenshot tool. **It does not start inference.** Keep that console open while capturing or reading; Codex does not need to be open. Your installed default is **qwen3-vl:4b-instruct**. All transcription runs locally without an OpenAI/Codex API or API key.

## 1. Capture screenshots

### Record a YouTube tab and process it automatically

This is the easiest path when YouTube blocks downloads. Open the tool at http://127.0.0.1:18766/ in **Brave, Chrome or Edge**. Recording may be unavailable inside Codex's in-app browser.

1. Open the source YouTube guide in a separate browser tab. Skip ads and pause at the beginning. Use the full-screen video player so the input strip and damage text are large.
2. In the tool, select the correct creator and character, paste that guide URL, and set the screenshot interval (1 second for denser coverage).
3. Leave **YouTube start time** at 0 if recording from the beginning. For another starting point, enter its source time in seconds.
4. Optionally set **Auto-stop after minutes**. Otherwise you will stop the recording once when the guide ends.
5. Click **Record YouTube tab → screenshots + Ollama** and choose **only the YouTube tab** in the browser's sharing picker.
6. Play the guide at normal 1× speed. Do not pause, seek or change speed while recording.
7. At its end click **Stop recording & automatically read screenshots**, or let your timer stop it.
8. The tool saves the recording, creates screenshots at your chosen interval, and starts local Ollama automatically. No separate Read click is needed. Keep the console open; you do not need to keep Codex open.
9. Return when the job says **needs-review**. Check and approve as described below.

This path records visible playback and makes no YouTube downloader or cookie request. It supports guide URLs already checked in the app's registry, including RyzingSol's Lee guide `https://www.youtube.com/watch?v=1pwoCyuxZRM`. The user must select the correct tab; a browser cannot silently grant screen capture access.

Recording time starts when capture starts, so lead-in, buffering and ads can shift it from the YouTube clock. All recording timestamps are marked unverified. Correct the exact source combo START time before approving. The optional start-time offset does not automatically correct pauses or lead-in.

Recordings are saved locally under `.local-combo-ai/browser-recordings/`. A cancelled/failed capture retains its partial file. Screenshot approval deletes only the selected screenshot copy, not the recording video. Recording chunks stream to disk, with a 2 GB free-space reserve and an 8 GB limit. The browser timer also stops after 90 minutes at most; close the tool console only when you want its work to stop.

### Local video, direct download, or existing screenshots

Choose **RyzingSol** or **TheFURY**, the character, and the exact creator guide URL. Click **Capture screenshots only**.

For Anna you can use:

https://www.youtube.com/watch?v=IKaAPbrhZxo

The already downloaded Anna video is reused. Other videos are downloaded when possible. If YouTube refuses the download, supply a local complete MP4 in the local-file field. The local copy must match the source URL and begin at the original video's start.

The default interval is one screenshot every **3 seconds**. Use 1 second for denser coverage; this creates more images and takes longer to read. These are sampled screenshots, so neither interval guarantees that every combo or final damage counter is captured. Check the source video for missed routes.

You can instead point the local-file field to a folder of screenshots you made yourself. Name files with their source video time in seconds, such as `12.png`, `74.5.jpg`, or `265.png`. Other filenames are accepted, but their timestamp starts as unknown/0 and must be corrected. The tool copies these images; your originals remain untouched.

Capturing does not call Ollama. A completed capture says **screenshots-ready**.

## 2. Let Ollama read the screenshots

Click **Read / resume with Ollama** beside the saved job. Leave its console open and let your computer work. You may close the browser and reopen the tool's URL later; closing the console stops its worker. The job says **needs-review** when reading finishes.

Ollama reads the full image, a source-specific input-strip crop, and a damage-counter crop. This workflow uses the model's transcription directly rather than replacing it with the old visual button detector. Every output is still a draft. Unknown or malformed readings stay for manual inspection; malformed JSON is retried once.

If the process stops, open the launcher again and click **Read / resume with Ollama**. Completed readings, manual text drafts and approved rows are kept. The current unfinished screenshot is read again. Failed captures can be retried; images from an interrupted capture are preserved in an `interrupted-capture-*` folder.

## 3. Review and approve

Click **Review screenshots**. Use Previous/Next or the screenshot menu.

For each actual combo:

1. Compare the screenshot with the text and generated input-button preview.
2. Correct every direction, button, stance, hold, delay and whiff. Tekken positions are 1 top-left, 2 top-right, 3 bottom-left and 4 bottom-right. Notation examples: `df+2`, `1+2`, `HAM.2,1`, `CH db+2 ► TOM.2`.
3. Enter the **final total damage** and optional hits. A screenshot may show an intermediate counter. Check the video; do not approve a partial total.
4. Choose Normal Hit, Counter Hit, Heat, Follow-up, Wall, Wall Carry or Situational as appropriate.
5. Correct the **combo START timestamp**, which may be earlier than the screenshot time. The source link opens the sampled time; inspect the video to find the start.
6. Tick both review checkboxes.
7. Click **Approve text & delete this screenshot**.

Approval saves the corrected text to disk first, saves a text-only correction example, and then permanently deletes **only the tool's selected screenshot copy**. It does not delete your imported originals, videos, other screenshots, or older-tool frame folders. If saving fails, the screenshot is kept. If image removal fails, the approved text is already saved and you can retry approval after resolving the file lock.

**Save text draft — keep image** saves changes without approval, image deletion, learning or publication. Navigation saves unapproved text edits as drafts. Leave title cards, duplicates, intermediate totals and uncertain readings unapproved; only approve one complete record for each route you want in the app. Unapproved images remain available for review.

## 4. Publish approved text

Use **Update app locally** to import approved text into the website data and run its data tests. Use **Publish approved text to GitHub Pages** when you want those changes committed and pushed. These actions are separate from screenshot approval/deletion.

The existing publisher permits only the two creators and timestamped approved records. It refuses unrelated staged changes, a non-main branch or unsynchronized main. It never stashes, resets or force-pushes. Git credentials are already configured on this installed checkout.

Check [GitHub Actions](https://github.com/Mjiyako/azucena-tekken8-movelist/actions) for the deployment, then refresh [Mji's Tek Info](https://mjiyako.github.io/azucena-tekken8-movelist/). Public combos keep text inputs, generated button graphics, damage, category and timestamp links; screenshot images are not exported.

## How correction memory works

Only your **approved** corrections enter a local text example library. The next unread screenshots receive up to four relevant approved examples to teach notation conventions. Damage and moves must still be read from the current screenshot, rather than copied from examples. Previously completed drafts are not silently rewritten.

This is **correction memory / few-shot guidance**, not autonomous model weight training. The script does not claim to fine-tune Qwen or improve accuracy automatically. Real visual fine-tuning would need a curated labelled image dataset and an additional training setup; deleting images on approval means this tool deliberately keeps text examples instead. Incorrect approvals can teach incorrect conventions.

Local records are under:

```text
.local-combo-ai/screenshot-jobs/<creator-video-character>/images/
.local-combo-ai/screenshot-jobs/<creator-video-character>/rows.json
.local-combo-ai/screenshot-jobs/<creator-video-character>/approved.json
.local-combo-ai/approved-text-examples.json
```

`approved.json` contains the corrected text and factual source metadata. The examples file contains only approved notation, category and notes, with no images. Deleting the examples file resets correction memory; it does not erase approved combos.

The previous **Mji Local Combo AI - Weekly** Windows task is separate and remains scheduled. This new launcher is manual. If you want to suspend that older automatic video pipeline while using this workflow, run:

```powershell
Disable-ScheduledTask -TaskName 'Mji Local Combo AI - Weekly'
```

Re-enable it with `Enable-ScheduledTask -TaskName 'Mji Local Combo AI - Weekly'`.

## Optional terminal commands

Open PowerShell in the installed repository:

```powershell
Set-Location 'C:\Users\mjiya\Desktop\Tekken Book\azucena-tekken8-movelist'
```

Capture only (no model call):

```powershell
.\.local-combo-ai\venv\Scripts\python.exe local-combo-ai/screenshot_workflow.py capture --url 'https://www.youtube.com/watch?v=IKaAPbrhZxo' --character anna --author RyzingSol --interval 3
```

Read/resume screenshots using the configured local model (Ollama must be running):

```powershell
.\.local-combo-ai\venv\Scripts\python.exe local-combo-ai/screenshot_workflow.py read --job 'ryzingsol-IKaAPbrhZxo-anna'
```

Review and approve through the launcher. After approval, terminal publication is also available:

```powershell
.\.local-combo-ai\venv\Scripts\python.exe local-combo-ai/screenshot_workflow.py publish --job 'ryzingsol-IKaAPbrhZxo-anna' --push
```

No Ollama scan was started as part of installing this workflow. Tests use temporary synthetic images/video and mocked model responses; they do not claim accurate full-guide transcription. The recording test covers WebM chunk saving, FFmpeg conversion, timestamped screenshot extraction and automatic handoff to mocked inference. The actual browser sharing picker still requires your selection.
