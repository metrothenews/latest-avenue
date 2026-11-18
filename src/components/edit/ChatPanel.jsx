import { useCallback, useEffect, useRef, useState } from 'react'
import Button from '../ui/Button.jsx'
import { edit } from '../../data/edit.js'
import { getChatEvents, getChatState, newChat, sendChatFeedback, sendChatMessage, stopChat } from '../../lib/editStream.js'

const copy = edit.chat

// One tool call with its result: a compact line that opens to show what was sent and returned.
function ToolRow({ call, result }) {
  const pending = !result
  return (
    <details className="rounded-lg border border-white/10 bg-white/5 text-xs">
      <summary className="flex min-h-9 cursor-pointer items-center gap-2 px-3 py-1.5 text-white/70">
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${pending ? 'bg-white/30' : result.ok ? 'bg-white' : 'border border-white/60'}`} />
        <span className="truncate font-mono">{call.name}</span>
        <span className="ml-auto shrink-0 text-white/40">{pending ? '…' : result.ok ? `${result.seconds}s` : 'failed'}</span>
      </summary>
      <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words border-t border-white/10 px-3 py-2 text-white/60">{JSON.stringify(call.arguments, null, 1)}</pre>
      {result && <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words border-t border-white/10 px-3 py-2 text-white/60">{result.text}</pre>}
    </details>
  )
}

// Thumbs for a finished answer. "Not right" opens a note; both go into the training record.
function Feedback({ seq, given, onRate }) {
  const [noting, setNoting] = useState(false)
  const [note, setNote] = useState('')
  if (given) return <p className="text-xs text-white/40">{copy.thanks}: {given === 'up' ? copy.good : copy.bad}</p>
  if (noting) {
    return (
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); onRate(seq, 'down', note) }}>
        <input autoFocus value={note} onChange={(e) => setNote(e.target.value)} placeholder={copy.notePlaceholder}
          className="min-h-9 min-w-0 flex-1 rounded-lg border border-white/15 bg-white/5 px-3 text-xs text-white outline-none focus:border-white/40" />
        <button type="submit" className="min-h-9 rounded-full border border-white/15 px-3 text-xs text-white/80 hover:text-white">{copy.saveNote}</button>
      </form>
    )
  }
  return (
    <div className="flex gap-2">
      <button type="button" onClick={() => onRate(seq, 'up', '')} className="min-h-9 rounded-full border border-white/15 px-3 text-xs text-white/60 hover:text-white">{copy.good}</button>
      <button type="button" onClick={() => setNoting(true)} className="min-h-9 rounded-full border border-white/15 px-3 text-xs text-white/60 hover:text-white">{copy.bad}</button>
    </div>
  )
}

// Chat with the editing agent that runs next to the editor (cloud/agent.py in the editor's
// repo). `getToken` returns a fresh sign-in token; `active` is false until the editor is up.
export default function ChatPanel({ getToken, active }) {
  const [events, setEvents] = useState([])
  const [info, setInfo] = useState(null)       // { busy, llm, session }
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [rated, setRated] = useState({})
  const last = useRef(0)
  const session = useRef(null)
  const list = useRef(null)

  // Follow the chat's events for as long as the panel is shown.
  useEffect(() => {
    if (!active) return undefined
    let stop = false
    ;(async () => {
      try {
        const state = await getChatState(await getToken())
        if (!stop) setInfo(state)
      } catch { /* the loop below reports it */ }
      while (!stop) {
        try {
          const data = await getChatEvents(await getToken(), last.current)
          if (stop) return
          if (session.current && data.session !== session.current) { last.current = 0; setEvents([]); setRated({}) }
          session.current = data.session
          setInfo(data)
          setError('')
          if (data.events.length) {
            last.current = data.events[data.events.length - 1].seq
            setEvents((old) => [...old.filter((e) => !e.transient), ...data.events])
          }
        } catch (err) {
          if (stop) return
          setError(err.denied ? '' : copy.unreachable)
          await new Promise((r) => setTimeout(r, 3000))
        }
      }
    })()
    return () => { stop = true }
  }, [active, getToken])

  useEffect(() => {
    const el = list.current
    if (el) el.scrollTop = el.scrollHeight
  }, [events])

  const act = useCallback(async (fn) => {
    try { setError(''); await fn(await getToken()) } catch (err) { setError(err.message === 'unreachable' ? copy.unreachable : err.message) }
  }, [getToken])

  const submit = (e) => {
    e.preventDefault()
    const message = text.trim()
    if (!message || info?.busy) return
    setText('')
    act((token) => sendChatMessage(token, message))
  }
  const rate = (seq, rating, note) => {
    setRated((r) => ({ ...r, [seq]: rating }))
    act((token) => sendChatFeedback(token, seq, rating, note))
  }

  // Pair tool calls with their results; keep only the newest status lines.
  const results = Object.fromEntries(events.filter((e) => e.type === 'tool_result').map((e) => [e.id, e]))
  const status = [...events].reverse().find((e) => e.type === 'model_status' || e.type === 'thinking')
  const shown = events.filter((e) => ['user_message', 'assistant_message', 'tool_call', 'capability_gap', 'error', 'stopped'].includes(e.type))
  const busy = Boolean(info?.busy)
  let statusLine = ''
  if (busy && status) {
    if (status.type === 'thinking') statusLine = `${copy.working} (${copy.step} ${status.step})`
    else if (status.state === 'downloading') statusLine = `${copy.model.downloading}${status.total ? ` ${Math.round((100 * status.done) / status.total)}%` : '…'}`
    else statusLine = copy.model[status.state] ?? copy.working
  } else if (busy) statusLine = copy.working

  return (
    <section className="flex h-full min-h-0 flex-col" aria-label={copy.title}>
      <div className="flex min-h-11 shrink-0 items-center gap-2 border-b border-white/10 px-3">
        <h2 className="text-sm font-semibold">{copy.title}</h2>
        {info?.llm && (
          <span className="min-w-0 truncate text-xs text-white/40">
            {info.llm.model.replace(/\.gguf$/i, '')} · {info.llm.adapters.length ? `${info.llm.adapters.length} ${copy.adapters}` : copy.noAdapters}
          </span>
        )}
        <button type="button" disabled={busy} onClick={() => act(newChat)} className="ml-auto min-h-9 shrink-0 rounded-full px-3 text-xs text-white/60 hover:text-white disabled:opacity-40">{copy.newChat}</button>
      </div>

      <div ref={list} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {!shown.length && <p className="text-sm leading-relaxed text-white/50">{copy.intro}</p>}
        {shown.map((e) => {
          if (e.type === 'user_message') return <p key={e.seq} className="ml-8 whitespace-pre-wrap break-words rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm">{e.text}</p>
          if (e.type === 'tool_call') return <ToolRow key={e.seq} call={e} result={results[e.id]} />
          if (e.type === 'capability_gap') return <p key={e.seq} className="rounded-xl border border-white/30 px-3 py-2 text-xs leading-relaxed text-white/70">{copy.gap} {e.capability}</p>
          if (e.type === 'error') return <p key={e.seq} className="rounded-xl border border-white/30 px-3 py-2 text-xs text-white/70">{e.text}</p>
          if (e.type === 'stopped') return <p key={e.seq} className="text-xs text-white/40">{copy.stop}</p>
          return (
            <div key={e.seq} className="space-y-2">
              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-white/80">{e.text}</p>
              {e.final && <Feedback seq={e.seq} given={rated[e.seq]} onRate={rate} />}
            </div>
          )
        })}
        {statusLine && <p className="text-xs text-white/40" role="status">{statusLine}</p>}
        {error && <p className="text-xs text-white/60" role="alert">{error}</p>}
      </div>

      <form onSubmit={submit} className="flex shrink-0 gap-2 border-t border-white/10 p-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) submit(e) }}
          rows={2}
          placeholder={copy.placeholder}
          disabled={!active}
          className="min-h-11 min-w-0 flex-1 resize-none rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-white/30 focus:border-white/40 disabled:opacity-40"
        />
        {busy
          ? <Button variant="secondary" className="min-h-11 shrink-0 self-end !px-4 !py-2" onClick={() => act(stopChat)}>{copy.stop}</Button>
          : <Button className="min-h-11 shrink-0 self-end !px-4 !py-2" type="submit" disabled={!active || !text.trim()}>{copy.send}</Button>}
      </form>
    </section>
  )
}
