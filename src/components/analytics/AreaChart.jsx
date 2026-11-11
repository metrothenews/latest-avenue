import { useEffect, useId, useRef, useState } from 'react'
import { longDay, shortDay } from '../../lib/analyticsFormat.js'

// Chart colours: one muted blue-violet line with a fading wash under it, matching the site's glow.
const LINE = '#8f8cf7'
const MARGIN = { top: 12, right: 12, bottom: 26, left: 64 }

// A "nice" upper bound and 3–4 evenly spaced ticks from 0 to it.
function ticksFor(max) {
  if (!(max > 0)) return [0, 1]
  const raw = max / 3
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw)
  const top = Math.ceil(max / step) * step
  const ticks = []
  for (let v = 0; v <= top + step / 2; v += step) ticks.push(+v.toPrecision(12))
  return ticks
}

// Smooth line through the points that never overshoots them (monotone cubic, Fritsch–Carlson),
// so a curve never dips below zero or peaks above a real value.
function smoothPath(pts) {
  const n = pts.length
  if (n === 1) return `M${pts[0][0]},${pts[0][1]}`
  const d = []
  for (let i = 0; i < n - 1; i++) d.push((pts[i + 1][1] - pts[i][1]) / (pts[i + 1][0] - pts[i][0]))
  const m = pts.map((_, i) => (i === 0 ? d[0] : i === n - 1 ? d[n - 2] : d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2))
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue }
    const a = m[i] / d[i]
    const b = m[i + 1] / d[i]
    const s = a * a + b * b
    if (s > 9) { const t = 3 / Math.sqrt(s); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i] }
  }
  let path = `M${pts[0][0]},${pts[0][1]}`
  for (let i = 0; i < n - 1; i++) {
    const h = (pts[i + 1][0] - pts[i][0]) / 3
    path += `C${pts[i][0] + h},${pts[i][1] + m[i] * h} ${pts[i + 1][0] - h},${pts[i + 1][1] - m[i + 1] * h} ${pts[i + 1][0]},${pts[i + 1][1]}`
  }
  return path
}

// One metric over time. `points`: [{ date, value }] (value may be null for an undefined ratio).
// `format(value, { short })` turns a value into text. Hover, touch or arrow keys show a day's value.
export default function AreaChart({ points, label, format, height = 300, compact = false }) {
  const box = useRef(null)
  const [width, setWidth] = useState(0)
  const [active, setActive] = useState(null)
  const gradient = useId()

  useEffect(() => {
    const el = box.current
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const margin = compact ? { ...MARGIN, left: 52 } : MARGIN
  const plotW = Math.max(0, width - margin.left - margin.right)
  const plotH = height - margin.top - margin.bottom
  const values = points.map((p) => p.value ?? 0)
  const ticks = ticksFor(Math.max(...values, 0))
  const top = ticks[ticks.length - 1] || 1
  const x = (i) => margin.left + (points.length === 1 ? plotW / 2 : (i / (points.length - 1)) * plotW)
  const y = (v) => margin.top + plotH - (v / top) * plotH
  const pts = points.map((p, i) => [x(i), y(p.value ?? 0)])
  const line = width && points.length ? smoothPath(pts) : ''
  const base = margin.top + plotH
  const area = line && points.length > 1 ? `${line}L${pts[pts.length - 1][0]},${base}L${pts[0][0]},${base}Z` : ''

  // A handful of date labels along the bottom, never crowded.
  const labelEvery = Math.max(1, Math.ceil(points.length / Math.max(2, Math.floor(plotW / 84))))
  const dateTicks = points.map((p, i) => i).filter((i) => i % labelEvery === 0)

  function pick(clientX) {
    const rect = box.current.getBoundingClientRect()
    const rel = (clientX - rect.left - margin.left) / (plotW || 1)
    setActive(Math.min(points.length - 1, Math.max(0, Math.round(rel * (points.length - 1)))))
  }

  function onKeyDown(e) {
    const step = { ArrowRight: 1, ArrowLeft: -1, Home: -Infinity, End: Infinity }[e.key]
    if (step === undefined) return
    e.preventDefault()
    setActive((i) => Math.min(points.length - 1, Math.max(0, (i ?? (step > 0 ? -1 : points.length)) + step)))
  }

  const hover = active != null && points[active]
  const tipLeft = hover ? Math.min(Math.max(pts[active][0], 70), width - 70) : 0

  return (
    <div ref={box} className="relative select-none" style={{ height }}>
      {width > 0 && (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={`${label}, one value per day. Focus the chart and use the arrow keys to read each day.`}
          tabIndex={0}
          onKeyDown={onKeyDown}
          onPointerMove={(e) => pick(e.clientX)}
          onPointerDown={(e) => pick(e.clientX)}
          onPointerLeave={(e) => e.pointerType === 'mouse' && setActive(null)}
          onBlur={() => setActive(null)}
          className="block touch-pan-y rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
        >
          <defs>
            <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={LINE} stopOpacity="0.28" />
              <stop offset="100%" stopColor={LINE} stopOpacity="0" />
            </linearGradient>
          </defs>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={margin.left} x2={margin.left + plotW} y1={y(t)} y2={y(t)} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
              <text x={margin.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-white/40 text-[11px]">{format(t, { short: true })}</text>
            </g>
          ))}
          {dateTicks.map((i) => (
            <text key={i} x={x(i)} y={height - 6} textAnchor={points.length === 1 ? 'middle' : i === 0 ? 'start' : i === points.length - 1 || x(i) > width - 30 ? 'end' : 'middle'} className="fill-white/40 text-[11px]">
              {shortDay(points[i].date)}
            </text>
          ))}
          {area && <path d={area} fill={`url(#${gradient})`} />}
          {line && <path d={line} fill="none" stroke={LINE} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />}
          {points.length === 1 && <circle cx={pts[0][0]} cy={pts[0][1]} r="4" fill={LINE} />}
          {hover && (
            <g pointerEvents="none">
              <line x1={pts[active][0]} x2={pts[active][0]} y1={margin.top} y2={base} stroke="rgba(255,255,255,0.35)" strokeWidth="1" />
              <circle cx={pts[active][0]} cy={pts[active][1]} r="5" fill={LINE} stroke="#0a0a0a" strokeWidth="2" />
            </g>
          )}
        </svg>
      )}
      {hover && (
        <div
          className="pointer-events-none absolute top-0 -translate-x-1/2 whitespace-nowrap rounded-lg border border-white/15 bg-black/80 px-3 py-2 text-xs backdrop-blur-md"
          style={{ left: tipLeft }}
          role="status"
        >
          <p className="text-sm font-semibold text-white">{format(points[active].value)}</p>
          <p className="text-white/60">{longDay(points[active].date)}</p>
        </div>
      )}
    </div>
  )
}
