import { useEffect, useRef, useState } from 'react'
import Button from '../../components/ui/Button.jsx'
import TextField from '../../components/ui/TextField.jsx'
import Notice from '../../components/ui/Notice.jsx'
import { ADMIN, adminPad, driverOf, seatsOf } from '../../lib/padLink.js'
import { followGame } from '../../lib/gameLink.js'
import { deleteDeck, getStory, listDecks, saveStory, uploadDeck } from '../../lib/decks.js'
import { experience } from '../../data/experience.js'

const copy = experience.admin
const KEYS = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }
const field = 'w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-white/40'
const small = 'rounded-full border border-white/15 px-3 py-1.5 text-sm hover:bg-white/10 disabled:opacity-40'
const pretty = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)} MB`

// /admin/experience: the owner's controls for one /experience screen. Players, who has the
// controls, taking them over, and running a story: chapters that each put one PDF on one
// monitor, opened by the player and presented by the owner (lib/padLink.js, lib/decks.js).
export default function Experience() {
  const [typed, setTyped] = useState('')
  const [code, setCode] = useState('')
  const [room, setRoom] = useState(undefined) // undefined: not heard yet; no `host` in it: no screen is showing that code
  const [gameCode, setGameCode] = useState('') // following a party game in show mode
  const [gameRoom, setGameRoom] = useState(undefined)
  const game = useRef(null)
  const [, setBeat] = useState(0)
  const [chapters, setChapters] = useState(null) // the story being edited; null while loading
  const [decks, setDecks] = useState(null)
  const [busy, setBusy] = useState(false)
  const [upload, setUpload] = useState(null) // 0..1 while a PDF uploads
  const [note, setNote] = useState('')
  const [withPhone, setWithPhone] = useState(true) // the story starts with the phone
  const link = useRef(null)
  const held = useRef(new Set())
  const picker = useRef(null)

  useEffect(() => {
    Promise.all([getStory(), listDecks()]).then(([story, list]) => { setChapters(story); setDecks(list) }, (err) => setNote(`Couldn't load the story: ${err.message}`))
  }, [])

  useEffect(() => {
    if (!code) return setRoom(undefined)
    link.current = adminPad(code, setRoom, (err) => setNote(`Couldn't reach the screen: ${err.message}`))
    return () => { link.current.stop(); link.current = null }
  }, [code])

  // Following a party game: connect to the screen it will move to as soon as that is known.
  useEffect(() => {
    if (!gameCode) return setGameRoom(undefined)
    game.current = followGame(gameCode, setGameRoom)
    return () => { game.current.stop(); game.current = null }
  }, [gameCode])
  useEffect(() => { if (gameRoom?.pad && !code) setCode(gameRoom.pad) }, [gameRoom?.pad, code])
  // Redraws the phone step's countdown.
  useEffect(() => { const timer = setInterval(() => setBeat((n) => n + 1), 500); return () => clearInterval(timer) }, [])

  const seats = seatsOf(room)
  const driver = driverOf(room)
  const show = room?.show ?? {}
  const story = show.story?.on ? show.story : null
  const current = story ? story.chapters?.[story.at] : null
  const status = room?.status ?? {}
  const linked = Boolean(room?.host)
  const names = room?.names ?? {}
  const callLeft = status.step === 'call' && status.callEnds ? Math.max(0, Math.ceil((status.callEnds - Date.now()) / 1000)) : 0
  const name = (seat) => (seat === ADMIN ? 'You' : seats.includes(seat) ? names[seat] || copy.player(seats.indexOf(seat) + 1) : '')
  const monitor = (id) => copy.monitors[id] ?? id

  // --- The control pad: hold a direction to look, A and X as on the phone controller ---
  const push = () => {
    let [x, y] = [0, 0]
    for (const key of held.current) { x += KEYS[key][0]; y += KEYS[key][1] }
    link.current?.stick(Math.max(-1, Math.min(1, x)), Math.max(-1, Math.min(1, y)))
  }
  const hold = (key, on) => { on ? held.current.add(key) : held.current.delete(key); push() }
  const arrow = (key, label, glyph) => (
    <button
      type="button" aria-label={label} disabled={!linked}
      onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); hold(key, true) }}
      onPointerUp={() => hold(key, false)} onPointerCancel={() => hold(key, false)} onContextMenu={(e) => e.preventDefault()}
      className="flex h-14 w-14 touch-none select-none items-center justify-center rounded-xl border border-white/20 bg-white/5 text-xl active:bg-white/20 disabled:opacity-40"
    >{glyph}</button>
  )
  function padKey(e, on) {
    if (KEYS[e.key]) { e.preventDefault(); if (!e.repeat) hold(e.key, on) }
    if (on && !e.repeat && (e.key === ' ' || e.code === 'Space')) { e.preventDefault(); link.current?.press('a') }
    if (on && !e.repeat && (e.key === 'x' || e.key === 'X')) link.current?.press('x')
  }
  // In slides, a quick push to one side is the next or previous slide.
  const flick = (dir) => { link.current?.stick(dir, 0); setTimeout(() => link.current?.stick(0, 0), 120) }

  // --- Story editing ---
  const edit = (i, fields) => setChapters((list) => list.map((c, n) => (n === i ? { ...c, ...fields } : c)))
  const move = (i, by) => setChapters((list) => { const next = [...list]; const [c] = next.splice(i, 1); next.splice(i + by, 0, c); return next })
  const complete = chapters?.length > 0 && chapters.every((c) => c.spot && c.deck)

  async function act(fn) {
    setBusy(true)
    setNote('')
    try { await fn() } catch (err) { setNote(err.message) } finally { setBusy(false) }
  }
  const save = () => act(async () => { await saveStory(chapters); setNote(copy.saved) })
  const addPdf = (file) => act(async () => {
    setUpload(0)
    try { const deck = await uploadDeck(file, setUpload); setDecks((list) => [deck, ...list]) } finally { setUpload(null) }
  })
  const dropPdf = (id) => act(async () => { await deleteDeck(id); setDecks((list) => list.filter((d) => d.id !== id)) })

  // --- Running the story ---
  const start = () => act(async () => { await saveStory(chapters); await link.current.show({ story: { on: true, at: 0, chapters, phone: withPhone, started: Date.now(), skip: 0 } }) })
  const goTo = (at) => link.current?.show({ 'story/at': Math.max(0, Math.min(story.chapters.length, at)) })
  const stop = () => link.current?.show({ story: null })

  return (
    <div>
      <h1 className="text-4xl font-extrabold tracking-tight">{copy.title}</h1>
      <p className="mt-3 max-w-2xl text-white/60">{copy.intro}</p>
      <Notice>{note}</Notice>

      {/* The screen being run. */}
      <section className="mt-10">
        <h2 className="text-2xl font-semibold">{copy.connectTitle}</h2>
        {!code && !gameCode ? (
          <form className="glass mt-4 flex max-w-xl flex-wrap items-end gap-3 p-5" onSubmit={(e) => { e.preventDefault(); if (typed.length === 5) setCode(typed); if (typed.length === 4) setGameCode(typed) }}>
            <p className="w-full text-sm text-white/60">{copy.connectText} {copy.connectText2}</p>
            <div className="w-40"><TextField id="screen-code" label="Code" showLabel value={typed} onChange={(e) => setTyped(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5))} autoComplete="off" autoCapitalize="characters" /></div>
            <Button type="submit" disabled={typed.length < 4}>{copy.connect}</Button>
          </form>
        ) : (
          <div className="glass mt-4 flex max-w-xl flex-wrap items-center justify-between gap-3 p-5 text-sm">
            <div>
              <p className="font-semibold" role="status">{gameCode && !code ? (gameRoom === undefined ? 'Connecting…' : gameRoom?.pad ? 'Connecting…' : gameRoom ? copy.gameNotShow : copy.noGame) : room === undefined ? 'Connecting…' : !linked ? (gameCode ? copy.gameOn(gameCode) : copy.noScreen) : copy.linked(code)}</p>
              {linked && <p className="mt-1 text-white/60">{status.viewing ? copy.statusViewing(monitor(status.spot), status.page, status.count) : status.locked ? copy.statusLocked(monitor(status.locked)) : copy.statusLooking}</p>}
            </div>
            <button type="button" className={small} onClick={() => { setCode(''); setGameCode(''); setTyped('') }}>{copy.disconnect}</button>
          </div>
        )}
      </section>

      {/* The party game being followed: names (to fix before a reveal) and the cue to move on. */}
      {gameRoom && (
        <section className="mt-12">
          <h2 className="text-2xl font-semibold">{copy.gameTitle}</h2>
          <p className="mt-2 max-w-2xl text-sm text-white/60">{copy.gameText}</p>
          <div className="glass mt-4 max-w-xl p-5 text-sm">
            <p className="font-semibold" role="status">{copy.gamePhase[gameRoom.phase] ?? gameRoom.phase}</p>
            {gameRoom.phase === 'report' && (
              <Button className="mt-3" onClick={() => game.current.change({ advance: true })} disabled={Boolean(gameRoom.advance)}>{copy.advance}</Button>
            )}
            {gameRoom.result?.winner && <p className="mt-3 text-white/70">{copy.winnerIs} <span className="font-semibold text-white">{gameRoom.names?.[gameRoom.result.winner] || copy.noName}</span></p>}
          </div>
          {Object.keys(gameRoom.names ?? {}).length > 0 && (
            <ul className="glass mt-4 max-w-xl divide-y divide-white/10">
              {Object.entries(gameRoom.names).sort((a, b) => (b[0] === gameRoom.result?.winner) - (a[0] === gameRoom.result?.winner) || a[1].localeCompare(b[1])).map(([seat, value]) => (
                <li key={seat} className="flex items-center gap-3 px-5 py-2 text-sm">
                  <input
                    key={value} defaultValue={value} maxLength={20} aria-label={copy.editName} className={`${field} flex-1`}
                    onBlur={(e) => { const next = e.target.value.trim().slice(0, 20); if (next && next !== value) game.current.change({ [`names/${seat}`]: next }); else e.target.value = value }}
                    onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur() }}
                  />
                  {seat === gameRoom.result?.winner && <span className="shrink-0 rounded-full border border-white/20 px-2 py-0.5 text-xs text-white/70">{copy.winnerTag}</span>}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {code && !linked && gameCode && (
        <section className="mt-12">
          <div className="glass max-w-xl p-5 text-sm">
            <h3 className="font-semibold">{copy.runTitle}</h3>
            <p className="mt-2 text-white/60">{copy.armText}</p>
            {show.story?.on
              ? <><p className="mt-3 font-semibold">{copy.armed}</p><button type="button" className={`${small} mt-3`} onClick={stop}>{copy.disarm}</button></>
              : <Button className="mt-3" onClick={start} disabled={!complete || busy}>{copy.arm}</Button>}
            {!complete && <p className="mt-2 text-white/50">{copy.incomplete}</p>}
          </div>
        </section>
      )}

      {linked && (
        <>
          {/* The story, while running: what's on, and the button that hands the controls back. */}
          <div className="glass mt-4 max-w-xl p-5 text-sm">
            <h3 className="font-semibold">{copy.runTitle}</h3>
            {!story ? (
              <>
                {!complete && <p className="mt-2 text-white/50">{copy.incomplete}</p>}
                <label className="mt-3 flex items-center gap-2"><input type="checkbox" checked={withPhone} onChange={(e) => setWithPhone(e.target.checked)} />{copy.withPhone}</label>
              <Button className="mt-3" onClick={start} disabled={!complete || busy}>{copy.start}</Button>
              </>
            ) : (
              <>
                <p className="mt-2 text-base font-semibold" role="status">{current ? copy.running(story.at + 1, story.chapters.length, current.title) : copy.finished}</p>
                {current && <p className="mt-1 text-white/70">{status.step === 'phone' ? copy.waitingPhone : status.step === 'call' ? copy.onCall(callLeft) : status.viewing ? copy.presenting : copy.waitingFor(monitor(current.spot))}</p>}
                <div className="mt-4 flex flex-wrap gap-2">
                  {current && status.viewing && <Button onClick={() => goTo(story.at + 1)}>{copy.endChapter}</Button>}
                  <button type="button" className={small} onClick={() => goTo(story.at - 1)} disabled={story.at === 0}>{copy.back}</button>
                  {status.step === 'call' && <button type="button" className={small} onClick={() => link.current.show({ 'story/skip': (story.skip ?? 0) + 1 })}>{copy.skipCall}</button>}
                {current && !status.viewing && status.step === 'monitor' && <button type="button" className={small} onClick={() => goTo(story.at + 1)}>{copy.skip}</button>}
                {!status.viewing && status.step !== 'call' && <button type="button" className={small} onClick={() => link.current.show({ hintNow: (show.hintNow ?? 0) + 1 })}>{copy.hintNow}</button>}
                  <button type="button" className={small} onClick={stop}>{copy.stop}</button>
                </div>
              </>
            )}
          </div>

          {/* Who has joined, and who has the controls. */}
          <section className="mt-12">
            <h2 className="text-2xl font-semibold">{copy.playersTitle}</h2>
            <p className="mt-2 text-sm text-white/60">{copy.playersText}</p>
            {seats.length === 0 ? <p className="mt-4 text-sm text-white/50">{copy.noPlayers}</p> : (
              <ul className="glass mt-4 max-w-xl divide-y divide-white/10">
                {seats.map((seat, i) => {
                  const chosen = driverOf({ ...room, status: {}, show: { ...show, story: null, driver: show.driver === ADMIN ? show.before : show.driver } }) === seat
                  return (
                    <li key={seat} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-5 py-3 text-sm">
                      <p className="font-semibold">{names[seat] || copy.player(i + 1)}{chosen && <span className="ml-2 rounded-full border border-white/20 px-2 py-0.5 text-xs font-normal text-white/70">{copy.has}</span>}</p>
                      <span className="flex gap-2">
                        {!chosen && <button type="button" className={small} onClick={() => link.current.show({ driver: seat })}>{copy.give}</button>}
                        <button type="button" className={small} onClick={() => link.current.show({ [`removed/${seat}`]: true, ...(show.driver === seat ? { driver: '' } : {}) })}>{copy.remove}</button>
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          {/* Taking over. */}
          <section className="mt-12">
            <h2 className="text-2xl font-semibold">{copy.takeTitle}</h2>
            <p className="mt-2 text-sm text-white/70" role="status">
              {driver === ADMIN ? (show.driver === ADMIN ? copy.youHave : copy.youPresent) : driver ? copy.theyHave(name(driver)) : copy.nobodyHas}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <label className="order-last flex items-center gap-2 text-sm text-white/70"><input type="checkbox" checked={Boolean(show.mute)} onChange={(e) => link.current.show({ mute: e.target.checked })} />{copy.mute}</label>
              <label className="order-last flex items-center gap-2 text-sm text-white/70"><input type="checkbox" checked={show.hints !== false} onChange={(e) => link.current.show({ hints: e.target.checked })} />{copy.hints}</label>
              {show.driver === ADMIN
                ? <Button variant="secondary" onClick={() => { held.current.clear(); push(); link.current.show({ driver: show.before ?? '', before: null }) }}>{copy.release}</Button>
                : <Button onClick={() => link.current.show({ driver: ADMIN, before: show.driver ?? '' })}>{copy.take}</Button>}
            </div>
            <div
              tabIndex={0} role="group" aria-label={copy.takeTitle} onKeyDown={(e) => padKey(e, true)} onKeyUp={(e) => padKey(e, false)} onBlur={() => { held.current.clear(); push() }}
              className={`glass mt-4 flex max-w-xl flex-wrap items-center justify-between gap-6 p-5 outline-none focus:border-white/40 ${driver === ADMIN ? '' : 'opacity-50'}`}
            >
              <div className="grid grid-cols-3 gap-2">
                <span />{arrow('ArrowUp', 'Look up', '▲')}<span />
                {arrow('ArrowLeft', 'Look left', '◀')}{arrow('ArrowDown', 'Look down', '▼')}{arrow('ArrowRight', 'Look right', '▶')}
              </div>
              <div className="flex gap-3">
                <button type="button" aria-label="X" onClick={() => link.current.press('x')} className="h-16 w-16 rounded-full border border-white/30 text-xl font-semibold active:bg-white/20">X</button>
                <button type="button" aria-label="A" onClick={() => link.current.press('a')} className="h-16 w-16 rounded-full border border-white/30 text-xl font-semibold active:bg-white/20">A</button>
              </div>
              {status.viewing && (
                <div className="flex w-full gap-3">
                  <button type="button" className={`${small} flex-1 py-3`} onClick={() => flick(-1)}>◀ {copy.prevSlide}</button>
                  <button type="button" className={`${small} flex-1 py-3`} onClick={() => flick(1)}>{copy.nextSlide} ▶</button>
                </div>
              )}
              <p className="w-full text-xs text-white/50">{copy.padHelp}</p>
            </div>
          </section>
        </>
      )}

      {/* The story: run it, then edit it. */}
      <section className="mt-12">
        <h2 className="text-2xl font-semibold">{copy.storyTitle}</h2>
        <p className="mt-2 max-w-2xl text-sm text-white/60">{copy.storyText}</p>

        {!linked && <p className="mt-4 text-sm text-white/50">{copy.needScreen}</p>}

        {chapters === null ? <p className="mt-6 text-sm text-white/50">Loading…</p> : (
          <>
            <ol className="mt-6 max-w-3xl space-y-3">
              {chapters.map((c, i) => (
                <li key={i} className="glass grid gap-3 p-4 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
                  <label className="block text-sm"><span className="mb-1 block text-white/60">{copy.chapter(i + 1)}: {copy.chapterTitle}</span><input className={field} value={c.title ?? ''} onChange={(e) => edit(i, { title: e.target.value })} /></label>
                  <label className="block text-sm"><span className="mb-1 block text-white/60">{copy.monitor}</span>
                    <select className={field} value={c.spot ?? ''} onChange={(e) => edit(i, { spot: e.target.value })}>
                      <option value="">…</option>
                      {experience.computers.map((m) => <option key={m.id} value={m.id}>{monitor(m.id)}</option>)}
                    </select>
                  </label>
                  <label className="block text-sm"><span className="mb-1 block text-white/60">{copy.pdf}</span>
                    <select className={field} value={c.deck ?? ''} onChange={(e) => edit(i, { deck: e.target.value })}>
                      <option value="">{copy.choosePdf}</option>
                      {(decks ?? []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </label>
                  <span className="flex gap-1">
                    <button type="button" className={small} aria-label={copy.up} title={copy.up} disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
                    <button type="button" className={small} aria-label={copy.down} title={copy.down} disabled={i === chapters.length - 1} onClick={() => move(i, 1)}>↓</button>
                    <button type="button" className={small} aria-label={copy.removeChapter} title={copy.removeChapter} onClick={() => setChapters((list) => list.filter((_, n) => n !== i))}>✕</button>
                  </span>
                </li>
              ))}
            </ol>
            <div className="mt-4 flex flex-wrap gap-3">
              <Button variant="secondary" onClick={() => setChapters((list) => [...list, { title: '', spot: '', deck: '' }])}>{copy.addChapter}</Button>
              <Button onClick={save} disabled={busy}>{copy.save}</Button>
            </div>
          </>
        )}
      </section>

      {/* The PDFs chapters can show. */}
      <section className="mt-12">
        <h2 className="text-2xl font-semibold">{copy.decksTitle}</h2>
        <input ref={picker} type="file" accept="application/pdf" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ''; if (file) addPdf(file) }} />
        <Button className="mt-4" variant="secondary" onClick={() => picker.current.click()} disabled={busy}>{upload === null ? copy.upload : copy.uploading(Math.round(upload * 100))}</Button>
        {decks?.length === 0 && <p className="mt-4 text-sm text-white/50">{copy.noDecks}</p>}
        {decks?.length > 0 && (
          <ul className="glass mt-4 max-w-xl divide-y divide-white/10">
            {decks.map((d) => {
              const used = chapters?.some((c) => c.deck === d.id)
              return (
                <li key={d.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-5 py-3 text-sm">
                  <p className="min-w-0 break-words"><span className="font-semibold">{d.name}</span> <span className="text-white/50">{pretty(d.size)}</span></p>
                  {used ? <span className="text-white/40">{copy.inUse}</span> : <button type="button" className={small} onClick={() => dropPdf(d.id)} disabled={busy}>{copy.deleteDeck}</button>}
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
