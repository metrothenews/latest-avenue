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
Start ─▶ 1 Footage ─▶ 2 Script ─▶ 3 Build the cut ─▶ 4 Editing script ─▶ 5 Sequencer ─▶ 6 Export
```

A step bar at the top shows where you are. Finished steps can be tapped to go back to them.
The page picks the step from the editor's project state, so a reload lands where you left off.

| Step | What the person sees | Done when |
|---|---|---|
| Start | "Start a new edit" with a name field. If the editor already has a project: "Carry on with *name*" and "Start a new edit". | A project exists in the editor. |
| 1 Footage | "Connect Google Drive" (read-only, the existing `connectDrive`), then the existing Drive folder search; pick the folder with the video, photos and audio. Then a summary from the editor (how many videos, audio files, photos, total length). | The editor has read the folder. |
| 2 Script | Two choices: pick the script PDF from Drive, or upload one from the device. A third, quieter choice: "I don't have a script" (the editor builds a rough one from the footage). A muted "Script supervisor notes: later" line holds that step's place without doing anything. | The editor has read the script, or was told there is none. |
| 3 Build the cut | One button, "Build my assembly cut", then a progress panel: which stage (reading footage, transcribing, recognising shots, matching to the script, putting it in order), a bar if the editor reports a fraction, and "You can leave this page; it keeps going." | The editor says the assembly is done. |
| 4 Editing script | The editing script laid out like a screenplay (scene headings, action, character and dialogue). Under each shot line, its take: "Take 2 of 4 · file · 0:12.4 → 0:18.9". **Change take** opens the alternatives (best match first) and in/out trim. Each line has **Up**, **Down**, **Cut** (struck through, can be restored). Text can be edited in place; the take stays bound to the line. Lines with no footage say so and can be given a clip from **Unused footage** at the end. Saves by itself a moment after each change; **Undo** steps back. | The person presses **Open in the sequencer**. |
| 5 Sequencer | "Laying out your cut…" while the editor builds the timeline, then it goes to `/edit/sequencer`, the existing live view, with quick crop / colour in the game view as now. | The cut is on the timeline. |
| 6 Export | Two choices: **Video file** (rendered MP4) or **Sequence for another editor** (OpenTimelineIO). Needs one more Google permission, "Save to Drive" (`drive.file`: only files this site creates), asked only here. Progress, then a link to the file in Drive. | The file is in Drive. |

## States (every step)

- **Editor starting** (it's switched off when unused): a slim bar, "Starting the editor… up to a minute". Buttons that need the editor wait; reading and Drive browsing still work.
- **Editor unreachable / denied**: the same bar with the honest reason and **Try again**. No fake data anywhere.
- **Tool not built yet** (the editor answers "Unknown tool"): "This part of the editor isn't ready yet" in the step, and the sequencer stays one tap away. This is what Sam sees today, until the builder session ships the tools below.
- **Empty**: no project → Start; Drive not connected → Connect; no folders found → the picker says so; editing script with no lines → "The editor didn't find any lines" with a link back to step 2.
- **Loading**: plain text ("Reading your footage…"), no spinners or animation.
- **Error from a step** (e.g. the PDF couldn't be read): the editor's message in the step, plus the action to retry or pick another file.
- **Drive token expired** (an hour): "Your Drive connection ran out" with **Reconnect**.

## Phone layout (about 390px)

- One column, 16px side padding, nothing wider than the screen.
- The step bar becomes six tappable segments with "Step 3 of 6 · Build the cut" above them; labels show only on wider screens.
- The editing script is full width: character names centred, dialogue indented a little (not the 2.5-inch screenplay indent, which would leave no room). Each line's controls are always visible buttons in a row under it, at least 44px tall: no hover, drag, double-click or long-press needed. Reordering is Up/Down, not drag.
- **Change take** opens a sheet (the existing `Modal`) that fills the width; the takes are a list of large buttons; trim is two number fields with −/+ buttons.
- The header keeps: logo, "edit" tag, editor status dot, **Sequencer**, **Admin**.

## Editor tool contract (to align with the builder session)

All calls go through `callEditTool(token, name, params)` (`src/lib/editStream.js`, the
gateway's `POST /api/rpc`). The site's side is `src/lib/editProject.js`; every function there
has a `TODO(tool name)` until the editor's names are confirmed. **Names and shapes below are
proposals by this session** (guesses, not yet agreed). Times are seconds (floats); IDs are strings.

| Site function | Tool (proposed) | Params | Returns |
|---|---|---|---|
| `getProject` | `project_status` | `{}` | `Project` or `null` when none |
| `startProject` | `project_new` | `{ name }` | `Project`. The editor keeps (saves) the previous project. |
| `setFootageFolder` | `footage_set_folder` | `{ drive_folder_id, drive_folder_name, drive_token }` | `Project` (footage `state: 'reading'`) |
| `setScriptFromDrive` | `script_set` | `{ source: 'drive', drive_file_id, name, drive_token }` | `Project` |
| `uploadScript` | `script_set` | `{ source: 'upload', name, pdf_base64 }` | `Project` |
| `skipScript` | `script_set` | `{ source: 'none' }` | `Project` |
| `startAssembly` | `assembly_start` | `{}` | `Project` (assembly `state: 'running'`); returns at once, work continues |
| `getEditingScript` | `editing_script_get` | `{}` | `EditingScript` |
| `saveEditingScript` | `editing_script_save` | `{ editing_script }` | `{ saved_at }` |
| `submitEditingScript` | `editing_script_submit` | `{}` | `{ ok: true, strips }` once the sequencer has the cut |
| `startExport` | `export_start` | `{ kind: 'video' \| 'sequence', drive_token, drive_folder_name }` | `Project` (export `state: 'running'`) |

`drive_token` is the user's Google access token (read-only for footage and script,
`drive.file` for export). It lasts an hour; the editor should copy what it needs straight
away rather than keep the token. Open question for the builder: if copying a large folder
takes longer, the editor needs its own Drive access or a refresh path.

Uploads go inside the JSON-RPC body, so a PDF must be under about 700 KB (the gateway caps a
request at 1 MB). The page says so and points to the Drive choice for larger files. A
`POST /api/upload` on the gateway would lift that.

```js
Project = {
  id, name, updated_at,                       // ISO time
  footage: null | {
    folder_id, folder_name,
    state: 'reading' | 'ready' | 'failed', message,
    counts: { video, audio, photo }, total_s,
  },
  script: null | {
    source: 'drive' | 'upload' | 'none', name,
    state: 'reading' | 'ready' | 'failed', message,
    scenes, lines,                            // counts, when read
  },
  assembly: {
    state: 'idle' | 'running' | 'done' | 'failed', message,
    stage: 'inventory' | 'transcribe' | 'recognise' | 'match' | 'order' | null,
    progress: null | 0..1,
  },
  editing_script: null | { saved_at },
  export: {
    state: 'idle' | 'running' | 'done' | 'failed', message,
    kind, progress: null | 0..1, drive_link,   // drive_link when done
  },
}

EditingScript = {
  version: 1, title, fps,
  lines: [{                                   // flat list, in cut order
    id,                                       // stable, from the script parser
    type: 'heading' | 'action' | 'dialogue' | 'transition',
    text,                                     // the screenplay text (dialogue: the spoken words)
    character, parenthetical,                 // dialogue only
    omitted: false,                           // "Cut" in the page; kept so it can be restored
    takes: [{                                 // ranked, best first; [] when not shot / headings
      id, clip_id, name,                      // name = file name shown to the person
      in_s, out_s,                            // chosen in/out inside the clip
      clip_s,                                 // clip length, for trim limits
      score,                                  // 0..1 match confidence, optional
      thumb,                                  // optional small JPEG data: URI (no auth needed)
      transcript,                             // optional, what was heard
      slate: null, circled: null, notes: null // reserved for script supervisor notes (later)
    }],
    chosen,                                   // id of the take in use, or null
  }],
  unmatched: [{ clip_id, name, clip_s, thumb }], // footage no line uses
}
```

Rules the page follows: a line's `takes` and `chosen` travel with it when it moves; editing
`text` never changes footage; trimming changes `in_s`/`out_s` of that take only (clamped to
`0..clip_s`, at least 0.1 s long); giving an unused clip to a line adds it as a take (in 0,
out `clip_s`) and removes it from `unmatched`. Lines the page creates get IDs starting `web-`.
