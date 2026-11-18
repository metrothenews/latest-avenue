// The /edit flow's calls to the video editor (latest-avenue-edit repo): one named function per
// editor tool, all through callEditTool (the gateway's POST /api/rpc). Shapes are documented in
// docs/edit-design.md ("Editor tool contract").
//
// TODO(tool names): every tool name below is a proposal from the design session, not yet
// confirmed by the editor's builder. If the builder picks different names or shapes, change
// them here (and in docs/edit-design.md) only; the page doesn't know the names.
import { callEditTool } from './editStream.js'

// Why a call failed. kind: 'notBuilt' (the editor doesn't have this tool yet), 'denied',
// 'unreachable' (the editor is off or starting) or 'failed' (the tool ran and said no).
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
    if (err.denied) throw new EditToolError('denied', 'denied')
    const msg = String(err.message ?? '')
    if (/unknown tool/i.test(msg)) throw new EditToolError(msg, 'notBuilt')
    if (err instanceof TypeError || /not responding|failed to fetch|unreachable|json/i.test(msg)) {
      throw new EditToolError(msg, 'unreachable')
    }
    throw new EditToolError(msg, 'failed')
  }
}

// The project open in the editor, or null when there is none.
// TODO(tool name): expected `project_status` {} -> Project | null
export const getProject = (token) => tool(token, 'project_status')

// TODO(tool name): expected `project_new` { name } -> Project (the editor keeps the old one)
export const startProject = (token, { name }) => tool(token, 'project_new', { name })

// Hands the editor the footage folder. driveToken is the read-only Drive token (lib/driveAuth.js).
// TODO(tool name): expected `footage_set_folder` { drive_folder_id, drive_folder_name, drive_token } -> Project
export const setFootageFolder = (token, { folderId, folderName, driveToken }) =>
  tool(token, 'footage_set_folder', { drive_folder_id: folderId, drive_folder_name: folderName, drive_token: driveToken })

// TODO(tool name): expected `script_set` { source: 'drive', drive_file_id, name, drive_token } -> Project
export const setScriptFromDrive = (token, { fileId, name, driveToken }) =>
  tool(token, 'script_set', { source: 'drive', drive_file_id: fileId, name, drive_token: driveToken })

// The gateway caps a request at 1 MB, and base64 grows a file by a third.
export const MAX_UPLOAD_BYTES = 700 * 1024

const toBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).replace(/^data:[^,]*,/, ''))
    reader.onerror = () => reject(new EditToolError('Couldn’t read that file.', 'failed'))
    reader.readAsDataURL(file)
  })

// TODO(tool name): expected `script_set` { source: 'upload', name, pdf_base64 } -> Project
export async function uploadScript(token, file) {
  if (file.size > MAX_UPLOAD_BYTES) throw new EditToolError('tooLarge', 'tooLarge')
  return tool(token, 'script_set', { source: 'upload', name: file.name, pdf_base64: await toBase64(file) })
}

// No script: the editor builds a rough one from the footage.
// TODO(tool name): expected `script_set` { source: 'none' } -> Project
export const skipScript = (token) => tool(token, 'script_set', { source: 'none' })

// Starts building the assembly cut. Returns straight away; progress is in getProject().assembly.
// TODO(tool name): expected `assembly_start` {} -> Project
export const startAssembly = (token) => tool(token, 'assembly_start')

// TODO(tool name): expected `editing_script_get` {} -> EditingScript
export const getEditingScript = (token) => tool(token, 'editing_script_get')

// TODO(tool name): expected `editing_script_save` { editing_script } -> { saved_at }
export const saveEditingScript = (token, script) => tool(token, 'editing_script_save', { editing_script: script })

// Lays the saved editing script out in the sequencer. Returns once the cut is on the timeline.
// TODO(tool name): expected `editing_script_submit` {} -> { ok, strips }
export const submitEditingScript = (token) => tool(token, 'editing_script_submit')

// kind: 'video' (rendered MP4) or 'sequence' (OpenTimelineIO). driveToken has drive.file
// access (lib/driveExport.js). Progress is in getProject().export.
// TODO(tool name): expected `export_start` { kind, drive_token, drive_folder_name } -> Project
export const startExport = (token, { kind, driveToken, folderName }) =>
  tool(token, 'export_start', { kind, drive_token: driveToken, drive_folder_name: folderName })
