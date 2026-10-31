const MARK = { running: '…', done: '✓', error: '✕' }
const COLOR = { running: 'text-white/70', done: 'text-white/50', error: 'text-red-300' }

// Step-by-step progress of a campaign copy.
export default function RunLog({ entries }) {
  return (
    <ol className="max-h-96 space-y-1 overflow-y-auto rounded-xl border border-white/10 bg-black/20 p-4 font-mono text-xs">
      {entries.map((e) => (
        <li key={e.id} className={COLOR[e.state]}>
          <span className="inline-block w-4">{MARK[e.state]}</span>
          {e.text}
          {e.state === 'running' && e.progress != null && ` (${Math.round(e.progress * 100)}%)`}
          {e.detail && <span className="block pl-4 text-red-300/80">{e.detail}</span>}
        </li>
      ))}
    </ol>
  )
}
