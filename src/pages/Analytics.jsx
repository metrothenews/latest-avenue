import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import MetaConnect from '../components/meta/MetaConnect.jsx'
import AreaChart from '../components/analytics/AreaChart.jsx'
import { fieldClass } from '../components/ui/fieldStyles.js'
import { listAdAccounts, adsManagerUrl } from '../lib/meta.js'
import { clearMetaToken, getMetaToken } from '../lib/metaAuth.js'
import { getCampaign, getCampaignRows, getOverview } from '../lib/metaAnalytics.js'
import { formatValue } from '../lib/analyticsFormat.js'
import { analytics as copy, defaultMetric, defaultRange, metrics, ranges } from '../data/analytics.js'

// Shared with /admin/campaigns, so both pages open on the same ad account.
const ACCOUNT_KEY = 'meta-account'
const RANGE_KEY = 'analytics-range'

const remembered = (key, fallback) => {
  try {
    return localStorage.getItem(key) ?? fallback
  } catch {
    return fallback
  }
}
const remember = (key, value) => {
  try {
    localStorage.setItem(key, value)
  } catch {
    // storage unavailable: the choice just isn't remembered
  }
}

const selectClass = `${fieldClass(false)} !w-auto !py-2 pr-8`

// /analytics (owner only): Meta Ads totals, a chart of one metric per day, and the top campaigns.
// ?campaign=<id> shows one campaign; ?metric= and the date range apply to both views.
export default function Analytics() {
  const [params, setParams] = useSearchParams()
  const [token, setToken] = useState(getMetaToken)
  const [expired, setExpired] = useState(false)
  const [accounts, setAccounts] = useState(null)
  const [accountId, setAccountId] = useState(() => remembered(ACCOUNT_KEY, ''))
  const [range, setRange] = useState(() => {
    const saved = remembered(RANGE_KEY, defaultRange)
    return ranges.some((r) => r.id === saved) ? saved : defaultRange
  })
  const [overview, setOverview] = useState(null) // { key, totals, days, campaigns }
  const [detail, setDetail] = useState(null) // { key, campaign, totals, days }
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const campaignId = params.get('campaign')
  const metric = metrics.find((m) => m.key === params.get('metric')) ?? metrics.find((m) => m.key === defaultMetric)
  const account = accounts?.find((a) => a.id === accountId)
  const currency = account?.currency ?? 'USD'
  const fmt = (m) => (value, opts) => formatValue(value, m.format, currency, opts)

  function setParam(key, value) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next)
  }

  function fail(err) {
    if (err.kind === 'auth') {
      clearMetaToken()
      setToken(null)
      setExpired(true)
    } else {
      setError(`${copy.loadFailed}: ${err.message}`)
    }
  }

  // Ad accounts, once connected. Keeps the remembered one if it's still there.
  useEffect(() => {
    if (!token) return
    let current = true
    listAdAccounts(token).then((list) => {
      if (!current) return
      setAccounts(list)
      setAccountId((id) => (list.some((a) => a.id === id) ? id : list[0]?.id ?? ''))
    }, (err) => current && fail(err))
    return () => { current = false }
  }, [token]) // eslint-disable-line react-hooks/exhaustive-deps

  // The account overview, or one campaign. The previous numbers stay on screen (dimmed) while
  // new ones load, so the page doesn't jump.
  const key = `${accountId}|${range}|${campaignId ?? ''}`
  useEffect(() => {
    if (!token || !accountId) return
    let current = true
    setLoading(true)
    setError('')
    const load = campaignId
      ? Promise.all([getCampaign(token, campaignId), getOverview(token, campaignId, range)])
        .then(([campaign, data]) => current && setDetail({ key, campaign, ...data }))
      : Promise.all([getOverview(token, accountId, range), getCampaignRows(token, accountId, range)])
        .then(([data, campaigns]) => current && setOverview({ key, ...data, campaigns }))
    load.catch((err) => current && fail(err)).finally(() => current && setLoading(false))
    return () => { current = false }
  }, [token, key]) // eslint-disable-line react-hooks/exhaustive-deps

  const view = campaignId ? detail : overview
  const stale = loading || (view && view.key !== key)

  const topCampaigns = useMemo(() => {
    if (!overview?.campaigns) return []
    const value = (c) => c[metric.key]
    // Undefined ratios (no clicks yet) go last; lower is better for costs.
    return [...overview.campaigns].sort((a, b) => {
      if (value(a) == null) return 1
      if (value(b) == null) return -1
      return metric.better === 'low' ? value(a) - value(b) : value(b) - value(a)
    })
  }, [overview, metric])

  if (!token) {
    return (
      <div className="max-w-xl">
        <h1 className="text-4xl font-extrabold tracking-tight">{copy.title}</h1>
        <p className="mt-3 text-white/60">{copy.intro}</p>
        <section className="glass mt-10 p-6">
          <h2 className="mb-4 text-lg font-semibold">{copy.connectTitle}</h2>
          <MetaConnect
            expired={expired}
            returnTo="/analytics"
            onConnect={({ token: t }) => { setExpired(false); setToken(t) }}
          />
        </section>
      </div>
    )
  }

  const points = view?.days.map((d) => ({ date: d.date, value: d[metric.key] })) ?? []

  return (
    <div>
      {campaignId ? (
        <div className="flex items-center gap-3">
          <Link to={`/analytics${metric.key !== defaultMetric ? `?metric=${metric.key}` : ''}`} aria-label={copy.back} className="glass flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white/70 hover:text-white">‹</Link>
          <h1 className="min-w-0 truncate text-3xl font-extrabold tracking-tight md:text-4xl">{detail?.campaign?.name ?? '…'}</h1>
        </div>
      ) : (
        <>
          <h1 className="text-4xl font-extrabold tracking-tight">{copy.title}</h1>
          <p className="mt-3 text-white/60">{copy.intro}</p>
        </>
      )}

      {/* Filters: one row above everything they apply to. */}
      <div className="mt-8 flex flex-wrap items-end gap-3">
        {!campaignId && accounts?.length > 1 && (
          <label className="text-xs text-white/50">
            <span className="mb-1 block">{copy.accountLabel}</span>
            <select className={selectClass} value={accountId} onChange={(e) => { setAccountId(e.target.value); remember(ACCOUNT_KEY, e.target.value) }}>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </label>
        )}
        <label className="text-xs text-white/50">
          <span className="mb-1 block">{copy.rangeLabel}</span>
          <select className={selectClass} value={range} onChange={(e) => { setRange(e.target.value); remember(RANGE_KEY, e.target.value) }}>
            {ranges.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
        </label>
        {stale && view && <span className="pb-2 text-xs text-white/40" role="status">{copy.updating}</span>}
      </div>

      {accounts?.length === 0 && <p className="mt-8 text-white/60">{copy.noAccounts}</p>}
      {error && <p className="mt-6 text-sm text-red-300/90" role="alert">{error}</p>}
      {!view && !error && accounts?.length !== 0 && <p className="mt-8 text-sm text-white/50">Loading…</p>}

      {view && (
        <div className={stale ? 'opacity-60' : ''}>
          {/* Totals: each one also picks the chart's metric. */}
          <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            {metrics.map((m) => {
              const on = m.key === metric.key
              return (
                <li key={m.key}>
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() => setParam('metric', m.key === defaultMetric ? null : m.key)}
                    className={`glass h-full w-full p-4 text-left hover:border-white/30 ${on ? 'border-white/30 bg-white/10' : ''}`}
                  >
                    <span className="block text-xs text-white/50">{m.short ?? m.label}</span>
                    <span className="mt-1 block text-xl font-semibold tabular-nums">{fmt(m)(view.totals[m.key])}</span>
                  </button>
                </li>
              )
            })}
          </ul>

          <section className="glass mt-6 p-4 md:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="text-xs text-white/50">
                <span className="sr-only">{copy.metricLabel}</span>
                <select className={selectClass} value={metric.key} onChange={(e) => setParam('metric', e.target.value === defaultMetric ? null : e.target.value)}>
                  {metrics.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
                </select>
              </label>
              <p className="text-sm text-white/50">{ranges.find((r) => r.id === range).label}</p>
            </div>
            <div className="mt-4">
              {points.length ? <AreaChart points={points} label={metric.label} format={fmt(metric)} /> : <p className="py-16 text-center text-sm text-white/50">{copy.noData}</p>}
            </div>
            {points.length > 0 && (
              <details className="mt-4 text-sm">
                <summary className="cursor-pointer text-white/50 hover:text-white">{copy.tableToggle}</summary>
                <div className="mt-3 max-h-80 overflow-y-auto">
                  <table className="w-full text-left tabular-nums">
                    <thead className="text-xs text-white/50"><tr><th className="py-1 font-normal">Day</th><th className="py-1 text-right font-normal">{metric.label}</th></tr></thead>
                    <tbody>
                      {points.map((p) => (
                        <tr key={p.date.toISOString()} className="border-t border-white/5">
                          <td className="py-1.5 text-white/70">{p.date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</td>
                          <td className="py-1.5 text-right">{fmt(metric)(p.value)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            )}
          </section>

          {campaignId && detail?.campaign && account && (
            <p className="mt-6 text-sm">
              <a href={adsManagerUrl(account.id, campaignId)} target="_blank" rel="noreferrer" className="text-white/60 underline hover:text-white">{copy.openInAdsManager}</a>
            </p>
          )}

          {!campaignId && (
            <section className="mt-12">
              <h2 className="text-2xl font-bold tracking-tight md:text-3xl">{copy.topTitle}</h2>
              <p className="mt-2 text-sm text-white/50">{copy.topNote} {metric.label.toLowerCase()}.</p>
              {topCampaigns.length === 0 && <p className="mt-6 text-sm text-white/50">{copy.noCampaigns}</p>}
              <ol className="mt-6 space-y-3">
                {topCampaigns.map((c) => (
                  <li key={c.id}>
                    <Link
                      to={`/analytics?campaign=${c.id}${metric.key !== defaultMetric ? `&metric=${metric.key}` : ''}`}
                      className="glass flex items-center justify-between gap-4 px-4 py-3 hover:border-white/30 hover:bg-white/5 md:px-5"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">{c.name}</span>
                        {metric.key !== 'spend' && <span className="block text-xs text-white/50">{fmt(metrics[0])(c.spend)} spent</span>}
                      </span>
                      <span className="shrink-0 text-sm tabular-nums">{fmt(metric)(c[metric.key])}</span>
                    </Link>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
