// Great-circle helpers for the /global game. Points are { lat, lon } in degrees.
const rad = (deg) => (deg * Math.PI) / 180
const ARROWS = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖']
const COMPASS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west']

// Distance in whole kilometres.
export function distanceKm(a, b) {
  const dLat = rad(b.lat - a.lat)
  const dLon = rad(b.lon - a.lon)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2
  return Math.round(6371 * 2 * Math.asin(Math.sqrt(h)))
}

// Direction to travel from `a` to reach `b`: { arrow, label }.
export function direction(a, b) {
  const dLon = rad(b.lon - a.lon)
  const y = Math.sin(dLon) * Math.cos(rad(b.lat))
  const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(dLon)
  const i = Math.round(((Math.atan2(y, x) * 180) / Math.PI + 360) / 45) % 8
  return { arrow: ARROWS[i], label: COMPASS[i] }
}

// Lowercase, accents and punctuation removed, so "cote d ivoire" matches "Côte d'Ivoire".
export const normalizeName = (name) =>
  name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]+/g, ' ').trim()
