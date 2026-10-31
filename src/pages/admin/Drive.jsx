import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Button from '../../components/ui/Button.jsx'
import Notice from '../../components/ui/Notice.jsx'
import FileResults from '../../components/drive/FileResults.jsx'
import FilePreview from '../../components/drive/FilePreview.jsx'
import { fieldClass } from '../../components/ui/fieldStyles.js'
import { useAuth } from '../../components/auth/AuthProvider.jsx'
import { clearDriveToken, connectDrive, getDriveToken } from '../../lib/driveAuth.js'
import { folderPath, isFolder, listFiles, sorts, types, views } from '../../lib/drive.js'

const DRIVE_API_URL = 'https://console.cloud.google.com/apis/library/drive.googleapis.com?project=latest-avenue-app'

const chip = (active) =>
  `rounded-full border px-3 py-1.5 text-sm ${active ? 'border-white/30 bg-white/15 text-white' : 'border-white/10 text-white/60 hover:border-white/20 hover:text-white'}`

function readLayout() {
  try {
    return localStorage.getItem('drive-layout') === 'grid' ? 'grid' : 'list'
  } catch {
    return 'list'
  }
}

// Searchable, read-only browser for the owner's Google Drive. State lives in the URL
// (?view, folder, q, type, sort) so back/forward and reloads keep your place.
export default function Drive() {
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  const view = views.some((v) => v.id === params.get('view')) ? params.get('view') : 'mine'
  const folderId = params.get('folder') ?? 'root'
  const search = params.get('q') ?? ''
  const type = types.some((t) => t.id === params.get('type')) ? params.get('type') : 'all'
  const sort = sorts.some((s) => s.id === params.get('sort')) ? params.get('sort') : 'modified'

  const [token, setToken] = useState(getDriveToken)
  const [input, setInput] = useState(search)
  const [files, setFiles] = useState([])
  const [nextPage, setNextPage] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null) // { message, kind }
  const [trail, setTrail] = useState([])
  const [layout, setLayout] = useState(readLayout)
  const [preview, setPreview] = useState(null)
  const [connecting, setConnecting] = useState(false)
  const searchRef = useRef(null)

  const update = (changes, replace = false) => {
    const next = new URLSearchParams(params)
    Object.entries(changes).forEach(([k, v]) => (v == null || v === '' ? next.delete(k) : next.set(k, v)))
    setParams(next, { replace })
  }

  function handleError(err) {
    if (err.kind === 'auth') {
      clearDriveToken()
      setToken(null)
    }
    setError({ message: err.message, kind: err.kind })
  }

  // Debounce typing into the ?q= param.
  useEffect(() => {
    if (input === search) return
    const t = setTimeout(() => update({ q: input.trim() || null }, true), 300)
    return () => clearTimeout(t)
  }, [input]) // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the box in sync when the URL changes (back/forward).
  useEffect(() => setInput(search), [search])

  // "/" focuses search, like Drive and GitHub.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  // Load the first page whenever the query changes.
  useEffect(() => {
    if (!token) return
    let cancelled = false
    setLoading(true)
    setError(null)
    listFiles(token, { view, folderId, search, type, sort })
      .then((r) => {
        if (cancelled) return
        setFiles(r.files ?? [])
        setNextPage(r.nextPageToken ?? null)
      })
      .catch((err) => !cancelled && handleError(err))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [token, view, folderId, search, type, sort])

  // Breadcrumbs for My Drive folders (fetched when opening a folder link directly).
  useEffect(() => {
    if (!token || view !== 'mine' || search || folderId === 'root') return setTrail([])
    if (trail.at(-1)?.id === folderId) return
    let cancelled = false
    folderPath(token, folderId).then((t) => !cancelled && setTrail(t)).catch(() => {})
    return () => {
      cancelled = true
    }
  }, [token, view, folderId, search]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleConnect() {
    setConnecting(true)
    setError(null)
    try {
      setToken(await connectDrive())
    } catch (err) {
      if (!['auth/popup-closed-by-user', 'auth/cancelled-popup-request'].includes(err.code)) {
        const message = err.code === 'auth/user-mismatch'
          ? `Pick ${user.email} in the Google popup.`
          : `Couldn't connect to Drive (${err.code ?? err.message}).`
        setError({ message, kind: 'other' })
      }
    } finally {
      setConnecting(false)
    }
  }

  async function loadMore() {
    setLoading(true)
    try {
      const r = await listFiles(token, { view, folderId, search, type, sort, pageToken: nextPage })
      setFiles((f) => [...f, ...(r.files ?? [])])
      setNextPage(r.nextPageToken ?? null)
    } catch (err) {
      handleError(err)
    } finally {
      setLoading(false)
    }
  }

  function open(file) {
    if (!isFolder(file)) return setPreview(file)
    // From search or another view the folder's real path is unknown, so clear it and let the effect fetch it.
    setTrail(search || view !== 'mine' ? [] : [...trail, { id: file.id, name: file.name }])
    setInput('')
    update({ view: null, folder: file.id, q: null })
  }

  function changeLayout(next) {
    setLayout(next)
    try {
      localStorage.setItem('drive-layout', next)
    } catch {
      // ignore
    }
  }

  const sortable = !search && view !== 'recent'

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight">Drive</h1>
          <p className="mt-2 text-sm text-white/50">{user.email} · read-only</p>
        </div>
        {token && (
          <div className="flex gap-1 rounded-full border border-white/10 p-1" role="group" aria-label="Layout">
            {['list', 'grid'].map((l) => (
              <button key={l} type="button" aria-pressed={layout === l} onClick={() => changeLayout(l)} className={`${chip(layout === l)} border-transparent capitalize`}>
                {l}
              </button>
            ))}
          </div>
        )}
      </div>

      {!token ? (
        <div className="glass mt-10 max-w-xl p-8">
          <h2 className="text-xl font-semibold">{error?.kind === 'auth' ? 'Reconnect Google Drive' : 'Connect Google Drive'}</h2>
          <p className="mt-3 text-white/60">
            Google asks for read-only access to {user.email}'s Drive. Access lasts about an hour, then you reconnect with one click.
            Files go straight from Google to this browser; nothing is stored.
          </p>
          <Button className="mt-6" onClick={handleConnect} disabled={connecting}>{connecting ? 'Waiting for Google…' : 'Connect Drive'}</Button>
          <Notice>{error && error.kind !== 'auth' ? error.message : ''}</Notice>
        </div>
      ) : (
        <>
          <div className="mt-8">
            <label htmlFor="drive-search" className="sr-only">Search Drive</label>
            <input
              id="drive-search"
              ref={searchRef}
              type="search"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && setInput('')}
              placeholder="Search names and contents…   ( / )"
              autoComplete="off"
              className={`${fieldClass()} py-3.5 text-base`}
            />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {views.map((v) => (
              <button key={v.id} type="button" aria-pressed={view === v.id} onClick={() => update({ view: v.id === 'mine' ? null : v.id, folder: null })} className={chip(view === v.id)}>
                {v.label}
              </button>
            ))}
            <span className="mx-1 hidden h-5 w-px bg-white/10 sm:block" />
            <label htmlFor="drive-sort" className="sr-only">Sort</label>
            <select
              id="drive-sort"
              value={sortable ? sort : ''}
              disabled={!sortable}
              onChange={(e) => update({ sort: e.target.value === 'modified' ? null : e.target.value })}
              className="rounded-full border border-white/10 bg-transparent px-3 py-1.5 text-sm text-white/70 disabled:opacity-50"
            >
              {!sortable && <option value="" className="bg-neutral-900">{search ? 'Best match' : 'Most recent'}</option>}
              {sorts.map((s) => <option key={s.id} value={s.id} className="bg-neutral-900">{s.label}</option>)}
            </select>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {types.map((t) => (
              <button key={t.id} type="button" aria-pressed={type === t.id} onClick={() => update({ type: t.id === 'all' ? null : t.id })} className={`${chip(type === t.id)} px-2.5 py-1 text-xs`}>
                {t.label}
              </button>
            ))}
          </div>

          <nav aria-label="Folder" className="mt-8 flex min-h-[1.75rem] flex-wrap items-center gap-1 text-sm">
            {search ? (
              <span className="text-white/60">Results for “{search}”{view !== 'mine' && ` in ${views.find((v) => v.id === view).label}`}</span>
            ) : view === 'mine' ? (
              <>
                <button type="button" onClick={() => update({ folder: null })} className={trail.length ? 'text-white/60 hover:text-white' : 'font-semibold'}>My Drive</button>
                {trail.map((f, i) => (
                  <span key={f.id} className="flex items-center gap-1">
                    <span className="text-white/30">/</span>
                    {i === trail.length - 1
                      ? <span className="font-semibold">{f.name}</span>
                      : <button type="button" onClick={() => { setTrail(trail.slice(0, i + 1)); update({ folder: f.id }) }} className="text-white/60 hover:text-white">{f.name}</button>}
                  </span>
                ))}
              </>
            ) : (
              <span className="font-semibold">{views.find((v) => v.id === view).label}</span>
            )}
            {!loading && <span className="ml-auto text-xs text-white/40">{files.length}{nextPage ? '+' : ''} items</span>}
            {view === 'mine' && !search && folderId !== 'root' && (
              <Button to={`/admin/campaigns?folder=${encodeURIComponent(folderId)}`} variant="secondary" className="ml-3 px-3 py-1.5 text-xs">New Meta campaign from this folder</Button>
            )}
          </nav>

          {error && (
            <Notice>
              {error.kind === 'disabled'
                ? <>The Google Drive API is turned off for this project. <a href={DRIVE_API_URL} target="_blank" rel="noreferrer" className="underline">Enable it here</a>, wait a minute, then reload.</>
                : error.message}
            </Notice>
          )}

          <div className="mt-4">
            {files.length > 0 && <FileResults files={files} layout={layout} onOpen={open} />}
            {loading && <p className="py-10 text-center text-sm text-white/40">Loading…</p>}
            {!loading && !error && files.length === 0 && (
              <p className="glass py-16 text-center text-sm text-white/50">{search ? 'No files match your search.' : 'Nothing here.'}</p>
            )}
            {nextPage && !loading && (
              <div className="mt-6 text-center"><Button variant="secondary" onClick={loadMore}>Load more</Button></div>
            )}
          </div>
        </>
      )}

      <FilePreview file={preview} onClose={() => setPreview(null)} />
    </div>
  )
}
