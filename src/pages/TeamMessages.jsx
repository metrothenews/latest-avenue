import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Conversation from '../components/team/Conversation.jsx'
import { useTeamMember } from '../components/team/TeamAccess.jsx'
import { listMembers } from '../lib/team.js'
import { TEAM_CHAT, directChatId, watchChats } from '../lib/teamChat.js'
import { team } from '../data/team.js'

const copy = team.messages
const READ_KEY = 'la-team-read' // { chatId: time last opened (ms) }, per browser

function loadRead() {
  try {
    return JSON.parse(localStorage.getItem(READ_KEY)) ?? {}
  } catch {
    return {}
  }
}

// /team/messages: the team chat and private one-to-one chats. `?chat=team` or `?chat=<email>` picks one.
// On a phone the list and the open chat are separate screens; on a wider screen they sit side by side.
export default function TeamMessages() {
  const me = useTeamMember().email
  const [params] = useSearchParams()
  const [members, setMembers] = useState(null) // null while loading
  const [chats, setChats] = useState(null) // { chatId: { lastAt, lastFrom } }, null while loading
  const [failed, setFailed] = useState(false)
  const [read, setRead] = useState(loadRead)

  useEffect(() => {
    listMembers().then(setMembers, () => setFailed(true))
    return watchChats(me, setChats, () => setFailed(true))
  }, [me])

  const markSeen = useCallback((chatId) => {
    setRead((prev) => {
      const next = { ...prev, [chatId]: Date.now() }
      try {
        localStorage.setItem(READ_KEY, JSON.stringify(next))
      } catch {
        // Private browsing: unread dots just won't be remembered.
      }
      return next
    })
  }, [])

  const names = useMemo(() => new Map((members ?? []).map((m) => [m.email, m.name || m.email])), [members])
  const nameOf = useCallback((email) => names.get(email) ?? `${email} (${copy.formerMember})`, [names])

  if (failed) return <p className="text-sm text-red-300/90">{copy.loadFailed}</p>
  if (!members || !chats) return <p className="text-sm text-white/50">Loading…</p>

  const others = members.filter((m) => m.email !== me)
  const picked = params.get('chat')
  // An unknown ?chat= falls back to the team chat. With none, a wide screen shows the team chat.
  const to = others.some((m) => m.email === picked) ? picked : undefined
  const chatId = to ? directChatId(me, to) : TEAM_CHAT
  const unread = (id) => id !== (picked && chatId) && chats[id]?.lastFrom && chats[id].lastFrom !== me && chats[id].lastAt > (read[id] ?? 0)

  const item = (id, target, label, note) => {
    const active = id === chatId
    return (
      <li key={id}>
        <Link
          to={`/team/messages?chat=${encodeURIComponent(target)}`}
          aria-current={active ? 'page' : undefined}
          className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 ${active ? 'md:bg-white/10' : ''} hover:bg-white/5`}
        >
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">{label}</span>
            {note && <span className="block truncate text-xs text-white/50">{note}</span>}
          </span>
          {unread(id) && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-white" role="img" aria-label="New messages" />}
        </Link>
      </li>
    )
  }

  return (
    <div>
      <h1 className={`text-4xl font-extrabold tracking-tight ${picked ? 'hidden md:block' : ''}`}>{copy.title}</h1>
      <div className="mt-0 gap-6 md:mt-8 md:grid md:grid-cols-[16rem_1fr]">
        <nav aria-label="Conversations" className={`mt-8 md:mt-0 ${picked ? 'hidden md:block' : ''}`}>
          <ul className="space-y-1">{item(TEAM_CHAT, TEAM_CHAT, copy.teamChat, copy.teamChatNote)}</ul>
          <h2 className="mb-2 mt-6 px-3 text-xs font-semibold uppercase tracking-widest text-white/50">{copy.direct}</h2>
          {others.length === 0 && <p className="px-3 text-sm text-white/50">{copy.nobodyElse}</p>}
          <ul className="space-y-1">{others.map((m) => item(directChatId(me, m.email), m.email, m.name || m.email, m.role))}</ul>
        </nav>

        <section className={`glass h-[calc(100dvh-13rem)] flex-col md:flex md:h-[calc(100dvh-16rem)] ${picked ? 'flex' : 'hidden'}`}>
          <header className="flex items-center gap-3 border-b border-white/10 px-4 py-3 md:px-6">
            <Link to="/team/messages" className="text-sm text-white/60 hover:text-white md:hidden" aria-label={copy.back}>←</Link>
            <h2 className="truncate font-semibold">{to ? nameOf(to) : copy.teamChat}</h2>
          </header>
          <Conversation key={chatId} chatId={chatId} to={to} me={me} started={Boolean(chats[chatId])} nameOf={nameOf} onSeen={markSeen} />
        </section>
      </div>
    </div>
  )
}
