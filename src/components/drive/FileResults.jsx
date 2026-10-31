import FileIcon from './FileIcon.jsx'
import { fileSize, shortDate, typeLabel } from '../../lib/drive.js'

// Files as a list (default) or a thumbnail grid. Every item is a button that calls onOpen(file).
export default function FileResults({ files, layout, onOpen }) {
  if (layout === 'grid') {
    return (
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {files.map((f) => (
          <li key={f.id}>
            <button
              type="button"
              onClick={() => onOpen(f)}
              className="glass group flex w-full flex-col overflow-hidden text-left hover:border-white/30"
            >
              <FileIcon file={f} thumbnail className="aspect-[4/3] w-full bg-white/[0.03]" />
              <span className="block truncate px-3 pt-2.5 text-sm font-medium">{f.starred && '★ '}{f.name}</span>
              <span className="block px-3 pb-3 pt-0.5 text-xs text-white/40">{typeLabel(f.mimeType)} · {shortDate(f.modifiedTime)}</span>
            </button>
          </li>
        ))}
      </ul>
    )
  }

  return (
    <div className="glass overflow-hidden">
      <div className="hidden grid-cols-[2.5rem_1fr_9rem_7rem_5rem] gap-4 border-b border-white/10 px-4 py-2.5 text-xs uppercase tracking-wider text-white/40 md:grid">
        <span />
        <span>Name</span>
        <span>Type</span>
        <span>Modified</span>
        <span className="text-right">Size</span>
      </div>
      <ul>
        {files.map((f) => (
          <li key={f.id} className="border-b border-white/5 last:border-0">
            <button
              type="button"
              onClick={() => onOpen(f)}
              className="grid w-full grid-cols-[2.5rem_1fr] items-center gap-4 px-4 py-2.5 text-left hover:bg-white/[0.04] md:grid-cols-[2.5rem_1fr_9rem_7rem_5rem]"
            >
              <FileIcon file={f} className="h-10 w-10 rounded-lg bg-white/[0.04]" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{f.starred && <span className="text-white/50">★ </span>}{f.name}</span>
                <span className="block truncate text-xs text-white/40 md:hidden">{typeLabel(f.mimeType)} · {shortDate(f.modifiedTime)}</span>
              </span>
              <span className="hidden truncate text-sm text-white/50 md:block">{typeLabel(f.mimeType)}</span>
              <span className="hidden text-sm text-white/50 md:block">{shortDate(f.modifiedTime)}</span>
              <span className="hidden text-right text-sm text-white/50 md:block">{fileSize(f.size)}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
