// Placeholder-aware number formatting: null/undefined shows as "[X]".

// 412345 -> "412.3K", 1200000 -> "1.2M"
export function compact(n) {
  if (n == null) return '[X]'
  if (n >= 1e6) return `${+(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `${+(n / 1e3).toFixed(1)}K`
  return String(n)
}

// 412345 -> "412,345"
export const num = (n) => (n == null ? '[X]' : n.toLocaleString())

// "Privacy Policy" -> "privacy-policy"
export const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
