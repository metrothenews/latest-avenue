import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../components/auth/AuthProvider.jsx'
import { getCrewMember } from '../lib/crew.js'
import { crew as copy } from '../data/crew.js'

const BOARDS = '/team/note/home'

// /team/note/welcome: shown after a crew sign-in (/team/crew). An empty page, then the welcome
// fades in one line at a time, then the page fades out and the note boards open.
export default function CrewWelcome() {
  const { configured, user, loading } = useAuth()
  const navigate = useNavigate()
  const [member, setMember] = useState(undefined) // undefined while checking, null when not crew
  const [shown, setShown] = useState(0) // how many lines have started to fade in
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    if (!user) return
    let current = true
    getCrewMember(user.email).then((m) => current && setMember(m), () => current && setMember(null))
    return () => { current = false }
  }, [user])

  const lines = member ? copy.welcome(member) : []
  const ms = copy.secondsPerLine * 1000

  useEffect(() => {
    if (!member) return
    // A beat on the empty page, then a line every `secondsPerLine`; after the last has faded in
    // and been read, fade the page out and open the boards.
    const timers = lines.map((_, i) => setTimeout(() => setShown(i + 1), 600 + i * ms))
    const end = 600 + lines.length * ms + 1500
    timers.push(setTimeout(() => setLeaving(true), end), setTimeout(() => navigate(BOARDS, { replace: true }), end + 1000))
    return () => timers.forEach(clearTimeout)
  }, [member]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!configured || (!loading && !user) || member === null) return <Navigate to="/team/crew" replace />

  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 py-10 text-center transition-opacity duration-1000 ease-in-out"
      style={{ opacity: leaving ? 0 : 1 }} aria-live="polite"
    >
      {lines.map((line, i) => (
        <p
          key={i}
          className={`max-w-full break-words transition-opacity ease-in-out ${line.big ? 'text-4xl font-extrabold tracking-tight sm:text-6xl' : 'text-xl text-white/70 sm:text-2xl'}`}
          style={{ opacity: i < shown ? 1 : 0, transitionDuration: `${ms}ms` }} aria-hidden={i >= shown}
        >
          {line.text}
        </p>
      ))}
      {member && (
        <button type="button" onClick={() => navigate(BOARDS, { replace: true })} className="fixed bottom-4 right-4 rounded-full px-4 py-2 text-sm text-white/30 hover:text-white">
          {copy.skip}
        </button>
      )}
    </main>
  )
}
