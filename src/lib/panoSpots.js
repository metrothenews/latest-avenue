// Places in the panorama, measured in its pixels, turned into angles the viewer can use.
// A rect is { left, right, top, bottom } on the panorama at `width` px wide (it may run past the
// right edge to wrap around the seam).
const TAU = Math.PI * 2
const lonOf = (x, width) => (x / width - 0.5) * TAU
const latOf = (y, width) => (0.5 - y / (width / 2)) * Math.PI

// The middle of a rect and half its size: { lon, lat, halfLon, halfLat } in radians.
export function centre(rect, width) {
  const [l, r, t, b] = [lonOf(rect.left, width), lonOf(rect.right, width), latOf(rect.top, width), latOf(rect.bottom, width)]
  return { lon: (l + r) / 2, lat: (t + b) / 2, halfLon: (r - l) / 2, halfLat: (t - b) / 2 }
}

// The biggest area of the given shape (width / height, e.g. 4 / 3) that fits inside a rect,
// centred, as the renderer wants it: [lon0, lonSpan, latTop, latSpan].
export function fit(rect, width, ratio) {
  const [w, h] = [rect.right - rect.left, rect.bottom - rect.top]
  const inner = w / h > ratio ? { w: h * ratio, h } : { w, h: w / ratio }
  const [x, y] = [rect.left + (w - inner.w) / 2, rect.top + (h - inner.h) / 2]
  return [lonOf(x, width), (inner.w / width) * TAU, latOf(y, width), (inner.h / (width / 2)) * Math.PI]
}

// Points around a rect with rounded corners: [[lon, lat], ...], for drawing its outline.
export function outline(rect, width, radius) {
  const points = []
  const corner = (cx, cy, from) => {
    for (let i = 0; i <= 6; i++) {
      const a = from + (i / 6) * (Math.PI / 2)
      points.push([lonOf(cx + Math.cos(a) * radius, width), latOf(cy + Math.sin(a) * radius, width)])
    }
  }
  corner(rect.right - radius, rect.top + radius, -Math.PI / 2)
  corner(rect.right - radius, rect.bottom - radius, 0)
  corner(rect.left + radius, rect.bottom - radius, Math.PI / 2)
  corner(rect.left + radius, rect.top + radius, Math.PI)
  return points
}
