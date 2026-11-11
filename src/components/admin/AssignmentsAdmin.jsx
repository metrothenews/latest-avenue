import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Button from '../ui/Button.jsx'
import Notice from '../ui/Notice.jsx'
import TextField from '../ui/TextField.jsx'
import { fieldClass } from '../ui/fieldStyles.js'
import { useAuth } from '../auth/AuthProvider.jsx'
import { connectDrive, getDriveToken } from '../../lib/driveAuth.js'
import {
  compareImport, docIdFromUrl, fetchDocMarkdown, getSource, headingCounts, listAllAssignments,
  publishImport, saveSource, setAssignees, splitAssignments, suggestLevel,
} from '../../lib/assignments.js'
import { shortDate } from '../../lib/drive.js'

const STATUS = { new: 'New', changed: 'Changed', same: 'Unchanged' }

// The Assignments section of /admin/team: import a backlog doc (one assignment per heading),
// then give each assignment to people on the team. `members`: the team list from the parent page.
export default function AssignmentsAdmin({ members }) {
  const { user } = useAuth()
  const [assignments, setAssignments] = useState(null) // null while loading
  const [url, setUrl] = useState('')
  const [urlError, setUrlError] = useState('')
  const [driveToken, setDriveToken] = useState(getDriveToken)
  const [fetched, setFetched] = useState(null) // { name, markdown, docId }
  const [level, setLevel] = useState(null)
  const [busy, setBusy] = useState('')
  const [status, setStatus] = useState('')
  const [editing, setEditing] = useState('') // id of the assignment whose people are being picked
  const [picked, setPicked] = useState([])

  useEffect(() => {
    Promise.all([listAllAssignments(), getSource()])
      .then(([list, source]) => {
        setAssignments(list)
        if (source?.url) setUrl(source.url)
        if (source?.level) setLevel(source.level)
      })
      .catch((err) => setStatus(`Couldn't load assignments: ${err.message}`))
  }, [])

  async function run(name, fn, failure) {
    setBusy(name)
    setStatus('')
    try {
      await fn()
    } catch (err) {
      if (err.kind === 'auth') setDriveToken(null)
      setStatus(`${failure}: ${err.message}`)
    } finally {
      setBusy('')
    }
  }

  const connect = () => run('drive', async () => {
    try {
      setDriveToken(await connectDrive())
    } catch (err) {
      if (['auth/popup-closed-by-user', 'auth/cancelled-popup-request'].includes(err.code)) return
      throw new Error(err.code === 'auth/user-mismatch' ? `Pick ${user.email} in the Google popup.` : err.code ?? err.message)
    }
  }, "Couldn't connect to Google Drive")

  function load(e) {
    e.preventDefault()
    const docId = docIdFromUrl(url)
    if (!docId) return setUrlError('Paste the link to a Google Doc (docs.google.com/document/d/…).')
    setUrlError('')
    run('fetch', async () => {
      const doc = await fetchDocMarkdown(driveToken, docId)
      const suggested = suggestLevel(doc.markdown)
      // Keep the saved level when the doc still has headings at it.
      setLevel((saved) => (saved && headingCounts(doc.markdown)[saved] ? saved : suggested))
      setFetched({ ...doc, docId })
    }, "Couldn't read the doc")
  }

  const counts = fetched ? headingCounts(fetched.markdown) : {}
  const split = fetched && level ? splitAssignments(fetched.markdown, level) : null
  const preview = split && assignments ? compareImport(split.items, assignments) : null
  const changes = preview && (preview.items.some((i) => i.status !== 'same') || preview.removed.length > 0)

  const publish = () => run('publish', async () => {
    await publishImport(split.items, assignments)
    await saveSource({ url: url.trim(), docId: fetched.docId, level })
    setAssignments(await listAllAssignments())
    setFetched(null)
    setStatus(`Imported ${split.items.length} assignment${split.items.length === 1 ? '' : 's'} from "${fetched.name}".`)
  }, "Couldn't save the assignments")

  function startPicking(a) {
    setEditing(a.id)
    setPicked(a.assignees ?? [])
  }

  const savePeople = (a) => run('people', async () => {
    const assignees = members.map((m) => m.email).filter((email) => picked.includes(email))
    await setAssignees(a.id, assignees)
    setAssignments((list) => list.map((x) => (x.id === a.id ? { ...x, assignees } : x)))
    setEditing('')
  }, "Couldn't save who it's assigned to")

  const nameOf = (email) => members.find((m) => m.email === email)?.name || email
  const backlog = assignments?.filter((a) => !a.assignees?.length).length ?? 0

  return (
    <section className="mt-14">
      <h2 className="text-2xl font-semibold">Assignments</h2>
      <p className="mt-2 max-w-2xl text-sm text-white/60">
        Paste the link to your backlog doc (a Google Doc or a Word file in your Drive). Each heading becomes one assignment.
        New ones wait in the backlog, visible only to you, until you assign them. People see their own under Assignments in the <a href="/team/assignments" className="underline">team portal</a>.
      </p>
      <Notice>{status}</Notice>

      <form onSubmit={load} noValidate className="glass mt-4 grid max-w-3xl gap-4 p-6">
        <TextField id="assignments-doc" label="Backlog doc link" showLabel value={url} onChange={(e) => { setUrl(e.target.value); setUrlError('') }} error={urlError} placeholder="https://docs.google.com/document/d/…" autoComplete="off" />
        <div className="flex flex-wrap items-center gap-3">
          {driveToken ? (
            <Button type="submit" disabled={Boolean(busy) || !assignments}>{busy === 'fetch' ? 'Reading the doc…' : assignments?.length ? 'Update from Google Doc' : 'Import from Google Doc'}</Button>
          ) : (
            <>
              <Button onClick={connect} disabled={Boolean(busy)}>{busy === 'drive' ? 'Opening Google…' : 'Connect Google Drive'}</Button>
              <span className="text-sm text-white/50">Needed to read the doc (read-only, lasts an hour).</span>
            </>
          )}
        </div>
      </form>

      {fetched && (
        <div className="glass mt-4 max-w-3xl p-6">
          <h3 className="font-semibold">Preview: {fetched.name}</h3>
          {Object.keys(counts).length === 0 ? (
            <p className="mt-3 text-sm text-white/60">This doc has no headings. In Google Docs, style each assignment's title as a heading (Format → Paragraph styles), then try again.</p>
          ) : (
            <>
              <label className="mt-4 block text-sm text-white/70">
                <span className="mb-1.5 block">Each assignment starts at</span>
                <select className={`${fieldClass(false)} !w-auto`} value={level ?? ''} onChange={(e) => setLevel(Number(e.target.value))}>
                  {Object.entries(counts).map(([l, n]) => <option key={l} value={l}>Heading {l} ({n} in the doc)</option>)}
                </select>
              </label>
              {split.intro && <p className="mt-4 text-sm text-white/50">Text before the first Heading {level} isn't part of any assignment and won't be shown.</p>}
              <ol className="mt-4 space-y-1.5 text-sm">
                {preview?.items.map((i) => (
                  <li key={i.key} className="flex items-start justify-between gap-4 border-t border-white/10 pt-1.5">
                    <span className="min-w-0">
                      <span className="block">{i.title}</span>
                      {i.imagesRemoved && <span className="block text-xs text-white/50">Images left out: too large to store.{i.tooBig && ' Still too long; split it into smaller sections.'}</span>}
                    </span>
                    <span className={`shrink-0 text-xs ${i.status === 'same' ? 'text-white/40' : 'text-white'}`}>{STATUS[i.status]}</span>
                  </li>
                ))}
              </ol>
              {preview?.removed.length > 0 && (
                <div className="mt-4 rounded-lg border border-white/15 p-3 text-sm text-white/70">
                  <p>No longer in the doc, so these will be deleted (and disappear for anyone they're assigned to):</p>
                  <ul className="mt-1 list-disc pl-5">
                    {preview.removed.map((a) => <li key={a.id}>{a.title}{a.assignees?.length ? ` (assigned to ${a.assignees.map(nameOf).join(', ')})` : ''}</li>)}
                  </ul>
                </div>
              )}
              <div className="mt-5 flex flex-wrap gap-3">
                <Button onClick={publish} disabled={Boolean(busy) || !changes || preview.items.some((i) => i.tooBig)}>{busy === 'publish' ? 'Saving…' : changes ? 'Publish' : 'Nothing has changed'}</Button>
                <Button variant="ghost" onClick={() => setFetched(null)} disabled={Boolean(busy)}>Cancel</Button>
              </div>
            </>
          )}
        </div>
      )}

      {assignments?.length > 0 && (
        <>
          <p className="mt-8 text-sm text-white/50">{assignments.length} assignment{assignments.length === 1 ? '' : 's'}, {backlog} in the backlog (not assigned yet).</p>
          <ul className="glass mt-3 max-w-3xl divide-y divide-white/10">
            {assignments.map((a) => (
              <li key={a.id} className="px-5 py-4 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
                  <div className="min-w-0">
                    <p className="font-semibold">{a.title}</p>
                    <p className="text-white/50">
                      {a.assignees?.length ? a.assignees.map(nameOf).join(', ') : 'Backlog'}
                      {a.updatedAt && ` · updated ${shortDate(a.updatedAt)}`}
                    </p>
                  </div>
                  <span className="flex shrink-0 gap-4">
                    <Link to={`/team/assignments/${a.id}`} className="text-white/40 hover:text-white">View</Link>
                    {editing !== a.id && <button type="button" className="text-white/40 hover:text-white disabled:opacity-50" onClick={() => startPicking(a)} disabled={Boolean(busy)}>Assign</button>}
                  </span>
                </div>
                {editing === a.id && (
                  <fieldset className="mt-3 rounded-lg border border-white/10 p-3">
                    <legend className="px-1 text-xs text-white/50">Assigned to</legend>
                    {members.length === 0 && <p className="text-white/50">Add people to the team first.</p>}
                    <div className="grid gap-1.5 sm:grid-cols-2">
                      {members.map((m) => (
                        <label key={m.email} className="flex items-center gap-2">
                          <input type="checkbox" checked={picked.includes(m.email)} onChange={(e) => setPicked((p) => (e.target.checked ? [...p, m.email] : p.filter((x) => x !== m.email)))} />
                          <span className="truncate">{m.name || m.email}</span>
                        </label>
                      ))}
                    </div>
                    <div className="mt-3 flex gap-3">
                      <Button onClick={() => savePeople(a)} disabled={Boolean(busy)}>{busy === 'people' ? 'Saving…' : 'Save'}</Button>
                      <Button variant="ghost" onClick={() => setEditing('')}>Cancel</Button>
                    </div>
                  </fieldset>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
