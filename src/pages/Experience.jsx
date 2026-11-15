import { useEffect, useRef, useState } from 'react'
import Logo from '../components/layout/Logo.jsx'
import { startPano } from '../lib/pano.js'
import { experience as copy } from '../data/experience.js'

const KEYS = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }

// /experience: stand in one spot of a 360° panorama and turn left and right (lib/pano.js draws
// it). Drag, swipe, arrow keys or a sideways trackpad scroll turn the view; F is full screen.
export default function Experience() {
  const frame = useRef(null)
  const canvas = useRef(null)
  const [state, setState] = useState('loading') // loading | ready | unsupported | failed
  const [moved, setMoved] = useState(false)
  const [full, setFull] = useState(false)
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

    function step(now) {
      const dt = Math.min(50, now - then)
      then = now
      let [dx, dy] = [0, 0]
      for (const key of held) { dx += KEYS[key][0]; dy += KEYS[key][1] }
      const rate = (copy.keySpeed * Math.PI) / 180 / 1000
      if (dx || dy) { speed = 0; pano.set(pano.view.yaw + dx * rate * dt, pano.view.pitch + dy * rate * dt) }
      else if (!drag && Math.abs(speed) > 0.00002) { pano.set(pano.view.yaw + speed * dt); speed *= Math.exp(-dt / 320) }
      else { loop = 0; return }
      loop = requestAnimationFrame(step)
    }
    const run = () => { if (!loop) { then = performance.now(); loop = requestAnimationFrame(step) } }

    function down(e) {
      if (e.button) return
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
      pano.set(drag.yaw + drag.ax - a.x, drag.pitch + drag.ay - a.y)
      const dt = e.timeStamp - last.t
      if (dt > 0) {
        let turned = pano.view.yaw - last.yaw
        turned -= Math.PI * 2 * Math.round(turned / (Math.PI * 2))
        speed = speed * 0.5 + (turned / dt) * 0.5
        last = { yaw: pano.view.yaw, t: e.timeStamp }
      }
    }
    function up(e) {
      if (!drag || e.pointerId !== drag.id) return
      drag = null
      if (calm || e.timeStamp - last.t > 80) speed = 0
      else run()
    }
    function wheel(e) {
      // Sideways scrolling (a trackpad swipe, or Shift + wheel) turns; up and down does nothing.
      const dx = e.deltaX || (e.shiftKey ? e.deltaY : 0)
      if (!dx) return
      e.preventDefault()
      speed = 0
      pano.set(pano.view.yaw + (dx / el.clientWidth) * 2 * Math.atan(pano.field().x))
      setMoved(true)
    }
    function keyDown(e) {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'f' || e.key === 'F') return toggleFull()
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
        <button type="button" onClick={toggleFull} aria-label={full ? copy.exitFullscreen : copy.enterFullscreen} title={full ? copy.exitFullscreen : copy.enterFullscreen} className={`absolute right-4 top-4 flex h-11 w-11 items-center justify-center hover:text-white ${chip}`}>
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {full ? <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" /> : <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />}
          </svg>
        </button>
      )}
      {state === 'ready' && !moved && <p className={`pointer-events-none absolute bottom-6 left-1/2 max-w-[calc(100%-2rem)] -translate-x-1/2 px-4 py-2 text-center text-sm ${chip}`}>{touch ? copy.hintTouch : copy.hint}</p>}
      {(state === 'unsupported' || state === 'failed') && (
        <p className="absolute inset-0 flex items-center justify-center px-6 text-center text-white/70" role="alert">{state === 'failed' ? copy.failed : copy.unsupported}</p>
      )}
    </main>
  )
}
