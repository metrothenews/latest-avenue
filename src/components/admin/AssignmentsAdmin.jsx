import { useEffect, useState } from 'react'
import Button from '../ui/Button.jsx'
import Notice from '../ui/Notice.jsx'
import TextField from '../ui/TextField.jsx'
import { useAuth } from '../auth/AuthProvider.jsx'
import { connectDrive, getDriveToken } from '../../lib/driveAuth.js'
import { docIdFromUrl, fetchDocHtml, getDocInfo, getSource, publishDoc } from '../../lib/assignments.js'
import { shortDate } from '../../lib/drive.js'

// The Assignments section of /admin/team: one doc link. Refresh reads the doc as it is now and
// puts it, whole, on the team's Assignments page. Changing the link replaces what's shown.
export default function AssignmentsAdmin() {
  const { user } = useAuth()
  const [url, setUrl] = useState('')
  const [urlError, setUrlError] = useState('')
  const [shown, setShown] = useState(undefined) // { title, updatedAt } on the team's page; null if nothing; undefined while loading
  const [driveToken, setDriveToken] = useState(getDriveToken)
  const [busy, setBusy] = useState('')
  const [status, setStatus] = useState('')

  useEffect(() => {
    Promise.all([getSource(), getDocInfo()])
      .then(([source, info]) => {
        if (source?.url) setUrl(source.url)
        setShown(info)
      })
      .catch((err) => setStatus(`Couldn't load the assignments doc: ${err.message}`))
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

  function refresh(e) {
    e.preventDefault()
    const docId = docIdFromUrl(url)
    if (!docId) return setUrlError('Paste the link to a Google Doc (docs.google.com/document/d/…).')
    setUrlError('')
    run('refresh', async () => {
      const doc = await fetchDocHtml(driveToken, docId)
      const { imagesRemoved } = await publishDoc({ url: url.trim(), docId, ...doc })
      setShown(await getDocInfo())
      setStatus(`The team's Assignments page now shows "${doc.name}" as it is right now.${imagesRemoved ? ' Its images were left out because the doc is too large with them.' : ''}`)
    }, "Couldn't refresh from the doc")
  }

  return (
    <section className="mt-14">
      <h2 className="text-2xl font-semibold">Assignments</h2>
      <p className="mt-2 max-w-2xl text-sm text-white/60">
        One doc (a Google Doc, or a Word file in your Drive) is shown whole on the team's <a href="/team/assignments" className="underline">Assignments page</a>.
        After you edit the doc, press Refresh to update the page. Pasting a different link and refreshing replaces it.
      </p>
      <Notice>{status}</Notice>

      <form onSubmit={refresh} noValidate className="glass mt-4 grid max-w-3xl gap-4 p-6">
        <TextField id="assignments-doc" label="Doc link" showLabel value={url} onChange={(e) => { setUrl(e.target.value); setUrlError('') }} error={urlError} placeholder="https://docs.google.com/document/d/…" autoComplete="off" />
        <div className="flex flex-wrap items-center gap-3">
          {driveToken ? (
            <Button type="submit" disabled={Boolean(busy) || shown === undefined}>{busy === 'refresh' ? 'Reading the doc…' : 'Refresh'}</Button>
          ) : (
            <>
              <Button onClick={connect} disabled={Boolean(busy)}>{busy === 'drive' ? 'Opening Google…' : 'Connect Google Drive'}</Button>
              <span className="text-sm text-white/50">Needed to read the doc (read-only, lasts an hour).</span>
            </>
          )}
        </div>
        <p className="text-sm text-white/50">
          {shown === undefined ? 'Loading…' : shown ? <>Showing <span className="text-white/80">{shown.title}</span>, last refreshed {shortDate(shown.updatedAt)}.</> : 'Nothing is shown to the team yet.'}
        </p>
      </form>
    </section>
  )
}
