// The /edit flow's calls to the video editor (latest-avenue-edit repo). One named function per
// editor tool, all through callEditTool (the gateway's POST /api/rpc). The tools and their
// shapes are the builder's contract: cloud/TOOLS.md in latest-avenue-edit (branch
// claude/assembly-pipeline as of 2026-11-18). Our side is summarised in docs/edit-design.md.
//
// The editor has no "project" of its own: it works on files (the downloaded footage folder,
// the screenplay, the *.edit.json editing script) and background jobs. So the page keeps a
// small record of where each step got to (folder, file paths, job ids) in this browser; see
// loadLocalProject below.
import { callEditTool } from './editStream.js'

// Why a call failed. kind: 'notBuilt' (the editor doesn't have this tool yet), 'denied',
// 'unreachable' (the editor is off or starting), 'gone' (a job the editor forgot when it
// restarted) or 'failed' (the tool ran and said no; the message is meant for the person).
export class EditToolError extends Error {
  constructor(message, kind) {
    super(message)
    this.kind = kind
  }
}

async function tool(token, name, params) {
  try {
    return await callEditTool(token, name, params)
  } catch (err) {
    if (err instanceof EditToolError) throw err
    if (err.denied) throw new EditToolError('denied', 'denied')
    const msg = String(err.message ?? '')
    if (/unknown tool/i.test(msg)) throw new EditToolError(msg, 'notBuilt')
    if (/^No job /.test(msg)) throw new EditToolError(msg, 'gone')
    if (err instanceof TypeError || /not responding|failed to fetch|json/i.test(msg)) {
      throw new EditToolError(msg, 'unreachable')
    }
    throw new EditToolError(msg, 'failed')
  }
}

// --- Background jobs -------------------------------------------------------------------------

// -> { job, kind, state: 'running' | 'done' | 'failed', seconds, output, log: [lines], result }
export const jobStatus = (token, job) => tool(token, 'job_status', { job })

// --- Step 1: footage --------------------------------------------------------------------------

// Copies a Drive folder (with subfolders) to the editor. driveToken: read-only Drive token
// (lib/driveAuth.js), used once by the editor and not stored. -> job; the job's result is
// { folder (absolute path on the editor), files: [{ name, path, bytes, skipped }] }.
export const fetchDriveFolder = (token, { folderId, driveToken }) =>
  tool(token, 'fetch_drive_folder', { folder_id: folderId, access_token: driveToken })

// Length, frame rate, timecode and sound tracks of every media file in a folder.
// -> { folder, files: [{ path, name, kind: 'video' | 'audio' | 'image', duration, audio_tracks, error? }] }
export const probeMedia = (token, folder) => tool(token, 'probe_media', { filepath: folder })

// --- Step 2: script ---------------------------------------------------------------------------

// Reads a screenplay (.pdf, .fountain, .txt) already on the editor. -> { title, scenes, dialogue_lines, ... }
export const readScreenplay = (token, path) => tool(token, 'read_screenplay', { filepath: path })

// The gateway caps a request at 1 MB, and base64 grows a file by a third.
export const MAX_UPLOAD_BYTES = 700 * 1024

const toBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).replace(/^data:[^,]*,/, ''))
    reader.onerror = () => reject(new EditToolError('Couldn’t read that file.', 'failed'))
    reader.readAsDataURL(file)
  })

// Sends a script PDF from this device into the project's folder on the editor.
// TODO(tool name): the editor has no upload tool yet. Proposed: `save_upload`
// { filepath, data_base64 } -> { filepath, bytes }. Until it exists this fails as 'notBuilt'.
export async function uploadScript(token, folder, file) {
  if (file.size > MAX_UPLOAD_BYTES) throw new EditToolError('tooLarge', 'tooLarge')
  const filepath = `${folder}/.latest-avenue/${file.name.replace(/[^\w. -]/g, '_')}`
  return tool(token, 'save_upload', { filepath, data_base64: await toBase64(file) })
}

// --- Step 3: the assembly cut ----------------------------------------------------------------

// -> job; its result is the editing script's summary. Without `script` the editor makes a
// rough one from what was said.
export const startAssembly = (token, { mediaFolder, output, script }) =>
  tool(token, 'start_assembly', { media_folder: mediaFolder, output, ...(script ? { script } : {}) })

// --- Step 4: the editing script --------------------------------------------------------------

// The whole editing script document (format in the builder's assembly/editing_script.py).
export const getEditingScript = (token, path) => tool(token, 'get_editing_script', { filepath: path, format: 'json' })

// Replaces the script's text (printed-screenplay layout, see toText in lib/editingScript.js).
// Lines keep their footage wherever they move. -> { kept, moved, retrimmed, new, removed, summary }
export const editEditingScript = (token, path, text) => tool(token, 'edit_editing_script', { filepath: path, text })

// Plays a line from another of its ranked takes (0 = best).
export const chooseTake = (token, path, line, take) => tool(token, 'choose_take', { filepath: path, line, take })

// Where a line starts and ends in its clip, in seconds.
export const setLineCut = (token, path, line, cutIn, cutOut) =>
  tool(token, 'set_line_cut', { filepath: path, line, cut_in: cutIn, cut_out: cutOut })

// --- Step 5: the sequencer -------------------------------------------------------------------

// Lays the editing script out on the timeline; the live view then shows the cut.
export const layOutEditingScript = (token, path) => tool(token, 'lay_out_editing_script', { filepath: path })

// --- Step 6: export --------------------------------------------------------------------------

// Export choices: a rendered video of the timeline, or a sequence file for another editor.
export const EXPORT_FORMATS = {
  video: { ext: 'mp4' },
  resolve: { ext: 'otio', format: 'otio' },
  premiere: { ext: 'xml', format: 'xml' },
  finalcut: { ext: 'fcpxml', format: 'fcpxml' },
}

// Renders the edit as it is on the timeline (blocks until done). -> { filepath, exists, bytes }
export const renderVideo = (token, output) => tool(token, 'render_video', { filepath: output, format: 'H264_MP4' })

// -> { filepath, format, events }
export const exportSequence = (token, path, output, format) =>
  tool(token, 'export_sequence', { filepath: path, output, format })

// Uploads a file from the editor into a Drive folder. driveToken has drive.file access
// (lib/driveExport.js). -> job; its result is { id, name, bytes }.
export const uploadToDrive = (token, { filepath, folderId, driveToken, name }) =>
  tool(token, 'upload_to_drive', { filepath, folder_id: folderId, access_token: driveToken, ...(name ? { name } : {}) })

// --- Where the flow got to (this browser) ----------------------------------------------------

const KEY = 'edit-project'

// The current project record, or null. Kept in localStorage (this browser only): the editor
// holds the real work; this only remembers the folder, file paths and job ids.
export function loadLocalProject(uid) {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY))
    return saved?.uid === uid ? saved.project : null
  } catch {
    return null
  }
}

export function saveLocalProject(uid, project) {
  try {
    if (project) localStorage.setItem(KEY, JSON.stringify({ uid, project }))
    else localStorage.removeItem(KEY)
  } catch {
    // storage unavailable: the flow still works for this page view
  }
}

// Where the project's own files go on the editor: a hidden folder inside the footage folder,
// which the editor's footage scan skips.
export const projectDir = (project) => `${project.footage.folder}/.latest-avenue`
export const editingScriptPath = (project) => `${projectDir(project)}/${project.id}.edit.json`
