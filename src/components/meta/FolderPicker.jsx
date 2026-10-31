import { useEffect, useState } from 'react'
import FileIcon from '../drive/FileIcon.jsx'
import { fieldClass } from '../ui/fieldStyles.js'
import { listFiles } from '../../lib/drive.js'

// Search box over every Drive folder. Calls onPick(folder).
export default function FolderPicker({ token, onPick, onError }) {
  const [query, setQuery] = useState('')
  const [folders, setFolders] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    const t = setTimeout(() => {
      setLoading(true)
      // Empty query: recently modified folders anywhere in Drive.
      listFiles(token, query.trim() ? { search: query, type: 'folders' } : { view: 'recent', type: 'folders' })
        .then((r) => !cancelled && setFolders(r.files ?? []))
        .catch((err) => !cancelled && onError(err))
        .finally(() => !cancelled && setLoading(false))
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [token, query]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <label htmlFor="folder-search" className="sr-only">Search Drive folders</label>
      <input
        id="folder-search"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search your Drive folders…"
        autoComplete="off"
        className={fieldClass()}
      />
      <ul className="mt-3 max-h-72 overflow-y-auto rounded-xl border border-white/10">
        {folders.map((f) => (
          <li key={f.id} className="border-b border-white/5 last:border-0">
            <button type="button" onClick={() => onPick(f)} className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-white/[0.05]">
              <FileIcon file={f} className="h-7 w-7" />
              <span className="truncate">{f.name}</span>
            </button>
          </li>
        ))}
        {!loading && !folders.length && <li className="px-3 py-6 text-center text-sm text-white/40">No folders found.</li>}
        {loading && <li className="px-3 py-6 text-center text-sm text-white/40">Loading…</li>}
      </ul>
    </div>
  )
}
