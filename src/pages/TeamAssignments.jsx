import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import DocContent from '../components/team/DocContent.jsx'
import { getAssignmentsDoc, getLinkedDoc } from '../lib/assignments.js'
import { shortDate } from '../lib/drive.js'
import { team } from '../data/team.js'

const copy = team.assignments

// /team/assignments: the assignments doc, whole, as one page. /team/assignments/<docId>: a doc it
// links to, shown the same way. Everyone on the team sees the same thing; the owner sets the doc
// and refreshes it at /admin/team.
export default function TeamAssignments() {
  const { docId } = useParams()
  const [doc, setDoc] = useState(undefined) // undefined while loading, null when there is none
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let current = true
    setDoc(undefined)
    setFailed(false)
    const load = docId ? getLinkedDoc(docId) : getAssignmentsDoc()
    load.then((d) => current && setDoc(d), () => current && setFailed(true))
    return () => { current = false }
  }, [docId])

  return (
    <div className="max-w-3xl">
      {docId && <Link to="/team/assignments" className="mb-4 inline-block text-sm text-white/60 hover:text-white">‹ {copy.back}</Link>}
      <h1 className={`font-extrabold tracking-tight ${docId ? 'text-3xl md:text-4xl' : 'text-4xl'}`}>{docId ? doc?.title ?? (doc === null ? copy.title : '…') : copy.title}</h1>
      {doc?.updatedAt && <p className="mt-3 text-sm text-white/50">{copy.updated} {shortDate(doc.updatedAt)}</p>}
      {failed && <p className="mt-6 text-sm text-red-300/90">{copy.loadFailed}</p>}
      {doc === undefined && !failed && <p className="mt-6 text-sm text-white/50">Loading…</p>}
      {doc === null && <p className="mt-8 text-white/60">{docId ? copy.missingDoc : copy.none}</p>}
      {doc && (
        <article className="glass mt-8 p-6 md:p-8">
          {doc.html ? <DocContent html={doc.html} /> : <p className="text-white/50">{copy.emptyDoc}</p>}
        </article>
      )}
    </div>
  )
}
