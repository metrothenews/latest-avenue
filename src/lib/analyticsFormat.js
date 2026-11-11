// Number formatting for /analytics. `format` is a metric's format from data/analytics.js.

const cache = new Map()
function formatter(key, options) {
  if (!cache.has(key)) cache.set(key, new Intl.NumberFormat(undefined, options))
  return cache.get(key)
}

function money(value, currency, short) {
  try {
    const opts = short && Math.abs(value) >= 10000
      ? { style: 'currency', currency, notation: 'compact', maximumFractionDigits: 1 }
      : { style: 'currency', currency }
    return formatter(`money-${currency}-${short}-${Math.abs(value) >= 10000}`, opts).format(value)
  } catch {
    return `${value.toFixed(2)} ${currency}`
  }
}

// Full value, e.g. "$1,234.56", "12,345", "1.84%". null shows as "–".
export function formatValue(value, format, currency, { short = false } = {}) {
  if (value == null || Number.isNaN(value)) return '–'
  if (format === 'money') return money(value, currency, short)
  if (format === 'percent') return `${formatter('pct', { maximumFractionDigits: 2 }).format(value)}%`
  if (short && Math.abs(value) >= 10000) return formatter('compact', { notation: 'compact', maximumFractionDigits: 1 }).format(value)
  return formatter('count', { maximumFractionDigits: 0 }).format(value)
}

// "Nov 3"
export const shortDay = (date) => date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
// "Mon, Nov 3, 2026"
export const longDay = (date) => date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
