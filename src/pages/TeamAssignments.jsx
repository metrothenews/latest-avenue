import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Markdown from '../components/team/Markdown.jsx'
import { useAuth } from '../components/auth/AuthProvider.jsx'
import { useTeamMember } from '../components/team/TeamAccess.jsx'
import { getAssignment, listAllAssignments, listMyAssignments } from '../lib/assignments.js'
import { shortDate } from '../lib/drive.js'
import { team } from '../data/team.js'

const copy = team.assignments

// /team/assignments: the assignments given to the signed-in person; /team/assignments/:id opens one.
// The owner sees every assignment that has been given to someone, as a preview.
export default function TeamAssignments() {
  const { id } = useParams()
  const { isOwner } = useAuth()
  const me = useTeamMember().email
  const [list, setList] = useState(null) // null while loading
  const [open, setOpen] = useState(undefined) // the opened assignment; undefined while loading, null if missing
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (id) return
    let current = true
    const load = isOwner ? listAllAssignments().then((all) => all.filter((a) => a.assignees?.length)) : listMyAssignments(me)
    load.then((l) => current && setList(l), () => current && setFailed(true))
    return () => { current = false }
  }, [id, isOwner, me])

  useEffect(() => {
    if (!id) return
    let current = true
    setOpen(undefined)
    // A team member can't read an assignment that isn't theirs: the rules refuse it, shown as not found.
    getAssignment(id).then((a) => current && setOpen(a), () => current && setOpen(null))
    return () => { current = false }
  }, [id])

  if (id) {
    return (
      <div className="max-w-3xl">
        <Link to="/team/assignments" className="text-sm text-white/60 hover:text-white">‹ {copy.back}</Link>
        {open === undefined && <p className="mt-6 text-sm text-white/50">Loading…</p>}
        {open === null && <p className="mt-6 text-white/70">{copy.notFound}</p>}
        {open && (
          <article className="mt-4">
            <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">{open.title}</h1>
            {open.updatedAt && <p className="mt-2 text-sm text-white/50">{copy.updated} {shortDate(open.updatedAt)}</p>}
            <div className="glass mt-8 p-6 md:p-8">
              {open.markdown ? <Markdown>{open.markdown}</Markdown> : <p className="text-white/50">{copy.emptyBody}</p>}
            </div>
          </article>
        )}
      </div>
    )
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-4xl font-extrabold tracking-tight">{copy.title}</h1>
      {isOwner && <p className="mt-3 text-sm text-white/50">{copy.ownerNote}</p>}
      {failed && <p className="mt-6 text-sm text-red-300/90">{copy.loadFailed}</p>}
      {!list && !failed && <p className="mt-6 text-sm text-white/50">Loading…</p>}
      {list?.length === 0 && <p className="mt-8 text-white/60">{copy.none}</p>}
      {list?.length > 0 && (
        <ul className="mt-8 space-y-3">
          {list.map((a) => (
            <li key={a.id}>
              <Link to={`/team/assignments/${a.id}`} className="glass flex items-center justify-between gap-4 px-5 py-4 hover:border-white/30 hover:bg-white/5">
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{a.title}</span>
                  {isOwner && <span className="block truncate text-xs text-white/50">{a.assignees.join(', ')}</span>}
                </span>
                {a.updatedAt && <span className="shrink-0 text-xs text-white/40">{shortDate(a.updatedAt)}</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
