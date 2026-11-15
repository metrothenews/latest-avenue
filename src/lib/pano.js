// The panorama renderer for /experience. No library: one WebGL canvas.
//
// How it works: the panorama (a full 360° x 180° "equirectangular" image) is wrapped around the
// inside of a sphere and looked at from the centre through a narrow lens. The graphics chip does
// the perspective, which is what makes turning feel like turning your head rather than sliding a
// picture. A frame is drawn only when something changes, so it costs nothing while you hold still.
//
// The image arrives in pieces (see scripts/pano.mjs): a small preview of everything at once, then
// tiles for just the part in view, at the size this screen needs.
const BASE = '/pano/'
const GRID = 24 // each tile is drawn as GRID x GRID flat pieces, enough to look curved
const MAX_TILES = 12 // sharp tiles kept on the graphics chip at once
const LOADS = 4 // downloads at a time
const AHEAD = 0.3 // radians to each side of the view that are fetched early

const VERTEX = `
attribute vec2 a;
uniform vec4 uArea;   // lon0, lonSpan, latTop, latSpan (radians)
uniform vec4 uUv;     // u0, v0, uSpan, vSpan
uniform vec3 uView;   // yaw, pitch, roll
uniform vec2 uLens;   // 1 / tan(half field of view): across, up
varying vec2 vUv;
void main() {
  float lon = uArea.x + a.x * uArea.y - uView.x;
  float lat = uArea.z - a.y * uArea.w;
  vec3 d = vec3(cos(lat) * sin(lon), sin(lat), cos(lat) * cos(lon));
  float c = cos(uView.y), s = sin(uView.y);
  d = vec3(d.x, d.y * c - d.z * s, d.y * s + d.z * c);
  float rc = cos(uView.z), rs = sin(uView.z);
  d = vec3(d.x * rc - d.y * rs, d.x * rs + d.y * rc, d.z);
  vUv = uUv.xy + a * uUv.zw;
  gl_Position = vec4(d.x * uLens.x, d.y * uLens.y, d.z - 0.2, d.z);
}`
const FRAGMENT = `
precision mediump float;
uniform sampler2D uImage;
uniform float uGain; // brightness: 1 leaves the picture as it is
varying vec2 vUv;
void main() { gl_FragColor = vec4(texture2D(uImage, vUv).rgb * uGain, 1.0); }`

const TAU = Math.PI * 2
const wrap = (angle) => angle - TAU * Math.round(angle / TAU) // into -π..π

// Half the field of view (as a tangent) across and up, for a `focal` mm lens on a 36 x 24 frame
// turned the same way as the screen and cropped to fill it.
export function lens(width, height, focal, portraitFocal) {
  const aspect = width / height
  if (aspect >= 1) {
    const across = Math.min(18, 12 * aspect) / focal
    return { x: across, y: across / aspect }
  }
  const across = Math.min(12, 18 * aspect) / portraitFocal
  return { x: across, y: across / aspect }
}

async function loadImage(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url}: ${res.status}`)
  const blob = await res.blob()
  if (window.createImageBitmap) return createImageBitmap(blob) // decodes off the main thread
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = URL.createObjectURL(blob)
  })
}

// Starts the view on `canvas`. `settings` is data/experience.js. Calls onReady() once the first
// image is on screen and onError() if it can't start. Returns { view, sway, set(yaw, pitch), draw(),
// resize(), destroy() }; `view` is { yaw, pitch } in radians, with yaw growing as you turn right;
// `sway` is { yaw, pitch, roll } added on top when drawing (set it, then call draw()).
export function startPano(canvas, settings, { onReady = () => {}, onError = () => {} } = {}) {
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'high-performance' })
  if (!gl) return null

  const view = { yaw: (settings.startYaw * Math.PI) / 180, pitch: 0 }
  // Small extra movement on top of where the visitor is looking (the handheld feel): radians.
  const sway = { yaw: 0, pitch: 0, roll: 0 }
  const tiles = new Map() // "level/row_col" → { texture | null (loading), used }
  let manifest = null
  let preview = null
  let program, corners, uniforms
  let frame = 0
  let loading = 0
  let dead = false
  let tick = 0

  function build() {
    const shader = (type, source) => {
      const s = gl.createShader(type)
      gl.shaderSource(s, source)
      gl.compileShader(s)
      return s
    }
    program = gl.createProgram()
    gl.attachShader(program, shader(gl.VERTEX_SHADER, VERTEX))
    gl.attachShader(program, shader(gl.FRAGMENT_SHADER, FRAGMENT))
    gl.linkProgram(program)
    gl.useProgram(program)
    uniforms = Object.fromEntries(['uArea', 'uUv', 'uView', 'uLens', 'uGain'].map((name) => [name, gl.getUniformLocation(program, name)]))

    const points = []
    const at = (i, j) => points.push(i / GRID, j / GRID)
    for (let j = 0; j < GRID; j++) {
      for (let i = 0; i < GRID; i++) { at(i, j); at(i + 1, j); at(i, j + 1); at(i + 1, j); at(i + 1, j + 1); at(i, j + 1) }
    }
    corners = points.length / 2
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(points), gl.STATIC_DRAW)
    const a = gl.getAttribLocation(program, 'a')
    gl.enableVertexAttribArray(a)
    gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0)
    gl.disable(gl.DEPTH_TEST)
    gl.clearColor(0, 0, 0, 1)
  }

  function texture(image) {
    const t = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, t)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    image.close?.()
    return t
  }

  const rad = Math.PI / 180
  const limits = () => (settings.lookUpDown ? [settings.maxUp * rad, settings.maxDown * rad] : [0, 0])
  // Brightness for where we're looking: up to `brighterUp` more at the top limit, `darkerDown`
  // less at the bottom limit, and in proportion in between.
  function exposure() {
    const [up, down] = limits()
    if (view.pitch > 0 && up) return 1 + settings.brighterUp * (view.pitch / up)
    if (view.pitch < 0 && down) return 1 - settings.darkerDown * (-view.pitch / down)
    return 1
  }

  const field = () => lens(canvas.width, canvas.height, settings.focalLength, settings.portraitFocalLength)

  // The smallest size that is still as sharp as this screen can show (or the biggest there is).
  function pickLevel(f) {
    const needed = (canvas.width / (2 * f.x)) * TAU * 0.8 // panorama width, in px, for 1:1 at the centre
    return manifest.levels.find((l) => l.width >= needed) ?? manifest.levels[manifest.levels.length - 1]
  }

  // The tiles of `level` that touch the view, widened by `margin` radians: [{ key, url, area, off }].
  function tilesInView(level, f, margin) {
    const halfUp = Math.atan(f.y) + margin / 2
    // Looking up or down, the top or bottom of the frame takes in more of the circle.
    const steepest = Math.min(1.45, Math.abs(view.pitch) + halfUp)
    const halfAcross = Math.atan(f.x / Math.cos(steepest)) + margin
    const tileLon = (manifest.tile / level.width) * TAU
    const tileLat = (manifest.tile / level.height) * Math.PI
    const found = []
    for (let row = 0; row < level.rows; row++) {
      const top = Math.PI / 2 - row * tileLat
      const latSpan = Math.min(tileLat, top + Math.PI / 2)
      if (top < view.pitch - halfUp || top - latSpan > view.pitch + halfUp) continue
      for (let col = 0; col < level.cols; col++) {
        const lon0 = -Math.PI + col * tileLon
        const lonSpan = Math.min(tileLon, Math.PI - lon0)
        const off = Math.abs(wrap(lon0 + lonSpan / 2 - view.yaw)) // how far its middle is from where we look
        if (off > halfAcross + lonSpan / 2) continue
        found.push({ key: `${level.width}/${row}_${col}`, url: `${BASE}${level.width}/${row}_${col}.webp?v=${manifest.version}`, area: [lon0, lonSpan, top, latSpan], off })
      }
    }
    return found.sort((p, q) => p.off - q.off)
  }

  function fetchTile(tile) {
    if (tiles.has(tile.key) || loading >= LOADS) return
    tiles.set(tile.key, { texture: null, used: tick })
    loading++
    loadImage(tile.url).then(
      (image) => {
        loading--
        if (dead || gl.isContextLost() || !tiles.has(tile.key)) return image.close?.()
        tiles.get(tile.key).texture = texture(image)
        draw()
      },
      () => { loading--; tiles.delete(tile.key) }, // try again the next time it's in view
    )
  }

  function trim() {
    if (tiles.size <= MAX_TILES) return
    const oldest = [...tiles].filter(([, t]) => t.texture).sort((p, q) => p[1].used - q[1].used)
    for (const [key, t] of oldest.slice(0, tiles.size - MAX_TILES)) {
      gl.deleteTexture(t.texture)
      tiles.delete(key)
    }
  }

  function paint(tex, area, uv) {
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.uniform4fv(uniforms.uArea, area)
    gl.uniform4fv(uniforms.uUv, uv)
    gl.drawArrays(gl.TRIANGLES, 0, corners)
  }

  function render() {
    frame = 0
    if (dead || !preview || gl.isContextLost()) return
    tick++
    const f = field()
    gl.viewport(0, 0, canvas.width, canvas.height)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.uniform3f(uniforms.uView, view.yaw + sway.yaw, view.pitch + sway.pitch, sway.roll)
    gl.uniform2f(uniforms.uLens, 1 / f.x, 1 / f.y)
    gl.uniform1f(uniforms.uGain, exposure())

    // The preview, everywhere, in eight slices; then every sharp tile that has arrived, on top.
    for (let i = 0; i < 8; i++) paint(preview, [-Math.PI + (i * TAU) / 8, TAU / 8, Math.PI / 2, Math.PI], [i / 8, 0, 1 / 8, 1])
    if (manifest.levels.length) {
      const level = pickLevel(f)
      for (const tile of tilesInView(level, f, 0.06)) { // a little extra for the sway and roll
        const loaded = tiles.get(tile.key)
        if (!loaded?.texture) continue
        loaded.used = tick
        paint(loaded.texture, tile.area, [0, 0, 1, 1])
      }
      for (const tile of tilesInView(level, f, AHEAD)) fetchTile(tile)
      trim()
    }
  }

  function draw() {
    if (!frame) frame = requestAnimationFrame(render)
  }

  function resize() {
    const scale = Math.min(window.devicePixelRatio || 1, 2)
    const width = Math.max(1, Math.round(canvas.clientWidth * scale))
    const height = Math.max(1, Math.round(canvas.clientHeight * scale))
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height }
    draw()
  }

  async function load() {
    const res = await fetch(`${BASE}manifest.json`, { cache: 'no-cache' })
    if (!res.ok) throw new Error(`manifest: ${res.status}`)
    manifest = await res.json()
    const image = await loadImage(`${BASE}preview.webp?v=${manifest.version}`)
    if (dead) return
    preview = texture(image)
    resize()
    onReady()
  }

  // A phone can take the graphics context away (e.g. when the tab is in the background).
  const lost = (e) => { e.preventDefault(); cancelAnimationFrame(frame); frame = 0 }
  const restored = () => { tiles.clear(); preview = null; build(); load().catch(onError) }
  canvas.addEventListener('webglcontextlost', lost)
  canvas.addEventListener('webglcontextrestored', restored)

  build()
  load().catch(onError)

  return {
    view,
    sway,
    field,
    limits,
    exposure,
    set(yaw, pitch = view.pitch) {
      const [up, down] = limits()
      view.yaw = wrap(yaw)
      view.pitch = Math.max(-down, Math.min(up, pitch))
      draw()
    },
    draw,
    resize,
    destroy() {
      dead = true
      cancelAnimationFrame(frame)
      canvas.removeEventListener('webglcontextlost', lost)
      canvas.removeEventListener('webglcontextrestored', restored)
      // Free the images but keep the context: the same canvas may be started again.
      for (const t of tiles.values()) if (t.texture) gl.deleteTexture(t.texture)
      if (preview) gl.deleteTexture(preview)
      tiles.clear()
    },
  }
}
