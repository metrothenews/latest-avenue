# /edit: the editing flow (design)

The consumer-facing side of the latest avenue video editor. It turns the editor's steps
(see `docs/plan/PRODUCT.md` in the `latest-avenue-edit` repo) into one guided page for someone
who has never used an editor. Written 2026-11-18.

## Routes

| Route | What it is |
|---|---|
| `/edit` | The guided flow (this document). Owner only, like before. |
| `/edit/sequencer` | The live view of the Blender sequencer, **unchanged** (same connection, keys, full screen). Its header link now says "Project" and goes back to `/edit`. |

Guess: the live view moved from `/edit` to `/edit/sequencer` so the flow can be the front
door. The admin header's "Edit" link still goes to `/edit`. "Open the sequencer" is in the
flow's header on every step, so nobody is forced through the steps to reach it.

## The flow

```
Start (what are you making?) ─▶ 1 Footage ─▶ 2 Script / song ─▶ 3 Build the cut ─▶ 4 Review the cut ─▶ 5 Sequencer ─▶ 6 Export
```

A step bar at the top shows where you are. Finished steps can be tapped to go back to them.
The page lands on the first unfinished step, then stays on the step showing until the person
moves on (so a step's "done" summary isn't skipped when the editor finishes in the background).

| Step | What the person sees | Done when |
|---|---|---|
| Start | **What are you making?**: *From a script* (short film, ad, scripted monologue, social video), *Music video*, or *Interview or documentary*, plus a name. If an edit is in progress: **Carry on** or **Start a new edit**. | A project record exists (this browser). |
| 1 Footage | "Connect Google Drive" (read-only, the existing `connectDrive`), then the existing Drive folder search. The editor copies the folder (a job; its progress lines show), then checks the files: how many videos, sound files, photos, total length, unreadable files. Sound from a separate recorder goes in the same folder. | The editor has the folder and has read it. |
| 2 Script | *From a script*: the script files found in the footage folder (PDF, Fountain, text), **Check the folder again** after adding one in Drive, **Upload a PDF from this device**, or **I don't have a script**. *Interview*: the same, with "no script" first and the title "A script? (optional)". *Music video*: choose the **song** from the sound files and optional **lyrics**. A muted "Script supervisor notes: later" line holds that step's place. | A script was read, or there is none (music: a song is chosen). |
| 3 Build the cut | **Build my assembly cut**, then the editor's own progress lines ("synced A001_C003.mov to ZOOM0001.wav (timecode)", "heard …") and the time so far. "You can leave this page." Then: "2 of 3 lines have footage · 1 clip not used". | The job is done. |
| 4 Review the cut | The editing script laid out like a screenplay. Under each line, its footage: a **confidence label** (*Strong match* / *Likely match* / *Best guess* / *Picked by look* for cover shots), a **sound label** (*Synced by timecode/waveform/clap*, *Camera sound only*, *Couldn't sync*, *No sound*), the take ("Take 2 of 3 · file"), in → out. Tapping it (**Swap or trim**) lists every ranked take with its match % and what was heard, and trims in/out. Each line has **Up**, **Down**, **Remove**; its words can be edited in place. A **Sound** panel lists clips that aren't synced; **Unused footage** lists clips the editor couldn't place. **Undo** steps back through moves, removals and rewording. | **Open in the sequencer**. |
| 5 Sequencer | The cut is laid out on the timeline, then `/edit/sequencer`, the existing live view, with quick crop / colour in the game view as now. | The cut is on the timeline. |
| 6 Export | **Video file**, **DaVinci Resolve**, **Premiere Pro** or **Final Cut Pro**. One more Google permission, "Save to Drive" (`drive.file`: only files this site creates), asked only here. Making the file, then saving to Drive (a job), then **Open in Drive**. | The file is in Drive. |

Guesses made here (flag any that are wrong):
- The confidence thresholds: *Strong* when the matcher's score is ≥ 0.8, *Likely* ≥ 0.5, *Best guess* below that or with no score.
- Music videos: the editor has no song or lyrics input yet, so a music video is built like unscripted footage; the song and lyrics choices are kept for when it does. The page says so.
- Export formats: Resolve gets OpenTimelineIO (`.otio`), Premiere gets FCP7 XML (`.xml`), Final Cut gets `.fcpxml`. The video is `render_video` of the timeline, so it includes the fine-tuning done in the sequencer.
- Exports go to a Drive folder called "latest avenue exports" that the site creates.
- Where the flow got to is remembered in this browser (localStorage), not on the editor, which has no project record. Starting on the desktop and carrying on from the phone means starting the steps again (the editor skips files already copied, so footage is quick the second time).

## States (every step)

- **Editor starting** (it's switched off when unused): a slim bar, "Starting the editor… up to a minute". Buttons that need the editor wait; Drive browsing still works.
- **Editor unreachable / denied**: the same bar with the honest reason and **Try again**. No fake data anywhere.
- **Tool not built yet** (the editor answers "Unknown tool"): "This part of the editor isn't ready yet" in the step, with the sequencer one tap away. Today that is only the PDF upload (`save_upload`, below).
- **Job forgotten** (the editor restarted mid-job): "The editor restarted and lost track of this step. Start it again."
- **Empty**: no project → Start; Drive not connected → Connect; no folders / no script files found → says so, with **Check the folder again**; editing script with no lines → "The editor didn't find any lines" and a way back to the script.
- **Loading / working**: plain text and the editor's own progress lines; no spinners or animation.
- **Error from a step**: the editor's message (it is written for the person) and the action to retry.
- **Drive token expired** (an hour): "Your Drive connection ran out" with **Connect** again.

## Phone layout (about 390px)

- One column, 16px side padding, nothing wider than the screen.
- The step bar becomes six tappable segments with "Step 3 of 6 · Build the cut" above them; labels show only on wider screens.
- The editing script is full width: character names centred, dialogue indented a little (not the 2.5-inch screenplay indent, which would leave no room). Each line's controls are always visible buttons in a row under it, at least 44px tall: no hover, drag, double-click or long-press needed. Reordering is Up/Down, not drag.
- **Change take** opens a sheet (the existing `Modal`) that fills the width; the takes are a list of large buttons; trim is two number fields with −/+ buttons.
- The header keeps: logo, "edit" tag, editor status dot, **Sequencer**, **Admin**.

## Editor tool contract

The builder's contract is `cloud/TOOLS.md` in `latest-avenue-edit` (branch
`claude/assembly-pipeline`, 2026-11-18). The site calls it through `callEditTool`
(`src/lib/editStream.js`); one named function per tool in `src/lib/editProject.js`:

| Step | Site function | Editor tool |
|---|---|---|
| 1 | `fetchDriveFolder`, `jobStatus`, `probeMedia` | `fetch_drive_folder` (job), `job_status`, `probe_media` |
| 2 | `readScreenplay` | `read_screenplay` |
| 2 | `uploadFile` | `save_upload` (in 700 KB parts with `append`; scripts, songs, lyric sheets) |
| 3 | `startAssembly`, `jobStatus` | `start_assembly` (job; `song` and `lyrics` for a music video) |
| 4 | `getEditingScript` | `get_editing_script` (`format: 'json'`) |
| 4 | `editEditingScript` | `edit_editing_script`: moves, removals and rewording, sent as screenplay text |
| 4 | `chooseTake`, `setLineCut` | `choose_take`, `set_line_cut` |
| 4 | `takeThumbnails` | `take_thumbnails` (one `data:` JPEG per take, fetched when a line's takes are opened) |
| 4 | `setClipSync` | `set_clip_sync` (sound file + offset, or `clear` for the camera's own sound) |
| 5 | `layOutEditingScript` | `lay_out_editing_script` |
| 6 | `renderVideo`, `exportSequence`, `uploadToDrive` | `render_video`, `export_sequence`, `upload_to_drive` (job) |

How the page uses them:
- **Files.** The footage is copied to `drive/<folder id>` in the editor's media folder (the `folder` in the fetch job's result). The project's own files live in a hidden `.latest-avenue/` folder inside it, which the editor's footage scan skips: the editing script is `<that>/<project id>.edit.json`, exports are `<that>/<name>-<format>.<ext>`.
- **Text round trip.** `toText` in `src/lib/editingScript.js` mirrors the editor's `editing_script.to_text` exactly (checked on 2026-11-18: identical output on a sample with action, dialogue, extensions, parentheticals, a transition and a forced heading). A move, removal or rewording changes the document in the page, sends the whole text, then reloads the document from the editor, so the page always shows the editor's result (re-trims, new line IDs).
- **Sound status** comes from `media[clip].sound` (synced to a recorder file, with `method`) and `audio_tracks`; "Couldn't sync" means there are recorder files but this clip matched none and has no sound of its own.
- **Drive hand-off (Google sign-in → editor).** Footage: the existing read-only Drive connection
  (`connectDrive` in `src/lib/driveAuth.js`, unchanged) gives an access token; the page checks it is
  still good at the moment of each request and sends it as `access_token` with that one
  `fetch_drive_folder` call (the editor uses it once and doesn't keep it). Export: a separate
  `drive.file` token from `src/lib/driveExport.js`, asked for only at the export step, held in the
  page's memory only (never stored), checked before each export and sent with that one
  `upload_to_drive` call. If Drive refuses a token (it ran out, or was revoked), the step says "Your
  Drive connection ran out" with a **Connect Google Drive** button that reconnects and retries.
  When the builder settles the exact token shape in `cloud/TOOLS.md`, only `src/lib/editProject.js`
  needs to follow it.
- **Drive.** `fetch_drive_folder` gets the read-only token from `src/lib/driveAuth.js`. `upload_to_drive` gets a `drive.file` token from `src/lib/driveExport.js` and a folder ID the site creates with that token (`ensureExportFolder`), because `drive.file` can only write into folders the app made.

Music videos: the editor's document has `"mode": "music"`. Every line is a stretch of the
song (`cut`) with a picture over it (`cover`), and its `takes` are other pictures. The page shows
the lines read-only (the song sets the timing), labels them "Cut to the beat", offers only
**Swap picture**, and hides the Sound panel.

The four asks from the first pass (`save_upload`, song and lyrics on `start_assembly`,
`set_clip_sync`, `take_thumbnails`) were shipped by the builder at 19627901 and are wired in.

## Testing

- **Against the builder's real editor** (2026-11-18): the Linux build from `linux-build` with the
  `claude/assembly-pipeline` Python over it, run headless (`blender -b`, the control server's
  `serve_forever`) with the assembly environment from `tools/vse_assembly/requirements.txt`, on
  the generated test shoot (`tests/vse/assembly/make_samples.py --tiny`). The page's gateway calls
  were passed straight to the editor's `/rpc`. Short film on a phone-sized screen: footage → script
  uploaded from the device → assembly (real transcription and matching) → review with real
  thumbnails → swap take → trim → move and undo → fix sync → lay out → Premiere export. Music
  video, phone and desktop: song from the folder, lyrics uploaded → assembly cut to the beat →
  swap picture → lay out → rendered MP4. 14 tools ran for real: probe_media, save_upload, read_screenplay, start_assembly, job_status, get_editing_script, take_thumbnails, choose_take, set_line_cut, edit_editing_script, set_clip_sync, lay_out_editing_script, export_sequence, render_video.
- **Phone check, 390px touch (iPhone 13), builder @ff12b07c, 124x70 shoot:** every screen of
  both paths (start, folder picker, footage, script choices, script read, building, built, review,
  swap sheet, sync sheet, export choices, export done; music: song, built, review, swap picture,
  export) has no sideways scroll and no visible control under 44x44 px. To get there: the logo
  link, one-line text boxes in the review, and the shared pop-up's ✕ (its tap area only; it looks
  the same) were made 44px tall.
- **Re-run 2026-11-18 13:20 UTC, builder @7772e174:** short film and music video, each at 390px
  touch and 1280px desktop: all four pass end to end, 36 screens, no sideways scroll, nothing
  under 44px. Error states (stand-in editor, 390px): Drive refusing the token → "Your Drive
  connection ran out" → Connect → the same folder copies; a technical editor error → "Something
  went wrong in the editor." with the editor's words folded under "What the editor said" → Try
  again → the cut builds.
- **Not real in that run:** Google Drive in and out (`fetch_drive_folder` returned a folder
  already on the editor; `upload_to_drive` was stubbed), the gateway's sign-in check, and the
  live view's stream. The Docker image itself (`cloud/Dockerfile`) wasn't built here: this
  sandbox's network needs its own certificate inside the image, which I wasn't allowed to add.
- **Stand-in editor** (fast checks): the same flow against a fake that runs the builder's
  `editing_script` Python for text edits, take swaps and trims.

## The assistant chat

The chat panel from `claude/edit-chat` (`src/components/edit/ChatPanel.jsx`) is merged and kept,
but hidden: `editSettings.assistantChat` in `src/data/edit.js` is `false`, because Sam's plan has
no chat. Set it to `true` to bring back the Chat button in the sequencer's header.
