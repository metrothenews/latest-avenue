import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import Logo from '../components/layout/Logo.jsx'
import { startPano } from '../lib/pano.js'
import { centre, fit, outline } from '../lib/panoSpots.js'
import { openSlides } from '../lib/slides.js'
import { drawReport } from '../lib/reportCard.js'
import { experience as copy } from '../data/experience.js'

// How thick the interface's lines are on screen, in px.
const LINE = 2.625

// One of the interface's line drawings (a button prompt), on a 32 x 32 grid, drawn at whatever
// size its parent is with lines LINE px thick.
function Glyph({ children }) {
  return (
    <svg viewBox="0 0 32 32" className="h-full w-full [&_*]:[vector-effect:non-scaling-stroke]" fill="none" stroke="currentColor" strokeOpacity="0.6" strokeWidth={LINE} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  )
}

// The audience's reactions, as line drawings on a 32 x 32 grid.
const REACTIONS = {
  laugh: '<circle cx="16" cy="16" r="12"/><path d="M10 17a6 6 0 0 0 12 0zM11 12h2M19 12h2"/>',
  gasp: '<circle cx="16" cy="16" r="12"/><circle cx="16" cy="20" r="3"/><path d="M11 12h1M20 12h1"/>',
  boo: '<path d="M9 5v13h9l4 8c2 0 3-1 3-3l-1-5h-2V5z"/><path d="M5 5v13"/>',
  object: '<path d="M16 4l13 23H3z"/><path d="M16 12v8M16 23.5v.5"/>',
}

// The call waveform's bars: heights and timings fixed once, so it looks organic but doesn't jump.
const WAVE = Array.from({ length: 56 }, (_, i) => ({
  h: 28 + Math.round(60 * Math.abs(Math.sin(i * 0.9) * Math.cos(i * 0.37))),
  t: 0.7 + ((i * 37) % 10) / 12,
  d: -((i * 53) % 20) / 10,
}))

const KEYS = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }

// /experience: stand in one spot of a 360° panorama and look around (lib/pano.js draws it).
// Drag, swipe, the left and right arrow keys or a sideways trackpad scroll turn the view; the up
// and down arrow keys look up and down, within limits; F is full screen.
// Looking at one of the computers outlines it and shows an "A" prompt; the space bar (or a tap
// on the prompt) closes in on its screen and shows a PDF there as slides: left and right arrow
// keys (or a swipe, or the buttons) change slide, the X key (or Esc) goes back out.
export default function Experience() {
  const frame = useRef(null)
  const canvas = useRef(null)
  const [state, setState] = useState('loading') // loading | ready | unsupported | failed
  const [moved, setMoved] = useState(false)
  const [full, setFull] = useState(() => typeof document !== 'undefined' && Boolean(document.fullscreenElement))
  // Arriving from the party game: { pad, winner, name, lines } (see pages/game/GameScreen.jsx).
  const handoff = useLocation().state?.handoff ?? null
  const [veil, setVeil] = useState(Boolean(handoff)) // black until the first picture is up
  const [calling, setCalling] = useState(false) // the story's phone step is playing
  const [hint, setHint] = useState('') // the "look this way" prompt: '' | 'l' | 'r'
  const hud = useRef({}) // the controller readout's parts: { box, knob, a, x, name }
  const edges = useRef({}) // the audience's nudges, one mark per edge: { l, r, u, d }
  const crowdBox = useRef(null) // where the audience's reactions drift up
  const [locked, setLocked] = useState(false) // looking at a computer
  const [viewing, setViewing] = useState(false) // closed in on a screen, showing slides
  const [slide, setSlide] = useState({ page: 1, count: 0 })
  const ring = useRef(null) // the outline around the computer being looked at
  const prompt = useRef(null) // the "A" button beside it
  const actions = useRef({})
  const [padOpen, setPadOpen] = useState(false) // the "connect a controller" panel
  const [padInfo, setPadInfo] = useState({ code: '', state: 'off', qr: null }) // state: off | waiting | connected | failed

  // The panel closes by itself once a controller is connected.
  useEffect(() => {
    if (padInfo.state !== 'connected') return
    const timer = setTimeout(() => setPadOpen(false), 900)
    return () => clearTimeout(timer)
  }, [padInfo.state])
  const canFull = typeof document !== 'undefined' && Boolean(document.fullscreenEnabled || document.webkitFullscreenEnabled)

  function toggleFull() {
    const el = frame.current
    if (document.fullscreenElement || document.webkitFullscreenElement) (document.exitFullscreen ?? document.webkitExitFullscreen).call(document)
    else (el.requestFullscreen ?? el.webkitRequestFullscreen)?.call(el)
  }

  useEffect(() => {
    const el = canvas.current
    const pano = startPano(el, copy, { onReady: () => { setState('ready'); if (handoff) beginIntro() }, onError: () => setState('failed') })
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
      if (!show.on) {
        for (const key of held) { dx += KEYS[key][0]; dy += KEYS[key][1] }
        // The phone controller's stick adds to the keys: a gentle push turns slowly.
        dx = Math.max(-1, Math.min(1, dx + pad.x))
        dy = Math.max(-1, Math.min(1, dy + pad.y))
      }

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
        if (turn * dx >= 0 && Math.abs(turn) < slowest * Math.abs(dx)) turn = dx * slowest
      } else {
        turn *= Math.exp(-dt / hand.slowDown)
        if (Math.abs(turn) < slowest / 12) turn = 0
      }
      // Looking up and down works the same way, and eases to a stop as it nears its limits.
      const [up, down] = pano.limits()
      const highest = Math.min(fastest, copy.maxTiltSpeed * rad)
      if (dy && (up || down)) {
        lift += (dy * highest - lift) * (1 - Math.exp(-dt / hand.speedUp))
        if (lift * dy >= 0 && Math.abs(lift) < slowest * Math.abs(dy)) lift = dy * slowest
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
    const spots = [
      ...copy.computers.map((c) => ({ id: c.id, body: centre(c.body, copy.panoWidth), ring: outline(c.body, copy.panoWidth, 26), screen: c.screen })),
      { id: copy.phone.id, kind: 'phone', body: centre(copy.phone.body, copy.panoWidth), ring: outline(copy.phone.body, copy.panoWidth, 26) },
    ]
    let aim = null // what the outline and the A prompt are on
    let intro = false // arriving from the party game: its last screen is on a monitor
    let phoneDone = false // the story's phone step has been done
    let call = null // { ends } while the phone step's recording plays
    let storyRun = null
    let skipSeen
    let hintSeen
    let seek = { since: performance.now(), target: null, shown: '' } // how long the player has been looking for what's next
    const crowdSeen = new Map() // seat → the count last seen on its audience pad
    const nudges = { l: 0, r: 0, u: 0, d: 0 }
    const hudSeen = { seat: null, a: 0, b: 0 }
    const show = { on: false, spot: null, page: 1, count: 0, ratio: 4 / 3, deck: null, shown: 0, speed: [0, 0, 0], key: 'default', source: copy.slides } // `spot` is the one locked on to
    const decks = new Map() // each PDF that has been opened: key → { deck, page, count, ratio }
    let room = null // everything the controller link knows: players, who has the controls, the story
    let padLib = null // lib/padLink.js, once a controller code has been shown
    let lockedOn = null
    const pad = { x: 0, y: 0, armed: true, from: null } // the phone controller's stick, -1..1 each way
    let padHost = null // stops listening for a controller
    let gone = false

    // The story (run from /admin/experience): while it is on, only the current chapter's monitor
    // can be opened, and it shows that chapter's PDF.
    const story = () => (room?.show?.story?.on ? room.show.story : null)
    const chapter = () => { const st = story(); return st ? st.chapters?.[st.at] ?? null : null }
    // The one thing that can be opened right now while a story runs: the phone first (if the
    // story starts with it), nothing while its recording plays, then the chapter's monitor.
    function target() {
      const st = story()
      if (!st) return null
      if (call) return 'none'
      if (st.phone && !phoneDone) return copy.phone.id
      return chapter()?.spot ?? 'none'
    }
    function startCall() {
      phoneDone = true
      call = { ends: performance.now() + copy.callSeconds * 1000 }
      lockedOn = undefined
      setCalling(true)
      report()
    }
    function endCall() {
      if (!call) return
      call = null
      lockedOn = undefined
      setCalling(false)
      report()
    }

    // Switches which PDF the monitors show, remembering the slide each one was on.
    function useDeck(key, source) {
      if (show.key === key) return
      decks.set(show.key, { deck: show.deck, page: show.page, count: show.count, ratio: show.ratio })
      const next = decks.get(key) ?? { deck: null, page: 1, count: 0, ratio: 4 / 3 }
      Object.assign(show, next, { key, source, shown: 0 })
      const stage = pano.stage.slide
      if (stage) { for (const t of [stage.from, stage.to]) if (t) pano.dropTexture(t); pano.stage.slide = null }
      setSlide({ page: show.page, count: show.count })
    }
    function deck() {
      if (!show.deck) {
        const key = show.key
        const opened = (show.deck = show.source?.page ? show.source : openSlides(typeof show.source === 'function' ? show.source() : show.source))
        opened.info.then(({ count, ratio }) => {
          if (show.key !== key) return
          show.count = count
          show.ratio = ratio
          setSlide({ page: show.page, count })
          report()
        }, () => {})
        opened.page(show.page).catch(() => {})
      }
      return show.deck
    }
    // The PDF for what's being looked at: the story's chapter, or the usual one.
    function pickDeck() {
      const ch = chapter()
      if (ch?.deck) useDeck(ch.deck, () => import('../lib/decks.js').then((m) => m.loadDeck(ch.deck)))
      else useDeck('default', copy.slides)
    }
    // Tells the admin page what this screen is doing.
    function report() {
      const step = !story() ? '' : call ? 'call' : target() === copy.phone.id ? 'phone' : 'monitor'
      padHost?.status?.({ viewing: show.on && !intro, spot: show.on ? show.spot?.id ?? '' : '', locked: lockedOn?.id ?? '', page: show.page, count: show.count, step, callEnds: call ? Math.round(Date.now() + call.ends - performance.now()) : 0 })
    }

    // Puts slide `n` on the screen (fading from the one before) once it has been drawn.
    function go(n) {
      const count = show.count || 1
      const page = Math.max(1, Math.min(count, n))
      show.page = page
      setSlide({ page, count: show.count })
      report()
      const d = deck()
      const key = show.key
      d.page(page).then((image) => {
        if (show.key !== key || show.page !== page || show.shown === page) return
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
      if (show.on || !lockedOn || intro) return
      if (lockedOn.kind === 'phone') return startCall()
      pickDeck()
      show.on = true
      show.spot = lockedOn
      show.speed = [0, 0, 0]
      held = new Set()
      setViewing(true)
      setMoved(true)
      go(show.page)
      syncDriver()
    }
    function leave() {
      if (!show.on || intro) return
      show.on = false
      setViewing(false)
      syncDriver()
      report()
    }
    actions.current = { enter, leave, go: (by) => go(show.page + by), startPad }

    // --- The phone controller (/experience/controller): its stick and its A and X buttons ---
    // Whose controls count: the presenter's while a story chapter is on a monitor; otherwise
    // whoever the admin chose, or the first phone to have joined.
    function driver() {
      if (!padLib) return null
      return padLib.driverOf({ ...room, status: { viewing: show.on } })
    }
    // When the controls change hands, the stick starts from the middle.
    function syncDriver() {
      const now = driver()
      if (now !== pad.from) { pad.from = now; pad.x = 0; pad.y = 0; pad.armed = true }
    }
    function padMessage(source, m) {
      if (source !== driver()) return
      const pc = copy.controller
      // Ignore the first little bit of travel, then run smoothly from 0 to 1.
      const eased = (v) => (Math.abs(v) < pc.deadZone ? 0 : (Math.sign(v) * (Math.abs(v) - pc.deadZone)) / (1 - pc.deadZone))
      if (m.t === 'stick' && Number.isFinite(m.x) && Number.isFinite(m.y)) {
        pad.x = eased(Math.max(-1, Math.min(1, m.x)))
        pad.y = eased(Math.max(-1, Math.min(1, m.y)))
        if (pad.x || pad.y) setMoved(true)
        // With slides showing, a push to one side is the next or the previous slide.
        if (Math.abs(m.x) < pc.flick / 2) pad.armed = true
        else if (show.on && pad.armed && Math.abs(m.x) > pc.flick) { pad.armed = false; go(show.page + Math.sign(m.x)) }
      }
      if (m.t === 'down' && m.b === 'a') enter()
      if (m.t === 'down' && m.b === 'x') leave()
    }
    // News from the controller link: players, who has the controls, and the story.
    function roomChanged(next) {
      const before = story()
      room = next
      const now = story()
      // A new chapter (or the story starting or stopping) pulls back out of whatever is open.
      if (show.on && (Boolean(before) !== Boolean(now) || before?.at !== now?.at)) leave()
      if (!show.on && (Boolean(before) !== Boolean(now) || before?.at !== now?.at)) lockedOn = undefined // look again
      // A story that has just been started begins again from its phone step.
      if ((now?.started ?? null) !== storyRun) { storyRun = now?.started ?? null; phoneDone = false; endCall(); lockedOn = undefined }
      if ((now?.skip ?? 0) !== skipSeen) { if (skipSeen !== undefined) endCall(); skipSeen = now?.skip ?? 0 }
      if ((room.show?.hintNow ?? 0) !== hintSeen) { if (hintSeen !== undefined) seek.since = -Infinity; hintSeen = room.show?.hintNow ?? 0 }
      syncDriver()
      readout()
      crowd()
    }
    // The controller readout: the player's stick and buttons, live, so the room can see what
    // they're doing. It shows a player's input only, never the admin's.
    function readout() {
      const parts = hud.current
      const seat = driver()
      const input = seat && seat !== padLib.ADMIN ? room.inputs?.[seat] : null
      if (parts.box) parts.box.style.opacity = input ? 1 : 0
      if (!input) { hudSeen.seat = null; return }
      parts.knob?.setAttribute('transform', `translate(${(Number(input.x) || 0) * 9} ${-(Number(input.y) || 0) * 9})`)
      if (parts.name) parts.name.textContent = room.names?.[seat] ?? ''
      const flash = (el) => { if (!el) return; el.setAttribute('fill-opacity', '0.9'); setTimeout(() => el.setAttribute('fill-opacity', '0'), 220) }
      if (hudSeen.seat === seat) {
        if (input.a > hudSeen.a) flash(parts.a)
        if (input.b > hudSeen.b) flash(parts.x)
      }
      Object.assign(hudSeen, { seat, a: input.a ?? 0, b: input.b ?? 0 })
    }
    // The audience: a nudge marks that edge of the screen; a reaction drifts up the side.
    function crowd() {
      for (const [seat, press] of Object.entries(room.crowd ?? {})) {
        const before = crowdSeen.get(seat) ?? 0
        crowdSeen.set(seat, press.c)
        if (press.c <= before || room.show?.mute || seat === driver()) continue
        if (press.k in nudges) nudges[press.k] = Math.min(6, nudges[press.k] + 1)
        else if (crowdBox.current && crowdBox.current.childElementCount < 24) {
          const mark = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
          mark.setAttribute('viewBox', '0 0 32 32')
          mark.setAttribute('class', 'crowd-rise absolute bottom-0 h-9 w-9')
          mark.style.right = `${Math.round(Math.random() * 60)}px`
          mark.innerHTML = `<g fill="none" stroke="white" stroke-opacity="0.75" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${REACTIONS[press.k] ?? ''}</g>`
          crowdBox.current.append(mark)
          setTimeout(() => mark.remove(), 2700)
        }
      }
    }
    // Arriving from the party game: its police report is on the Desk 1 monitor, filling the view
    // as if the game had been running there. Hold a moment, then pull back into the room.
    function beginIntro() {
      setTimeout(() => setVeil(false), 350)
      const desk = spots.find((c) => c.id === copy.handoff.spot)
      if (!handoff.lines || !desk) return
      const card = drawReport(handoff.lines, copy.handoff.title)
      const picture = { info: Promise.resolve({ count: 1, ratio: card.width / card.height }), page: () => Promise.resolve(card), close: () => {} }
      useDeck('report', picture)
      show.ratio = card.width / card.height
      Object.assign(show, { spot: desk, on: true, snap: true, speed: [0, 0, 0] })
      lockedOn = desk
      intro = true
      go(1)
      setTimeout(() => { intro = false; leave(); lockedOn = undefined }, copy.handoff.holdSeconds * 1000 + 350)
    }
    if (handoff?.pad) startPad()

    // Shows this screen's pairing code and waits for a controller (once; it keeps listening).
    async function startPad() {
      if (padHost) return
      padHost = {}
      seek.since = performance.now()
      try {
        const [lib, { default: qrcode }] = await Promise.all([import('../lib/padLink.js'), import('qrcode-generator')])
        if (gone) return
        const { hostPad, newCode } = lib
        padLib = lib
        const code = handoff?.pad ?? newCode()
        const qr = qrcode(0, 'M')
        qr.addData(`${window.location.origin}/experience/controller?c=${code}`)
        qr.make()
        const size = qr.getModuleCount()
        let d = ''
        for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (qr.isDark(y, x)) d += `M${x} ${y}h1v1h-1z`
        setPadInfo({ code, state: 'waiting', qr: { size, d } })
        padHost = hostPad(code, {
          first: handoff?.winner ?? '',
          onRoom: roomChanged,
          onMessage: padMessage,
          onState: (state) => {
            if (state !== 'connected') { pad.x = 0; pad.y = 0 }
            setPadInfo((info) => (info.state === state ? info : { ...info, state }))
          },
        })
        report()
      } catch {
        padHost = null
        setPadInfo((info) => ({ ...info, state: 'failed' }))
      }
    }

    // Runs every frame: which computer is being looked at, the move in and out, the slide, and
    // where the outline and the prompt are on the page.
    function scene(dt) {
      const view = pano.view
      const margin = copy.lockMargin * rad
      if (!show.on) {
        // With a story running, only the monitor its current chapter is on can be locked on to.
        const queued = target()
        const found = intro ? lockedOn : spots.find((c) => {
          if (queued ? c.id !== queued : c.kind === 'phone') return false
          let off = view.yaw - c.body.lon
          off -= Math.PI * 2 * Math.round(off / (Math.PI * 2))
          // Sideways it has to be near the middle of the view; up and down it only has to be well in view
          // (the phone sits below eye level, and looking level at it should still count).
          const reach = Math.max(c.body.halfLat + margin, Math.atan(pano.field().y) * 0.75)
          return Math.abs(off) < c.body.halfLon + margin && Math.abs(view.pitch - c.body.lat) < reach
        }) ?? null
        if (found !== lockedOn) {
          lockedOn = found
          setLocked(Boolean(found))
          if (found) { aim = found; if (found.kind !== 'phone') { show.spot = found; pickDeck(); deck() } }
          report()
        }
      }
      const clock = performance.now()
      if (call && clock >= call.ends) endCall()

      // The prompt for a player who hasn't found what's next: which way round to look.
      const wanted = target()
      const lost = wanted && wanted !== 'none' && !show.on && !lockedOn && padLib && driver() !== padLib.ADMIN && room?.show?.hints !== false
      if (!lost || wanted !== seek.target) seek = { since: lost && wanted === seek.target ? seek.since : clock, target: wanted, shown: seek.shown }
      let way = ''
      if (lost && clock - seek.since > copy.hintSeconds * 1000) {
        const item = spots.find((c) => c.id === wanted)
        let off = item ? item.body.lon - view.yaw : 0
        off -= Math.PI * 2 * Math.round(off / (Math.PI * 2))
        way = off < 0 ? 'l' : 'r'
      }
      if (way !== seek.shown) { seek.shown = way; setHint(way) }

      // The audience's nudges fade a couple of seconds after they stop.
      for (const key of Object.keys(nudges)) {
        nudges[key] *= Math.exp(-dt / 2.2)
        const mark = edges.current[key]
        if (mark) mark.style.opacity = Math.min(1, nudges[key] / 3).toFixed(2)
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
          if (calm || show.snap) pano.set(view.yaw + off, level)
          else {
            let [yaw, pitch] = [0, view.pitch]
            ;[yaw, show.speed[0]] = spring(0, show.speed[0], off, copy.closeInTime, dt)
            ;[pitch, show.speed[1]] = spring(view.pitch, show.speed[1], level, copy.closeInTime, dt)
            pano.set(view.yaw + yaw, pitch)
          }
        }
        if (calm || show.snap) view.zoom = to
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
          stage.alpha = calm || show.snap ? want : Math.max(0, Math.min(1, stage.alpha + (want ? dt : -dt) / 0.3))
          if (show.snap && stage.alpha === 1) show.snap = false // the picture is up: from here it moves normally
          if (stage.from) {
            stage.mix = calm ? 1 : Math.min(1, stage.mix + dt / copy.slideFade)
            if (stage.mix >= 1) { pano.dropTexture(stage.from); stage.from = null }
          }
        }

      }

      // The outline and the prompt follow whatever is being looked at.
      if (aim) {
        const points = aim.ring.map(([lon, lat]) => pano.project(lon, lat))
        ring.current?.setAttribute('d', points.every(Boolean) ? `M${points.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join('L')}Z` : '')
        const top = pano.project(aim.body.lon, aim.body.lat + aim.body.halfLat)
        if (prompt.current && top) prompt.current.style.transform = `translate(${(top[0] - 32).toFixed(1)}px, ${(top[1] - 64 - 14).toFixed(1)}px)` // sits just above it
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
        if (!e.repeat) enter()
        return
      }
      if (show.on) {
        if (e.key === 'x' || e.key === 'X' || (e.key === 'Escape' && !document.fullscreenElement)) leave() // the "X" button
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
      gone = true
      padHost?.stop?.()
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
      {/* Connect a phone as a controller: shows this screen's code (and a QR code for it). */}
      {state === 'ready' && (
        <button
          type="button" aria-label={copy.controller.open} title={copy.controller.open}
          onClick={(e) => { e.currentTarget.blur(); setPadOpen(true); actions.current.startPad?.() }}
          className={`absolute top-4 flex h-11 w-11 items-center justify-center hover:text-white ${canFull ? 'right-[4.25rem]' : 'right-4'} ${chip} ${padInfo.state === 'connected' ? 'text-white' : ''}`}
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="2.5" y="7" width="19" height="10" rx="5" /><path d="M7.5 10.5v3M6 12h3" /><circle cx="15.2" cy="13.2" r="0.6" fill={padInfo.state === 'connected' ? 'currentColor' : 'none'} /><circle cx="17.8" cy="10.8" r="0.6" fill={padInfo.state === 'connected' ? 'currentColor' : 'none'} />
          </svg>
        </button>
      )}
      {padOpen && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-label={copy.controller.title}>
          <div className="flex max-h-full w-full max-w-xs flex-col items-center gap-4 overflow-y-auto rounded-2xl border-2 border-white/50 bg-black/80 p-6 text-center text-white">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-white/70">{copy.controller.title}</h2>
            {padInfo.qr && (
              <svg viewBox={`-2 -2 ${padInfo.qr.size + 4} ${padInfo.qr.size + 4}`} className="h-40 w-40 rounded-lg bg-white" shapeRendering="crispEdges" role="img" aria-label="QR code">
                <path d={padInfo.qr.d} fill="black" />
              </svg>
            )}
            <p className="text-sm text-white/70">{copy.controller.steps}</p>
            <p className="text-xs text-white/50">{copy.controller.address}</p>
            <p className="select-text text-4xl font-semibold tracking-[0.3em]">{padInfo.code || '·····'}</p>
            <p className="text-xs font-semibold uppercase tracking-widest text-white/60" role="status">
              {{ off: copy.controller.waiting, waiting: copy.controller.waiting, connected: copy.controller.connected, failed: copy.controller.failed }[padInfo.state]}
            </p>
            <button type="button" onClick={() => setPadOpen(false)} className="h-11 w-full rounded-full border-2 border-white/50 text-sm font-semibold uppercase tracking-widest hover:border-white">{copy.controller.done}</button>
          </div>
        </div>
      )}
      {/* Looking at a computer: a thin outline around it, then the "A" button above it (space bar, or tap it). */}
      <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
        <path ref={ring} fill="none" stroke="white" strokeOpacity="0.55" strokeWidth={LINE} strokeLinejoin="round" className={`transition-opacity duration-500 motion-reduce:transition-none ${locked && !viewing ? 'opacity-100' : 'opacity-0'}`} />
      </svg>
      <button
        ref={prompt} type="button" tabIndex={locked && !viewing ? 0 : -1} aria-hidden={!(locked && !viewing)} aria-label={copy.actionHint}
        onClick={(e) => { e.currentTarget.blur(); actions.current.enter?.() }}
        className={`absolute left-0 top-0 h-16 w-16 cursor-default text-white transition-opacity duration-500 motion-reduce:transition-none ${locked && !viewing ? 'opacity-100 delay-300' : 'pointer-events-none opacity-0'}`}
      >
        <Glyph><circle cx="16" cy="16" r="13" /><path d="M11 22l5-12 5 12M12.9 17.5h6.2" /></Glyph>
      </button>
      {/* Slides, laid out like a game's button prompts: arrow keys at the sides, the slide number, and the X button to go back. */}
      {[
        { label: copy.previous, by: -1, off: slide.page <= 1, side: 'left-3 sm:left-6', d: 'M19.5 10.5v11l-8-5.5z' },
        { label: copy.next, by: 1, off: slide.page >= slide.count, side: 'right-3 sm:right-6', d: 'M12.5 10.5v11l8-5.5z' },
      ].map((b) => (
        <button
          key={b.label} type="button" tabIndex={viewing ? 0 : -1} aria-hidden={!viewing} disabled={b.off} aria-label={b.label}
          onClick={(e) => { e.currentTarget.blur(); actions.current.go?.(b.by) }}
          className={`absolute top-1/2 h-14 w-14 -translate-y-1/2 cursor-default text-white transition-opacity duration-500 motion-reduce:transition-none ${b.side} ${viewing ? (b.off ? 'opacity-25 delay-500' : 'opacity-100 delay-500') : 'pointer-events-none opacity-0'}`}
        >
          <Glyph><rect x="3" y="3" width="26" height="26" rx="5" /><path d={b.d} /></Glyph>
        </button>
      ))}
      <div className={`absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-4 text-white transition-opacity duration-500 motion-reduce:transition-none ${viewing ? 'opacity-100 delay-500' : 'pointer-events-none opacity-0'}`} aria-hidden={!viewing}>
        <p className="min-w-[4rem] text-center text-sm font-semibold tabular-nums tracking-widest text-white/60" aria-live="polite">{slide.count ? copy.slideOf(slide.page, slide.count) : ''}</p>
        <button type="button" tabIndex={viewing ? 0 : -1} aria-label={copy.closeHint} onClick={(e) => { e.currentTarget.blur(); actions.current.leave?.() }} className="flex cursor-default items-center gap-2">
          <span className="block h-12 w-12"><Glyph><circle cx="16" cy="16" r="13" /><path d="M11.5 10.5l9 11M20.5 10.5l-9 11" /></Glyph></span>
          <span className="text-xs font-semibold uppercase tracking-widest text-white/60">{copy.close}</span>
        </button>
      </div>
      {/* The audience: a mark at each edge for their nudges, and their reactions drifting up the side. */}
      {[['l', 'left-2 top-1/2 -translate-y-1/2', 'M20 6l-10 10 10 10'], ['r', 'right-2 top-1/2 -translate-y-1/2', 'M12 6l10 10-10 10'], ['u', 'left-1/2 top-16 -translate-x-1/2', 'M6 20l10-10 10 10'], ['d', 'bottom-28 left-1/2 -translate-x-1/2', 'M6 12l10 10 10-10']].map(([key, place, d]) => (
        <span key={key} ref={(el) => { edges.current[key] = el }} className={`pointer-events-none absolute h-16 w-16 text-white opacity-0 ${place}`} aria-hidden="true"><Glyph><path d={d} /></Glyph></span>
      ))}
      <div ref={crowdBox} className="pointer-events-none absolute bottom-24 right-6 h-0 w-24" aria-hidden="true" />
      {/* The player who hasn't found what's next: a stick, and chevrons drifting the way to look. */}
      <div className={`pointer-events-none absolute bottom-20 left-1/2 flex -translate-x-1/2 items-center gap-2 text-white transition-opacity duration-700 motion-reduce:transition-none ${hint && !viewing ? 'opacity-100' : 'opacity-0'}`} aria-hidden="true">
        <span className={`flex ${hint === 'l' ? '' : 'order-2'}`} style={{ '--drift': hint === 'l' ? '-8px' : '8px' }}>
          {[0, 1, 2].map((i) => <span key={i} className="hint-drift block h-10 w-6" style={{ animationDelay: `${(hint === 'l' ? 2 - i : i) * 0.15}s` }}><Glyph><path d={hint === 'l' ? 'M20 6l-10 10 10 10' : 'M12 6l10 10-10 10'} /></Glyph></span>)}
        </span>
        <span className="block h-12 w-12"><Glyph><circle cx="16" cy="16" r="13" /><circle cx={hint === 'l' ? 12 : 20} cy="16" r="5" /></Glyph></span>
      </div>
      {/* The phone step: a waveform along the bottom while the recording plays (nothing is heard yet). */}
      <div className={`pointer-events-none absolute bottom-20 left-1/2 flex h-12 w-[min(70vw,36rem)] -translate-x-1/2 items-center justify-between transition-opacity duration-700 motion-reduce:transition-none ${calling ? 'opacity-100' : 'opacity-0'}`} role="img" aria-label={calling ? 'A recording is playing' : undefined} aria-hidden={!calling}>
        {WAVE.map((bar, i) => <span key={i} className="wave-bar block w-[3px] rounded-full bg-white/60" style={{ height: `${bar.h}%`, animationDuration: `${bar.t}s`, animationDelay: `${bar.d}s` }} />)}
      </div>
      {/* Who's driving: the player's stick and buttons, live, in the same thin lines. */}
      <div ref={(el) => { hud.current.box = el }} className="pointer-events-none absolute bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-3 text-white opacity-0 transition-opacity duration-500 motion-reduce:transition-none" aria-hidden="true">
        <svg viewBox="0 0 96 32" className="h-9 w-[6.75rem] [&_*]:[vector-effect:non-scaling-stroke]" fill="none" stroke="currentColor" strokeOpacity="0.6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="16" cy="16" r="14" />
          <circle ref={(el) => { hud.current.knob = el }} cx="16" cy="16" r="5" />
          <circle ref={(el) => { hud.current.x = el }} cx="58" cy="12" r="9" fill="white" fillOpacity="0" />
          <path d="M54.5 8l7 8M61.5 8l-7 8" />
          <circle ref={(el) => { hud.current.a = el }} cx="82" cy="20" r="9" fill="white" fillOpacity="0" />
          <path d="M78.5 24l3.5-8 3.5 8M79.8 21.2h4.4" />
        </svg>
        <span ref={(el) => { hud.current.name = el }} className="max-w-[10rem] truncate text-xs font-semibold uppercase tracking-widest text-white/60" />
      </div>
      {/* Arriving from the party game: black until the first picture is up. */}
      <div className={`pointer-events-none absolute inset-0 z-20 bg-black transition-opacity duration-700 motion-reduce:transition-none ${veil ? 'opacity-100' : 'opacity-0'}`} aria-hidden="true" />
      {state === 'ready' && !moved && !handoff && <p className={`pointer-events-none absolute bottom-6 left-1/2 max-w-[calc(100%-2rem)] -translate-x-1/2 px-4 py-2 text-center text-sm ${chip}`}>{touch ? copy.hintTouch : copy.hint}</p>}
      {(state === 'unsupported' || state === 'failed') && (
        <p className="absolute inset-0 flex items-center justify-center px-6 text-center text-white/70" role="alert">{state === 'failed' ? copy.failed : copy.unsupported}</p>
      )}
    </main>
  )
}
