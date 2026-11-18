// Helpers for the editor's editing script document (format: the builder's
// assembly/editing_script.py in latest-avenue-edit). Structural changes (moving, removing or
// rewording lines) go back to the editor as screenplay text through edit_editing_script, which
// keeps each line's footage wherever it moves; toText mirrors the editor's own to_text so the
// text reads back exactly. Every helper returns a new document and leaves the old one alone.

const ACTION_INDENT = 0
const DIALOGUE_INDENT = 10
const PAREN_INDENT = 16
const CUE_INDENT = 22
const TRANSITION_INDENT = 50
// Same as the editor's screenplay.HEADING.
const HEADING = /^(?:\d+[A-Z]?\s+)?((?:INT\.?\s*\/\s*EXT|EXT\.?\s*\/\s*INT|INT|EXT|I\s*\/\s*E|EST)[.\s].*?)(?:\s+\d+[A-Z]?)?$/

const pad = (n) => ' '.repeat(n)

function wrap(text, width, indent) {
  const out = []
  let line = ''
  for (const word of String(text ?? '').split(/\s+/).filter(Boolean)) {
    if (line && line.length + 1 + word.length > width) {
      out.push(pad(indent) + line)
      line = word
    } else {
      line = `${line} ${word}`.trim()
    }
  }
  if (line) out.push(pad(indent) + line)
  return out
}

// The editing script as screenplay text, in the columns the editor reads back.
export function toText(doc) {
  const out = []
  if (doc.title) out.push(doc.title, '')
  for (const scene of doc.scenes ?? []) {
    if (scene.heading) out.push(HEADING.test(scene.heading) ? scene.heading : `.${scene.heading}`, '')
    for (const el of scene.elements ?? []) {
      if (el.type === 'action') out.push(...wrap(el.text, 60, ACTION_INDENT))
      else if (el.type === 'transition') out.push(pad(TRANSITION_INDENT) + el.text)
      else if (el.type === 'dialogue') {
        const ext = (el.extensions ?? []).map((e) => ` (${e})`).join('')
        out.push(pad(CUE_INDENT) + el.character + ext)
        const words = String(el.text ?? '').split(/\s+/).filter(Boolean)
        const parens = [...(el.parentheticals ?? [])].sort((a, b) => a.before_word - b.before_word)
        let at = 0
        for (const p of parens) {
          if (p.before_word > at) {
            out.push(...wrap(words.slice(at, p.before_word).join(' '), 35, DIALOGUE_INDENT))
            at = p.before_word
          }
          out.push(pad(PAREN_INDENT) + p.text)
        }
        out.push(...wrap(words.slice(at).join(' '), 35, DIALOGUE_INDENT))
      }
      out.push('')
    }
  }
  return `${out.join('\n').replace(/\s+$/, '')}\n`
}

const cloneScenes = (doc) => doc.scenes.map((s) => ({ ...s, elements: [...s.elements] }))

function locate(scenes, id) {
  for (let s = 0; s < scenes.length; s++) {
    const e = scenes[s].elements.findIndex((el) => el.id === id)
    if (e >= 0) return [s, e]
  }
  return [-1, -1]
}

// Moves a line one place up (-1) or down (+1); at the edge of a scene it crosses into the next.
export function moveLine(doc, id, by) {
  const scenes = cloneScenes(doc)
  const [s, e] = locate(scenes, id)
  if (s < 0) return doc
  const els = scenes[s].elements
  const j = e + by
  if (j >= 0 && j < els.length) {
    ;[els[e], els[j]] = [els[j], els[e]]
  } else {
    const t = s + by
    if (t < 0 || t >= scenes.length) return doc
    const [el] = els.splice(e, 1)
    if (by < 0) scenes[t].elements.push(el)
    else scenes[t].elements.unshift(el)
  }
  return { ...doc, scenes }
}

export function removeLine(doc, id) {
  const scenes = cloneScenes(doc)
  const [s, e] = locate(scenes, id)
  if (s < 0) return doc
  scenes[s].elements.splice(e, 1)
  return { ...doc, scenes }
}

export function setText(doc, id, text) {
  const scenes = cloneScenes(doc)
  const [s, e] = locate(scenes, id)
  if (s < 0) return doc
  scenes[s].elements[e] = { ...scenes[s].elements[e], text }
  return { ...doc, scenes }
}

// Every line in order, flat, with its scene. Headings are separate rows of type 'heading'.
export function rows(doc) {
  const out = []
  for (const scene of doc.scenes ?? []) {
    if (scene.heading) out.push({ id: `heading-${scene.id}`, type: 'heading', text: scene.heading, scene: scene.id })
    for (const el of scene.elements ?? []) out.push({ ...el, scene: scene.id })
  }
  return out
}

// The take a line plays, or null.
export const playingTake = (el) => (el.takes?.length && el.take != null ? el.takes[el.take] ?? null : null)

// How sure the editor is about a line's footage: 'strong' | 'likely' | 'guess' | 'cover' | null.
// Thresholds are a design guess on the matcher's 0..1 score (see docs/edit-design.md).
export function confidence(el) {
  if (!el.cut) return null
  if (el.type !== 'dialogue' || el.cut.from === 'cover') return 'cover'
  const score = playingTake(el)?.score
  if (score == null) return 'guess'
  if (score >= 0.8) return 'strong'
  if (score >= 0.5) return 'likely'
  return 'guess'
}

// Sound for one clip: 'synced' (to a separate recorder; `method` says how), 'camera' (only the
// camera's own sound), 'unsynced' (there are recorder files but this clip couldn't be matched
// to one, and it has no sound of its own), or null (not a picture clip / nothing to report).
export function soundStatus(doc, clipId) {
  const m = doc.media?.[clipId]
  if (!m || m.kind !== 'video') return null
  if (m.sound) return { status: 'synced', method: m.sound.method }
  const hasRecorder = Object.values(doc.media).some((x) => x.kind === 'audio')
  if (!hasRecorder) return m.audio_tracks ? null : { status: 'silent' }
  return { status: m.audio_tracks ? 'camera' : 'unsynced' }
}

// Every picture clip with its sound status, for the review list.
export function soundReport(doc) {
  return Object.entries(doc.media ?? {})
    .map(([id, m]) => ({ id, name: m.name ?? id, ...soundStatus(doc, id) }))
    .filter((c) => c.status)
}

export const clipName = (doc, clipId) => doc.media?.[clipId]?.name ?? clipId
export const clipLength = (doc, clipId) => doc.media?.[clipId]?.duration ?? null

// Length of the cut in seconds.
export function cutLength(doc) {
  let sum = 0
  for (const s of doc.scenes ?? []) for (const el of s.elements ?? []) if (el.cut && el.cut.out > el.cut.in) sum += el.cut.out - el.cut.in
  return sum
}

// 75.4 -> "1:15.4"
export function clock(s) {
  if (s == null || Number.isNaN(s)) return '–'
  const m = Math.floor(s / 60)
  const sec = s - m * 60
  return `${m}:${sec < 10 ? '0' : ''}${sec.toFixed(1)}`
}
