import { useEffect, useRef, useState } from 'react'
import Button from '../ui/Button.jsx'
import { fieldClass } from '../ui/fieldStyles.js'
import { MAX_MESSAGE, messageTime, sendMessage, watchMessages } from '../../lib/teamChat.js'
import { team } from '../../data/team.js'

const copy = team.messages

// One conversation: live message list and the box to write in.
// `to` is the other person's email for a private chat, or undefined for the team chat.
// `started` is false for a private chat nobody has written in yet (there is nothing to load).
export default function Conversation({ chatId, to, me, started, nameOf, onSeen }) {
  const [messages, setMessages] = useState(started ? null : []) // null while loading
  const [loadError, setLoadError] = useState(false)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState(false)
  const list = useRef(null)

  useEffect(() => {
    if (!started) return
    return watchMessages(chatId, setMessages, () => setLoadError(true))
  }, [chatId, started])

  // Keep the newest message in view, and count what is on screen as read.
  useEffect(() => {
    if (list.current) list.current.scrollTop = list.current.scrollHeight
    // offsetParent is null while this chat is hidden (the list screen on a phone).
    if (messages?.length && list.current?.offsetParent) onSeen(chatId)
  }, [messages, chatId, onSeen])

  async function send(e) {
    e?.preventDefault()
    if (!text.trim() || sending) return
    setSending(true)
    setSendError(false)
    try {
      await sendMessage({ from: me, to, text })
      setText('')
    } catch {
      setSendError(true)
    } finally {
      setSending(false)
    }
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) send(e)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={list} className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 md:p-6" aria-live="polite">
        {loadError && <p className="text-sm text-red-300/90">{copy.loadFailed}</p>}
        {messages === null && !loadError && <p className="text-sm text-white/50">Loading…</p>}
        {messages?.length === 0 && <p className="text-sm text-white/50">{copy.empty}</p>}
        {messages?.map((m) => {
          const mine = m.from === me
          return (
            <div key={m.id} className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
              <p className="mb-1 text-xs text-white/50">
                {!mine && <span className="font-semibold text-white/70">{nameOf(m.from)} · </span>}
                <time dateTime={m.at.toISOString()}>{messageTime(m.at)}</time>
              </p>
              <p className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl border px-4 py-2 text-sm ${mine ? 'border-white/25 bg-white/20' : 'border-white/10 bg-white/5'}`}>
                {m.text}
              </p>
            </div>
          )
        })}
      </div>

      <form onSubmit={send} className="border-t border-white/10 p-3 md:p-4">
        <div className="flex items-end gap-3">
          <label htmlFor="message" className="sr-only">{copy.placeholder}</label>
          <textarea
            id="message"
            rows={1}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKeyDown}
            maxLength={MAX_MESSAGE}
            placeholder={copy.placeholder}
            className={`${fieldClass(sendError)} max-h-40 min-h-[3rem] resize-y !text-base`}
          />
          <Button type="submit" disabled={sending || !text.trim()}>{copy.send}</Button>
        </div>
        {sendError && <p className="mt-2 text-sm text-red-300/90">{copy.sendFailed}</p>}
      </form>
    </div>
  )
}
