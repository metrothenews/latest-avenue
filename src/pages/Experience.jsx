import { useEffect, useRef, useState } from 'react'
import Logo from '../components/layout/Logo.jsx'
import { startPano } from '../lib/pano.js'
import { centre, fit, outline } from '../lib/panoSpots.js'
import { openSlides } from '../lib/slides.js'
import { experience as copy } from '../data/experience.js'

const KEYS = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }

// /experience: stand in one spot of a 360° panorama and look around (lib/pano.js draws it).
// Drag, swipe, the left and right arrow keys or a sideways trackpad scroll turn the view; the up
// and down arrow keys look up and down, within limits; F is full screen.
// Looking at one of the computers outlines it and shows an "A" prompt; the space bar (or a tap
// on the prompt) closes in on its screen and shows a PDF there as slides: left and right arrow
// keys (or a swipe, or the buttons) change slide, the space bar or Esc pulls back out.
export default function Experience() {
  const frame = useRef(null)
  const canvas = useRef(null)
  const [state, setState] = useState('loading') // loading | ready | unsupported | failed
  const [moved, setMoved] = useState(false)
  const [full, setFull] = useState(false)
  const [locked, setLocked] = useState(false) // looking at a computer
  const [viewing, setViewing] = useState(false) // closed in on a screen, showing slides
  const [slide, setSlide] = useState({ page: 1, count: 0 })
  const ring = useRef(null) // the outline around the computer being looked at
  const prompt = useRef(null) // the "A" button beside it
  const actions = useRef({})
  const canFull = typeof document !== 'undefined' && Boolean(document.fullscreenEnabled || document.webkitFullscreenEnabled)

  function toggleFull() {
    const el = frame.current
    if (document.fullscreenElement || document.webkitFullscreenElement) (document.exitFullscreen ?? document.webkitExitFullscreen).call(document)
    else (el.requestFullscreen ?? el.webkitRequestFullscreen)?.call(el)
  }

  useEffect(() => {
    const el = canvas.current
    const pano = startPano(el, copy, { onReady: () => setState('ready'), onError: () => setState('failed') })
    if (!pano) return setState('unsupported')

    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let drag = null // { id, yaw, pitch, ax, ay } while a finger or the mouse is down
    let speed = 0 // radians per ms, sideways, carried on after letting go
    let last = null // { x, t } of the latest drag move
    let held = new Set() // arrow keys that are down
    let loop = 0
    let then = 0

    // The angle, from the middle of the view, of a point on the screen.
    const angles = (e) => {
      const box = el.getBoundingClientRect()
      const f = pano.field()
      return {
        x: Math.atan(((e.clientX - box.left) / box.width * 2 - 1) * f.x),
        y: Math.atan((1 - (e.clientY - box.top) / box.height * 2) * f.y),
      }
    }

    const hand = copy.handheld
    const rad = Math.PI / 180
    const pick = (most) => (Math.random() * 2 - 1) * most * rad
    let turn = 0 // radians per second, from the arrow keys (with momentum)
    let lift = 0 // the same, for looking up (+) and down (-)
    let roll = 0 // radians: the lean into a turn
    let rollSpeed = 0
    const drift = { at: 0, level: 0, now: [0, 0, 0], speed: [0, 0, 0], to: [0, 0, 0] } // the idle wander: pan, tilt, roll

    // Moves `value` towards `target` like a weight on a spring: no sudden starts or stops.
    // `time` is roughly how long it takes; `bounce` below 1 lets it overshoot a touch.
    function spring(value, speed, target, time, dt, bounce = 1) {
      const w = 2.4 / time
      speed += (w * w * (target - value) - 2 * bounce * w * speed) * dt
      return [value + speed * dt, speed]
    }

    function step(now) {
      const ms = Math.min(50, now - then)
      const dt = ms / 1000
      then = now
      let [dx, dy] = [0, 0]
      if (!show.on) for (const key of held) { dx += KEYS[key][0]; dy += KEYS[key][1] }

      if (calm) {
        // Reduced motion: a steady turn while a key is down, nothing else.
        const rate = copy.keySpeed * rad
        if (dx || dy) pano.set(pano.view.yaw + dx * rate * dt, pano.view.pitch + dy * rate * dt)
        scene(dt)
        pano.draw()
        loop = requestAnimationFrame(step)
        return
      }

      // Turning: ease up to full speed while a key is down, coast down after.
      const [slowest, fastest] = [hand.minSpeed * rad, hand.maxSpeed * rad]
      if (dx) {
        speed = 0
        turn += (dx * fastest - turn) * (1 - Math.exp(-dt / hand.speedUp))
        if (turn * dx >= 0 && Math.abs(turn) < slowest) turn = dx * slowest
      } else {
        turn *= Math.exp(-dt / hand.slowDown)
        if (Math.abs(turn) < slowest / 12) turn = 0
      }
      // Looking up and down works the same way, and eases to a stop as it nears its limits.
      const [up, down] = pano.limits()
      const highest = Math.min(fastest, copy.maxTiltSpeed * rad)
      if (dy && (up || down)) {
        lift += (dy * highest - lift) * (1 - Math.exp(-dt / hand.speedUp))
        if (lift * dy >= 0 && Math.abs(lift) < slowest) lift = dy * slowest
      } else {
        lift *= Math.exp(-dt / hand.slowDown)
        if (Math.abs(lift) < slowest / 12) lift = 0
      }
      const room = lift > 0 ? up - pano.view.pitch : pano.view.pitch + down
      lift = Math.sign(lift) * Math.min(Math.abs(lift), Math.max(0, room) / 0.28)
      let yaw = pano.view.yaw + turn * dt
      if (!drag && !dx && Math.abs(speed) > 0.00002) { yaw += speed * ms; speed *= Math.exp(-ms / 320) } // the coast after a swipe
      else if (!drag) speed = 0
      if (show.on) { turn = 0; lift = 0; speed = 0 }
      else if (!drag) pano.set(yaw, pano.view.pitch + lift * dt)
      else if (lift) pano.set(pano.view.yaw, pano.view.pitch + lift * dt)

      // The lean follows the turning speed, and straightens when it stops.
      ;[roll, rollSpeed] = spring(roll, rollSpeed, (turn / fastest) * hand.maxRoll * rad, hand.rollTime, dt, 0.8)

      // The idle wander: now and then pick new tiny offsets and drift towards them. It fades
      // down while the view is being moved and comes back once it's still.
      const idle = hand.idle
      if (now >= drift.at) {
        drift.to = [pick(idle.pan), pick(idle.tilt), pick(idle.roll)]
        drift.at = now + (idle.every[0] + Math.random() * (idle.every[1] - idle.every[0])) * 1000
      }
      for (let i = 0; i < 3; i++) [drift.now[i], drift.speed[i]] = spring(drift.now[i], drift.speed[i], drift.to[i], idle.ease, dt)
      const moving = Boolean(dx || dy || drag || turn || lift || speed)
      drift.level += ((moving ? idle.whileMoving : 1) - drift.level) * (1 - Math.exp(-dt / idle.settle))
      scene(dt)
      // Closed in, the same sway would look bigger, so it is scaled down to match.
      pano.sway.yaw = (drift.now[0] * drift.level) / pano.view.zoom
      pano.sway.pitch = (drift.now[1] * drift.level) / pano.view.zoom
      pano.sway.roll = roll + drift.now[2] * drift.level
      pano.draw()
      loop = requestAnimationFrame(step)
    }
    const run = () => { if (!loop) { then = performance.now(); loop = requestAnimationFrame(step) } }
    // The loop runs all the time (the browser pauses it while the tab is in the background): the
    // handheld camera never quite holds still, and the outline has to follow the view.
    run()

    // --- The computers: lock on, close in, slides ---
    const spots = copy.computers.map((c) => ({ id: c.id, body: centre(c.body, copy.panoWidth), ring: outline(c.body, copy.panoWidth, 26), screen: c.screen }))
    const show = { on: false, spot: null, page: 1, count: 0, ratio: 4 / 3, deck: null, shown: 0, speed: [0, 0, 0] } // `spot` is the one locked on to
    let lockedOn = null

    function deck() {
      if (!show.deck) {
        show.deck = openSlides(copy.slides)
        show.deck.info.then(({ count, ratio }) => { show.count = count; show.ratio = ratio; setSlide({ page: show.page, count }) }, () => {})
        show.deck.page(1).catch(() => {})
      }
      return show.deck
    }

    // Puts slide `n` on the screen (fading from the one before) once it has been drawn.
    function go(n) {
      const count = show.count || 1
      const page = Math.max(1, Math.min(count, n))
      show.page = page
      setSlide({ page, count: show.count })
      const d = deck()
      d.page(page).then((image) => {
        if (show.page !== page || show.shown === page) return
        const stage = pano.stage.slide ?? (pano.stage.slide = { area: null, from: null, to: null, mix: 1, alpha: 0 })
        if (stage.from) pano.dropTexture(stage.from)
        stage.from = stage.to
        stage.to = pano.texture(image)
        stage.mix = stage.from ? 0 : 1
        show.shown = page
        for (const near of [page + 1, page - 1]) if (near >= 1 && near <= count) d.page(near).catch(() => {})
      }, () => {})
    }
    function enter() {
      if (show.on || !lockedOn) return
      show.on = true
      show.spot = lockedOn
      show.speed = [0, 0, 0]
      held = new Set()
      setViewing(true)
      setMoved(true)
      go(show.page)
    }
    function leave() {
      if (!show.on) return
      show.on = false
      setViewing(false)
    }
    actions.current = { enter, leave, go: (by) => go(show.page + by) }

    // Runs every frame: which computer is being looked at, the move in and out, the slide, and
    // where the outline and the prompt are on the page.
    function scene(dt) {
      const view = pano.view
      const margin = copy.lockMargin * rad
      if (!show.on) {
        const found = spots.find((c) => {
          let off = view.yaw - c.body.lon
          off -= Math.PI * 2 * Math.round(off / (Math.PI * 2))
          return Math.abs(off) < c.body.halfLon + margin && Math.abs(view.pitch - c.body.lat) < c.body.halfLat + margin
        }) ?? null
        if (found !== lockedOn) {
          lockedOn = found
          setLocked(Boolean(found))
          if (found) { show.spot = found; deck() }
        }
      }

      // Closing in on the screen, or pulling back out.
      const spot = show.spot
      if (spot) {
        const area = fit(spot.screen, copy.panoWidth, show.ratio)
        const lensNow = pano.field()
        const full = Math.min(
          (lensNow.x * view.zoom) / Math.tan((area[1] / 2) * copy.closeIn),
          (lensNow.y * view.zoom) / Math.tan((area[3] / 2) * copy.closeIn),
        )
        const to = show.on ? Math.max(1, full) : 1
        if (show.on) {
          let off = area[0] + area[1] / 2 - view.yaw
          off -= Math.PI * 2 * Math.round(off / (Math.PI * 2))
          const level = area[2] - area[3] / 2
          if (calm) pano.set(view.yaw + off, level)
          else {
            let [yaw, pitch] = [0, view.pitch]
            ;[yaw, show.speed[0]] = spring(0, show.speed[0], off, copy.closeInTime, dt)
            ;[pitch, show.speed[1]] = spring(view.pitch, show.speed[1], level, copy.closeInTime, dt)
            pano.set(view.yaw + yaw, pitch)
          }
        }
        if (calm) view.zoom = to
        else {
          ;[view.zoom, show.speed[2]] = spring(view.zoom, show.speed[2], to, copy.closeInTime, dt)
          if (!show.on && Math.abs(view.zoom - 1) < 0.003) { view.zoom = 1; show.speed[2] = 0 }
        }

        // The slide fades in as the move finishes, and out as it starts back.
        const stage = pano.stage.slide
        if (stage) {
          stage.area = area
          const arrived = to > 1 ? (view.zoom - 1) / (to - 1) : 0
          const want = show.on && stage.to && arrived > 0.6 ? 1 : 0
          stage.alpha = calm ? want : Math.max(0, Math.min(1, stage.alpha + (want ? dt : -dt) / 0.3))
          if (stage.from) {
            stage.mix = calm ? 1 : Math.min(1, stage.mix + dt / copy.slideFade)
            if (stage.mix >= 1) { pano.dropTexture(stage.from); stage.from = null }
          }
        }

        // The outline and the prompt follow the computer on the page.
        const points = spot.ring.map(([lon, lat]) => pano.project(lon, lat))
        ring.current?.setAttribute('d', points.every(Boolean) ? `M${points.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join('L')}Z` : '')
        const below = pano.project(spot.body.lon, spot.body.lat - spot.body.halfLat - 1.4 * rad)
        if (prompt.current && below) prompt.current.style.transform = `translate(${(below[0] - 22).toFixed(1)}px, ${(below[1] - 22).toFixed(1)}px)`
      }
    }

    let swipe = null // while slides are showing, a sideways swipe changes slide
    function down(e) {
      if (e.button) return
      if (show.on) { swipe = { id: e.pointerId, x: e.clientX }; return }
      el.setPointerCapture(e.pointerId)
      const a = angles(e)
      drag = { id: e.pointerId, yaw: pano.view.yaw, pitch: pano.view.pitch, ax: a.x, ay: a.y }
      speed = 0
      last = { yaw: pano.view.yaw, t: e.timeStamp }
      setMoved(true)
    }
    function move(e) {
      if (!drag || e.pointerId !== drag.id) return
      // Keep the spot that was grabbed under the finger.
      const a = angles(e)
      pano.set(drag.yaw + drag.ax - a.x) // dragging only turns; looking up and down is on the arrow keys
      const dt = e.timeStamp - last.t
      if (dt > 0) {
        let turned = pano.view.yaw - last.yaw
        turned -= Math.PI * 2 * Math.round(turned / (Math.PI * 2))
        speed = speed * 0.5 + (turned / dt) * 0.5
        last = { yaw: pano.view.yaw, t: e.timeStamp }
      }
    }
    function up(e) {
      if (swipe && e.pointerId === swipe.id) {
        const moved = e.clientX - swipe.x
        swipe = null
        if (show.on && Math.abs(moved) > 40) go(show.page + (moved < 0 ? 1 : -1))
        return
      }
      if (!drag || e.pointerId !== drag.id) return
      drag = null
      if (calm || e.timeStamp - last.t > 80) speed = 0
      else run()
    }
    function wheel(e) {
      // Sideways scrolling (a trackpad swipe, or Shift + wheel) turns; up and down does nothing.
      const dx = e.deltaX || (e.shiftKey ? e.deltaY : 0)
      if (!dx || show.on) return
      e.preventDefault()
      speed = 0
      pano.set(pano.view.yaw + (dx / el.clientWidth) * 2 * Math.atan(pano.field().x))
      setMoved(true)
    }
    function keyDown(e) {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'f' || e.key === 'F') return toggleFull()
      if (e.key === ' ' || e.code === 'Space') { // the "A" button, for now
        e.preventDefault()
        if (!e.repeat) (show.on ? leave : enter)()
        return
      }
      if (show.on) {
        if (e.key === 'Escape' && !document.fullscreenElement) leave()
        if (e.key === 'ArrowRight') go(show.page + 1)
        if (e.key === 'ArrowLeft') go(show.page - 1)
        if (KEYS[e.key]) e.preventDefault()
        return
      }
      if (!KEYS[e.key]) return
      e.preventDefault()
      held.add(e.key)
      setMoved(true)
      run()
    }
    const keyUp = (e) => held.delete(e.key)
    const blur = () => { held = new Set() }
    const fullChange = () => setFull(Boolean(document.fullscreenElement || document.webkitFullscreenElement))

    el.addEventListener('pointerdown', down)
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
    el.addEventListener('wheel', wheel, { passive: false })
    window.addEventListener('keydown', keyDown)
    window.addEventListener('keyup', keyUp)
    window.addEventListener('blur', blur)
    document.addEventListener('fullscreenchange', fullChange)
    document.addEventListener('webkitfullscreenchange', fullChange)
    const sizes = new ResizeObserver(() => pano.resize())
    sizes.observe(el)

    return () => {
      cancelAnimationFrame(loop)
      sizes.disconnect()
      show.deck?.close()
      window.removeEventListener('keydown', keyDown)
      window.removeEventListener('keyup', keyUp)
      window.removeEventListener('blur', blur)
      document.removeEventListener('fullscreenchange', fullChange)
      document.removeEventListener('webkitfullscreenchange', fullChange)
      pano.destroy()
    }
  }, [])

  const touch = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
  const chip = 'rounded-full border border-white/15 bg-black/40 text-white/80 backdrop-blur-md'

  return (
    <main ref={frame} className="fixed inset-0 select-none overflow-hidden bg-black">
      <canvas ref={canvas} role="img" aria-label={copy.label} className="block h-full w-full cursor-grab touch-none active:cursor-grabbing" />
      {!full && <div className="pointer-events-none absolute left-4 top-4 text-white/80 [&>a]:pointer-events-auto"><Logo /></div>}
      {canFull && (
        <button type="button" onClick={(e) => { e.currentTarget.blur(); toggleFull() }} aria-label={full ? copy.exitFullscreen : copy.enterFullscreen} title={full ? copy.exitFullscreen : copy.enterFullscreen} className={`absolute right-4 top-4 flex h-11 w-11 items-center justify-center hover:text-white ${chip}`}>
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {full ? <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" /> : <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />}
          </svg>
        </button>
      )}
      {/* Looking at a computer: a thin outline around it, then the "A" prompt (space bar, or tap it). */}
      <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
        <path ref={ring} fill="none" stroke="white" strokeOpacity="0.55" strokeWidth="1.5" strokeLinejoin="round" className={`transition-opacity duration-500 motion-reduce:transition-none ${locked && !viewing ? 'opacity-100' : 'opacity-0'}`} />
      </svg>
      <button
        ref={prompt} type="button" tabIndex={locked && !viewing ? 0 : -1} aria-hidden={!(locked && !viewing)} aria-label={copy.actionHint} title={copy.actionHint}
        onClick={(e) => { e.currentTarget.blur(); actions.current.enter?.() }}
        className={`absolute left-0 top-0 flex h-11 w-11 items-center justify-center text-white transition-opacity duration-500 motion-reduce:transition-none ${locked && !viewing ? 'opacity-100 delay-300' : 'pointer-events-none opacity-0'}`}
      >
        <svg viewBox="0 0 32 32" className="h-8 w-8" fill="none" stroke="currentColor" strokeOpacity="0.6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="16" cy="16" r="13" />
          <path d="M11 22l5-12 5 12M12.9 17.5h6.2" />
        </svg>
      </button>
      {/* Slides: previous, which slide, next, close. Arrow keys, a swipe and the space bar do the same. */}
      <div className={`absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1 text-white transition-opacity duration-500 motion-reduce:transition-none ${viewing ? 'opacity-100 delay-500' : 'pointer-events-none opacity-0'}`} aria-hidden={!viewing}>
        {[
          { label: copy.previous, by: -1, off: slide.page <= 1, d: 'M19 9l-7 7 7 7' },
          { label: copy.next, by: 1, off: slide.page >= slide.count, d: 'M13 9l7 7-7 7' },
        ].map((b, i) => (
          <button key={b.label} type="button" tabIndex={viewing ? 0 : -1} disabled={b.off} aria-label={b.label} title={b.label} onClick={(e) => { e.currentTarget.blur(); actions.current.go?.(b.by) }} className={`flex h-11 w-11 items-center justify-center disabled:opacity-30 ${i ? 'order-3' : 'order-1'}`}>
            <svg viewBox="0 0 32 32" className="h-8 w-8" fill="none" stroke="currentColor" strokeOpacity="0.6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={b.d} /></svg>
          </button>
        ))}
        <p className="order-2 min-w-[4.5rem] text-center text-sm tabular-nums text-white/60" aria-live="polite">{slide.count ? copy.slideOf(slide.page, slide.count) : ''}</p>
        <button type="button" tabIndex={viewing ? 0 : -1} aria-label={copy.closeHint} title={copy.closeHint} onClick={(e) => { e.currentTarget.blur(); actions.current.leave?.() }} className="order-4 flex h-11 w-11 items-center justify-center">
          <svg viewBox="0 0 32 32" className="h-8 w-8" fill="none" stroke="currentColor" strokeOpacity="0.6" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true"><circle cx="16" cy="16" r="13" /><path d="M11.5 11.5l9 9M20.5 11.5l-9 9" /></svg>
        </button>
      </div>
      {state === 'ready' && !moved && <p className={`pointer-events-none absolute bottom-6 left-1/2 max-w-[calc(100%-2rem)] -translate-x-1/2 px-4 py-2 text-center text-sm ${chip}`}>{touch ? copy.hintTouch : copy.hint}</p>}
      {(state === 'unsupported' || state === 'failed') && (
        <p className="absolute inset-0 flex items-center justify-center px-6 text-center text-white/70" role="alert">{state === 'failed' ? copy.failed : copy.unsupported}</p>
      )}
    </main>
  )
}
