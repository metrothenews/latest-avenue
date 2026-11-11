import { useEffect, useState } from 'react'
import DocContent from '../components/team/DocContent.jsx'
import { getAssignmentsDoc } from '../lib/assignments.js'
import { shortDate } from '../lib/drive.js'
import { team } from '../data/team.js'

const copy = team.assignments

// /team/assignments: the assignments doc, whole, as one page. Everyone on the team sees the same
// thing. The owner sets the doc and refreshes it at /admin/team.
export default function TeamAssignments() {
  const [doc, setDoc] = useState(undefined) // undefined while loading, null when there is none
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    getAssignmentsDoc().then(setDoc, () => setFailed(true))
  }, [])

  return (
    <div className="max-w-3xl">
      <h1 className="text-4xl font-extrabold tracking-tight">{copy.title}</h1>
      {doc?.updatedAt && <p className="mt-3 text-sm text-white/50">{copy.updated} {shortDate(doc.updatedAt)}</p>}
      {failed && <p className="mt-6 text-sm text-red-300/90">{copy.loadFailed}</p>}
      {doc === undefined && !failed && <p className="mt-6 text-sm text-white/50">Loading…</p>}
      {doc === null && <p className="mt-8 text-white/60">{copy.none}</p>}
      {doc && (
        <article className="glass mt-8 p-6 md:p-8">
          {doc.html ? <DocContent html={doc.html} /> : <p className="text-white/50">{copy.emptyDoc}</p>}
        </article>
      )}
    </div>
  )
}
