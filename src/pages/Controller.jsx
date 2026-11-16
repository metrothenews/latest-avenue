import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { experience } from '../data/experience.js'

const copy = experience.controller
const LINE = 2.5 // px: how thick the lines are
const line = { fill: 'none', stroke: 'white', strokeWidth: LINE, strokeLinecap: 'round', strokeLinejoin: 'round' }

// /experience/controller: a game controller for a phone, drawn in white lines on black. A stick
// on the left and A and X buttons on the right steer the /experience page that is showing the
// same code (lib/padLink.js links the two).
export default function Controller() {
  const [params, setParams] = useSearchParams()
  const code = (params.get('c') ?? '').toUpperCase()
  const [typed, setTyped] = useState('')
  // link: idle | connecting | connected | unknown | removed | failed. driving: this phone has the
  // controls. presenting: the presenter has them for now.
  const [state, setState] = useState({ link: 'idle', driving: false, presenting: false })
  const [knob, setKnob] = useState({ x: 0, y: 0 }) // -1..1, for drawing
  const [pressed, setPressed] = useState({ a: false, x: false })
  const link = useRef(null)
  const stick = useRef({ id: null, x: 0, y: 0, sent: 0, timer: 0 })

  // Join the screen showing this code.
  useEffect(() => {
    if (!code) return setState({ link: 'idle', driving: false, presenting: false })
    let live = true
    let joined = null
    setState({ link: 'connecting', driving: false, presenting: false })
    import('../lib/padLink.js').then(({ joinPad, mySeat }) => {
      if (!live) return
      joined = joinPad(code, mySeat(), (s) => live && setState(s))
      link.current = joined
    }, () => live && setState({ link: 'failed', driving: false, presenting: false }))
    return () => { live = false; joined?.stop(); link.current = null }
  }, [code])

  // Keep the phone awake while it is a controller, and stop the page from scrolling or zooming.
  useEffect(() => {
    let lock = null
    const keep = () => navigator.wakeLock?.request('screen').then((l) => { lock = l }, () => {})
    keep()
    const back = () => { if (document.visibilityState === 'visible') keep() }
    document.addEventListener('visibilitychange', back)
    return () => { document.removeEventListener('visibilitychange', back); lock?.release().catch(() => {}) }
  }, [])

  // The stick: where the finger is from the middle of the ring, as -1..1 each way (up is +y).
  function stickMove(e) {
    const s = stick.current
    if (e.pointerId !== s.id) return
    const box = e.currentTarget.getBoundingClientRect()
    const reach = box.width * 0.32 // how far the knob travels
    let x = (e.clientX - (box.left + box.width / 2)) / reach
    let y = -(e.clientY - (box.top + box.height / 2)) / reach
    const far = Math.hypot(x, y)
    if (far > 1) { x /= far; y /= far }
    stickSet(x, y)
  }
  function stickSet(x, y) {
    const s = stick.current
    s.x = x
    s.y = y
    setKnob({ x, y })
    // Send at most 30 times a second, and always send the latest position.
    const push = () => { s.timer = 0; s.sent = performance.now(); link.current?.stick(Number(s.x.toFixed(2)), Number(s.y.toFixed(2))) }
    const wait = 33 - (performance.now() - s.sent)
    if (wait <= 0) push()
    else if (!s.timer) s.timer = setTimeout(push, wait)
  }
  const stickDown = (e) => {
    if (stick.current.id !== null) return
    e.currentTarget.setPointerCapture(e.pointerId)
    stick.current.id = e.pointerId
    stickMove(e)
  }
  const stickUp = (e) => {
    if (e.pointerId !== stick.current.id) return
    stick.current.id = null
    stickSet(0, 0)
  }

  const button = (name) => ({
    onPointerDown: (e) => { e.currentTarget.setPointerCapture(e.pointerId); setPressed((p) => ({ ...p, [name]: true })); navigator.vibrate?.(8); link.current?.press(name) },
    onPointerUp: () => setPressed((p) => ({ ...p, [name]: false })),
    onPointerCancel: () => setPressed((p) => ({ ...p, [name]: false })),
    onContextMenu: (e) => e.preventDefault(),
  })

  const status = state.link === 'connected'
    ? (state.driving ? copy.yourTurn : state.presenting ? copy.presenterHas : copy.waitTurn)
    : { connecting: copy.connecting, unknown: copy.unknown, removed: copy.removed, failed: copy.lost }[state.link]
  const ready = state.link === 'connected' && state.driving

  return (
    <main className="fixed inset-0 flex touch-none select-none flex-col overflow-hidden bg-black text-white [-webkit-touch-callout:none]">
      {!code ? (
        // No code yet: ask for the one the screen is showing.
        <form className="m-auto flex w-full max-w-xs flex-col items-center gap-6 px-6" onSubmit={(e) => { e.preventDefault(); if (typed.length === 5) setParams({ c: typed }, { replace: true }) }}>
          <label htmlFor="pad-code" className="text-center text-sm font-semibold uppercase tracking-widest text-white/70">{copy.enterCode}</label>
          <input
            id="pad-code" value={typed} onChange={(e) => setTyped(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5))}
            inputMode="text" autoCapitalize="characters" autoComplete="off" autoCorrect="off" spellCheck="false" maxLength={5}
            className="w-full touch-auto select-text border-b-2 border-white/70 bg-transparent pb-2 text-center text-4xl font-semibold tracking-[0.4em] text-white outline-none focus:border-white"
          />
          <button type="submit" disabled={typed.length !== 5} className="h-12 w-full rounded-full border-2 border-white/70 text-sm font-semibold uppercase tracking-widest disabled:opacity-30">{copy.connect}</button>
        </form>
      ) : (
        <>
          <div className="flex h-12 shrink-0 items-center justify-between px-5 text-xs font-semibold uppercase tracking-widest text-white/60">
            <p role="status">{status}<span className="ml-3 text-white/35">{code}</span></p>
            <button type="button" className="touch-auto py-3 text-white/45" onClick={() => setParams({}, { replace: true })}>{copy.change}</button>
          </div>
          <div className={`flex min-h-0 flex-1 items-center justify-between gap-4 px-[6vw] pb-[max(1.5rem,env(safe-area-inset-bottom))] ${ready ? '' : 'opacity-35'}`}>
            {/* The stick. */}
            <div
              role="application" aria-label={copy.stick}
              onPointerDown={stickDown} onPointerMove={stickMove} onPointerUp={stickUp} onPointerCancel={stickUp}
              className="aspect-square w-[min(44vw,60vh,17rem)] shrink-0"
            >
              <svg viewBox="-50 -50 100 100" className="h-full w-full overflow-visible [&_*]:[vector-effect:non-scaling-stroke]" aria-hidden="true">
                <circle r="46" {...line} strokeOpacity="0.55" />
                <circle cx={knob.x * 32} cy={-knob.y * 32} r="17" {...line} fill={knob.x || knob.y ? 'rgba(255,255,255,0.18)' : 'none'} />
              </svg>
            </div>
            {/* A (lower right) and X (upper left of it), like the buttons on a game controller. */}
            <div className="relative aspect-square w-[min(40vw,56vh,15rem)] shrink-0">
              {[
                { name: 'x', label: copy.x, place: 'left-0 top-0', d: 'M-9 -11l18 22M9 -11l-18 22' },
                { name: 'a', label: copy.a, place: 'bottom-0 right-0', d: 'M-10 12l10 -24l10 24M-6.2 3h12.4' },
              ].map((b) => (
                <button key={b.name} type="button" aria-label={b.label} {...button(b.name)} className={`absolute h-[52%] w-[52%] ${b.place}`}>
                  <svg viewBox="-50 -50 100 100" className="h-full w-full overflow-visible [&_*]:[vector-effect:non-scaling-stroke]" aria-hidden="true">
                    <circle r="46" {...line} fill={pressed[b.name] ? 'rgba(255,255,255,0.22)' : 'none'} />
                    <path d={b.d} transform="scale(1.5)" {...line} />
                  </svg>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </main>
  )
}
