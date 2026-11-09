import { useEffect, useState } from 'react'
import { fieldClass } from '../ui/fieldStyles.js'
import { adsetPixel, conversionLabel, pixelEventOption } from '../../lib/meta.js'
import { knownPixelEvents } from '../../data/meta.js'
import { loadPixelEvents } from '../../lib/campaignRuns.js'
import { shortDate } from '../../lib/drive.js'

const promotedOf = (a) => a.promotedObject ?? a.promoted_object
const fired = (o) => (o.count === undefined ? '' : o.count ? ` · ${o.count.toLocaleString()} in 30 days` : ' · not fired lately')
const option = (o) => <option key={o.key} value={o.key} className="bg-neutral-900">{o.label}{fired(o)}</option>

// Dropdown of conversion events for the copied ad sets: the template's own, or one of the Feature.fm
// events (knownPixelEvents in data/meta.js), each with how often the template's pixel fired it (the
// pixel's counts are saved in Firestore and fetched from Meta again after 30 days, or with Refresh).
// Renders nothing when no template ad set optimizes for a website conversion.
// onChange(option | null), null meaning "same as template".
export default function ConversionSelect({ id, adsets, token, accountId, value, onChange, disabled }) {
  const [events, setEvents] = useState(null) // null while loading
  const [fetchedAt, setFetchedAt] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const [loadError, setLoadError] = useState('')
  const pixels = [...new Set(adsets.map(adsetPixel).filter(Boolean))]
  // The events only fit when every ad set uses the same pixel.
  const pixel = pixels.length === 1 ? pixels[0] : null

  useEffect(() => {
    if (!pixel) return
    let stop = false
    setLoadError('')
    loadPixelEvents(token, pixel)
      .then((saved) => {
        if (stop) return
        setEvents(saved.events)
        setFetchedAt(saved.fetchedAt)
      })
      .catch((err) => {
        if (stop) return
        setEvents([])
        setLoadError(err.message)
      })
    return () => {
      stop = true
    }
  }, [token, pixel])

  async function refresh() {
    setRefreshing(true)
    setLoadError('')
    try {
      const saved = await loadPixelEvents(token, pixel, { refresh: true })
      setEvents(saved.events)
      setFetchedAt(saved.fetchedAt)
    } catch (err) {
      setLoadError(err.message)
    } finally {
      setRefreshing(false)
    }
  }

  if (!pixels.length) return null

  // The Feature.fm events, with the pixel's counts once loaded. A saved choice stays listed even if
  // it isn't one of them.
  const counts = new Map((events ?? []).map((e) => [e.name, e.count]))
  const options = knownPixelEvents.map((name) => pixelEventOption(name, events ? counts.get(name) ?? 0 : undefined))
  if (value && !options.some((o) => o.key === value.key)) options.unshift({ ...value, count: undefined })
  const labels = [...new Set(adsets.filter(adsetPixel).map((a) => conversionLabel(promotedOf(a))))]
  const templateLabel = labels.length === 1 ? labels[0] : 'differs by ad set'

  let note = ''
  if (!pixel) note = 'The template’s ad sets use different pixels, so only their own events can be kept.'

  return (
    <>
      <select
        id={id}
        value={value?.key ?? ''}
        onChange={(e) => onChange(options.find((o) => o.key === e.target.value) ?? null)}
        className={fieldClass()}
        disabled={disabled}
      >
        <option value="" className="bg-neutral-900">Same as template ({templateLabel})</option>
        {pixel && options.map(option)}
      </select>
      {loadError && <p className="mt-1.5 text-sm text-red-300/90">Couldn't load how often the pixel fired each event: {loadError}</p>}
      {note && <p className="mt-1.5 text-sm text-white/40">{note}</p>}
      {pixel && fetchedAt && (
        <p className="mt-1.5 text-sm text-white/40">
          Event counts from the 30 days before {shortDate(fetchedAt)}, updated every 30 days.{' '}
          {token && (
            <button type="button" onClick={refresh} disabled={disabled || refreshing} className="text-white/60 underline-offset-2 hover:text-white hover:underline disabled:opacity-50">
              {refreshing ? 'Refreshing…' : 'Refresh now'}
            </button>
          )}
        </p>
      )}
    </>
  )
}
