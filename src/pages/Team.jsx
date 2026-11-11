import { useEffect, useState } from 'react'
import { useAuth } from '../components/auth/AuthProvider.jsx'
import { useTeamMember } from '../components/team/TeamAccess.jsx'
import { getWelcome } from '../lib/team.js'
import { team as copy } from '../data/team.js'

// Team portal home: the welcome message set at /admin/team. Access is handled by TeamAccess.
export default function Team() {
  const { user } = useAuth()
  const member = useTeamMember()
  const [welcome, setWelcome] = useState(undefined) // undefined while loading

  useEffect(() => {
    getWelcome().then(setWelcome, () => setWelcome(null))
  }, [])

  if (welcome === undefined) return <p className="text-sm text-white/50">Loading…</p>

  const firstName = (member.name || user.displayName || '').trim().split(/\s+/)[0]
  return (
    <div>
      <h1 className="text-4xl font-extrabold tracking-tight">
        {welcome?.heading || copy.defaultHeading}{firstName && `, ${firstName}`}
      </h1>
      {member.role && <p className="mt-3 text-white/60">{member.role}</p>}
      <section className="glass mt-10 max-w-3xl p-8">
        <p className="whitespace-pre-line text-white/80">{welcome?.message || copy.defaultMessage}</p>
      </section>
    </div>
  )
}
