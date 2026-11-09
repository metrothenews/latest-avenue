import { useEffect, useMemo, useState } from 'react'
import Button from '../ui/Button.jsx'
import Notice from '../ui/Notice.jsx'
import { fieldClass } from '../ui/fieldStyles.js'
import { getCampaignResults, resultPeriods } from '../../lib/meta.js'

const statusLabel = (s) => s?.toLowerCase().replace(/_/g, ' ')
const count = (n) => (n == null ? '—' : n.toLocaleString())
const pct = (part, whole) => (whole ? `${((part / whole) * 100).toFixed(2)}%` : '—')

const COLUMNS = [
  { id: 'name', label: 'Ad' },
  { id: 'status', label: 'Status' },
  { id: 'spend', label: 'Spent', numeric: true },
  { id: 'results', label: 'Results', numeric: true },
  { id: 'costPerResult', label: 'Cost / result', numeric: true },
  { id: 'impressions', label: 'Impressions', numeric: true },
  { id: 'reach', label: 'Reach', numeric: true },
  { id: 'linkClicks', label: 'Link clicks', numeric: true },
  { id: 'ctr', label: 'CTR', numeric: true },
]

// Read-only results of a run's campaign: totals, each ad set, and every ad, for a chosen period.
// Nothing here changes anything on Meta.
export default function RunResults({ campaignId, metaToken, onAuthError }) {
  const [period, setPeriod] = useState('maximum')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sort, setSort] = useState({ id: 'spend', desc: true })
  const [adsetId, setAdsetId] = useState('all')
  const [reload, setReload] = useState(0)

  useEffect(() => {
    if (!metaToken) return
    let stop = false
    setLoading(true)
    setError('')
    getCampaignResults(metaToken, campaignId, period)
      .then((d) => !stop && setData(d))
      .catch((err) => {
        if (stop) return
        if (err.kind === 'auth') onAuthError(err)
        setError(`Couldn't load results: ${err.message}`)
      })
      .finally(() => !stop && setLoading(false))
    return () => {
      stop = true
    }
  }, [campaignId, metaToken, period, reload]) // eslint-disable-line react-hooks/exhaustive-deps

  const money = useMemo(() => {
    const f = new Intl.NumberFormat(undefined, { style: 'currency', currency: data?.currency ?? 'USD' })
    return (n) => (n == null ? '—' : f.format(n))
  }, [data?.currency])

  const ads = useMemo(() => {
    if (!data) return []
    const list = data.ads
      .filter((a) => adsetId === 'all' || a.adsetId === adsetId)
      .map((a) => ({ ...a, ctr: a.impressions ? a.linkClicks / a.impressions : null }))
    const dir = sort.desc ? -1 : 1
    return list.sort((a, b) => {
      const x = a[sort.id]
      const y = b[sort.id]
      if (x == null && y == null) return 0
      if (x == null) return 1
      if (y == null) return -1
      return (typeof x === 'string' ? x.localeCompare(y, undefined, { numeric: true }) : x - y) * dir
    })
  }, [data, adsetId, sort])

  const cell = (a, id) => {
    if (id === 'spend' || id === 'costPerResult') return money(a[id])
    if (id === 'ctr') return pct(a.linkClicks, a.impressions)
    if (id === 'status') return statusLabel(a.status)
    if (id === 'name') return a.name
    return count(a[id])
  }

  const c = data?.campaign
  const tiles = c && [
    ['Spent', money(c.spend)],
    ['Results', count(c.results)],
    ['Cost / result', money(c.costPerResult)],
    ['Impressions', count(c.impressions)],
    ['Reach', count(c.reach)],
    ['Link clicks', count(c.linkClicks)],
  ]

  return (
    <section className="mt-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold">Results</h3>
        <div className="flex items-center gap-3">
          <label htmlFor="results-period" className="sr-only">Period</label>
          <select id="results-period" value={period} onChange={(e) => setPeriod(e.target.value)} className={`${fieldClass()} w-auto py-2`}>
            {resultPeriods.map((p) => <option key={p.id} value={p.id} className="bg-neutral-900">{p.label}</option>)}
          </select>
          <Button variant="secondary" onClick={() => setReload((n) => n + 1)} disabled={loading || !metaToken}>{loading ? 'Loading…' : 'Refresh'}</Button>
        </div>
      </div>

      {!metaToken && <Notice>Connect Meta above to see results.</Notice>}
      <Notice>{error}</Notice>

      {c && (
        <>
          <p className="mt-3 text-sm text-white/50">
            Campaign is <span className="text-white/80">{statusLabel(c.effective_status)}</span>
            {c.effective_status === 'PAUSED' && '. Nothing runs or spends until it is turned on in Ads Manager.'}
          </p>
          <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {tiles.map(([label, value]) => (
              <div key={label} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <dt className="text-xs text-white/50">{label}</dt>
                <dd className="mt-1 text-xl font-semibold tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>

          <h4 className="mt-6 text-sm font-semibold">Ad sets</h4>
          <ul className="mt-2 divide-y divide-white/5 rounded-xl border border-white/10 text-sm">
            {data.adsets.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{a.name}</span>
                  <span className="block text-white/40">
                    {statusLabel(a.effective_status)}
                    {a.daily_budget && ` · ${money(a.daily_budget / 100)}/day`}
                    {a.lifetime_budget && ` · ${money(a.lifetime_budget / 100)} lifetime`}
                  </span>
                </span>
                <span className="shrink-0 tabular-nums text-white/70">
                  {money(a.spend)} · {count(a.results)} results · {money(a.costPerResult)} each
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <h4 className="text-sm font-semibold">Ads ({ads.length})</h4>
            {data.adsets.length > 1 && (
              <>
                <label htmlFor="results-adset" className="sr-only">Ad set</label>
                <select id="results-adset" value={adsetId} onChange={(e) => setAdsetId(e.target.value)} className={`${fieldClass()} w-auto py-2`}>
                  <option value="all" className="bg-neutral-900">All ad sets</option>
                  {data.adsets.map((a) => <option key={a.id} value={a.id} className="bg-neutral-900">{a.name}</option>)}
                </select>
              </>
            )}
          </div>
          <div className="mt-2 max-h-[32rem] overflow-auto rounded-xl border border-white/10">
            <table className="w-full min-w-[56rem] text-left text-sm">
              <thead className="sticky top-0 bg-neutral-950/95 text-xs text-white/50">
                <tr>
                  {COLUMNS.map((col) => (
                    <th key={col.id} scope="col" className={`px-3 py-2 font-medium ${col.numeric ? 'text-right' : ''}`}>
                      <button
                        type="button"
                        className="hover:text-white"
                        onClick={() => setSort((s) => ({ id: col.id, desc: s.id === col.id ? !s.desc : col.numeric }))}
                      >
                        {col.label}{sort.id === col.id && (sort.desc ? ' ↓' : ' ↑')}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {ads.map((a) => (
                  <tr key={a.id} className="hover:bg-white/[0.03]">
                    {COLUMNS.map((col) => (
                      <td key={col.id} className={`px-3 py-2 ${col.numeric ? 'text-right tabular-nums' : ''} ${col.id === 'name' ? 'max-w-[16rem] truncate' : 'whitespace-nowrap text-white/70'}`}>
                        {cell(a, col.id)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-white/40">
            Results count what each ad set optimizes for. Meta can take a few hours to report recent activity.
          </p>
        </>
      )}
    </section>
  )
}
