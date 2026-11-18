// Pure helpers for the editing script (shape in docs/edit-design.md). Each returns a new script
// and leaves the one passed in untouched, so the page can keep earlier versions for Undo.
// A line's takes and chosen take always travel with the line.

const mapLine = (script, id, fn) => ({ ...script, lines: script.lines.map((l) => (l.id === id ? fn(l) : l)) })

export const chosenTake = (line) => line.takes?.find((t) => t.id === line.chosen) ?? null

// Moves a line one place up (-1) or down (+1).
export function moveLine(script, id, by) {
  const lines = [...script.lines]
  const i = lines.findIndex((l) => l.id === id)
  const j = i + by
  if (i < 0 || j < 0 || j >= lines.length) return script
  ;[lines[i], lines[j]] = [lines[j], lines[i]]
  return { ...script, lines }
}

export const setOmitted = (script, id, omitted) => mapLine(script, id, (l) => ({ ...l, omitted }))

export const setText = (script, id, text) => mapLine(script, id, (l) => ({ ...l, text }))

export const chooseTake = (script, id, takeId) => mapLine(script, id, (l) => ({ ...l, chosen: takeId }))

const round = (n) => Math.round(n * 100) / 100

// Sets a take's in and/or out, kept inside the clip and at least 0.1 s long.
export function trimTake(script, lineId, takeId, { in_s, out_s }) {
  return mapLine(script, lineId, (l) => ({
    ...l,
    takes: l.takes.map((t) => {
      if (t.id !== takeId) return t
      const max = t.clip_s ?? Infinity
      let a = in_s ?? t.in_s
      let b = out_s ?? t.out_s
      a = Math.max(0, Math.min(a, max - 0.1))
      b = Math.min(max, Math.max(b, a + 0.1))
      return { ...t, in_s: round(a), out_s: round(b) }
    }),
  }))
}

// Gives a line an unused clip as a take (whole clip) and makes it the chosen one.
export function giveClip(script, lineId, clipId) {
  const clip = script.unmatched?.find((c) => c.clip_id === clipId)
  if (!clip) return script
  const take = { id: `web-${clipId}-${Date.now()}`, clip_id: clip.clip_id, name: clip.name, in_s: 0, out_s: clip.clip_s, clip_s: clip.clip_s, thumb: clip.thumb, slate: null, circled: null, notes: null }
  const next = mapLine(script, lineId, (l) => ({ ...l, takes: [...(l.takes ?? []), take], chosen: take.id }))
  return { ...next, unmatched: script.unmatched.filter((c) => c.clip_id !== clipId) }
}

// Adds an unused clip as a new action line at the end of the script.
export function appendUnmatched(script, clipId, text) {
  const clip = script.unmatched?.find((c) => c.clip_id === clipId)
  if (!clip) return script
  const id = `web-${clipId}-${Date.now()}`
  const line = { id, type: 'action', text, omitted: false, takes: [], chosen: null }
  return giveClip({ ...script, lines: [...script.lines, line] }, id, clipId)
}

// Length of the cut in seconds: the chosen take of every line that isn't cut.
export function cutLength(script) {
  return script.lines.reduce((sum, l) => {
    const t = !l.omitted && chosenTake(l)
    return t ? sum + (t.out_s - t.in_s) : sum
  }, 0)
}

// 75.4 -> "1:15.4"
export function clock(s) {
  if (s == null || Number.isNaN(s)) return '–'
  const m = Math.floor(s / 60)
  const sec = s - m * 60
  return `${m}:${sec < 10 ? '0' : ''}${sec.toFixed(1)}`
}
