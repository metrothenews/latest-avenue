import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { BoxIcon, Progress, Window, WinButton } from '../../components/game/Win.jsx'
import { newCode, now, openGame } from '../../lib/gameLink.js'
import { countVotes, cut, ranked, shuffle, winner } from '../../lib/gameTally.js'
import { game } from '../../data/game.js'

const copy = game.screen
const [WIDTH, HEIGHT] = [1024, 768] // the stage: always 4:3, scaled as one piece to fit the display
const GRACE = 1500 // ms into a step before "everyone's done" can end it early

const entries = (o) => Object.entries(o ?? {})
// An /experience pairing code (same letters as lib/padLink.js, which isn't loaded here).
const newPad = () => Array.from(crypto.getRandomValues(new Uint8Array(5)), (n) => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[n % 32]).join('')

// Show mode's police report about the winner: [{ label, value, big }], the suspect's name last.
export function reportLines(room, code) {
  const f = game.show.fields
  const seat = room.result?.winner
  return [
    { label: f.caseNo, value: `${String(new Date().getFullYear()).slice(2)}-${code}-${String(room.game ?? 1).padStart(3, '0')}` },
    { label: f.charge, value: game.show.charge },
    { label: f.statement, value: `"${room.answers?.[1]?.[seat]?.text ?? '…'}"` },
    { label: f.remarks, value: `"${room.result?.text ?? '…'}"` },
    { label: f.witnesses, value: game.screen.votes(room.result?.count ?? 0) },
    { label: f.finding, value: game.show.finding },
    { label: f.suspect, value: (room.names?.[seat] ?? '').trim() || game.show.unnamed, big: true },
  ]
}
// How much of the report has been typed `ms` after it opened: the lines with their values cut to
// what's typed so far, which line the cursor is on, and whether it has finished.
function typed(lines, ms) {
  let budget = Math.max(0, Math.floor(((ms - 700) / 1000) * game.show.typing))
  const out = lines.map((line, i) => {
    budget -= i === lines.length - 1 ? 30 : 10 // a beat before each line; longer before the name
    const shown = line.value.slice(0, Math.max(0, Math.min(line.value.length, budget)))
    budget -= line.value.length
    return { ...line, shown }
  })
  const cursor = out.findIndex((line) => line.shown.length < line.value.length)
  return { lines: out, cursor, done: cursor === -1 }
}
const BOTS = ['demobot00001', 'demobot00002'] // demo mode's two stand-in players
const between = (low, high) => low + Math.random() * (high - low)

// /game/join: the big screen for ALIBI.EXE, and the referee. It opens the room, runs each step's
// timer, shuffles the answers, counts the votes, makes the cut and names the winner
// (lib/gameTally.js); phones (/game/play) only send their own answer and vote.
//
// /game/join?demo=1 (or /experience?demo=1 in show mode) is demo mode, for trying the game on one device: a phone is shown beside the
// big screen, and two bots join, answer and vote so there is someone to play against.
// /experience renders this with `show`, which is the same as /game/join?then=experience.
export default function GameScreen({ show = false }) {
  const [code] = useState(newCode)
  const [params] = useSearchParams()
  const showMode = show || params.get('then') === 'experience' // hand over to /experience when the game ends
  const [pad] = useState(newPad)
  const navigate = useNavigate()
  const [veil, setVeil] = useState(false) // fades the screen to black on the way out
  const reveal = useRef({ shown: false, at: 0, sent: false })
  const demo = params.has('demo')
  const [side, setSide] = useState('screen') // demo mode on a narrow display: which half is showing
  const holder = useRef(null) // the space the 4:3 stage is fitted into
  const bots = useRef({ phase: null, wait: {} }) // when each bot acts in the current step
  const [g, setG] = useState(undefined) // everything under games/{code}; undefined until it loads
  const [failed, setFailed] = useState(false)
  const [scale, setScale] = useState(1)
  const [qr, setQr] = useState(null)
  const [, setBeat] = useState(0) // redraws the timers
  const link = useRef(null)
  const latest = useRef(null)
  const busy = useRef(false)
  const began = useRef({ phase: null, at: 0 })
  latest.current = g

  // Open the room, and close it when this page goes.
  useEffect(() => {
    link.current = openGame(code, setG, () => setFailed(true))
    return () => link.current.stop()
  }, [code])

  // The QR code for joining.
  useEffect(() => {
    import('qrcode-generator').then(({ default: qrcode }) => {
      const q = qrcode(0, 'M')
      q.addData(`${window.location.origin}/game/play?c=${code}`)
      q.make()
      const size = q.getModuleCount()
      let d = ''
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (q.isDark(y, x)) d += `M${x} ${y}h1v1h-1z`
      setQr({ size, d })
    }, () => {})
  }, [code])

  // Keep the 4:3 stage as big as the display allows.
  useEffect(() => {
    const fit = () => { if (holder.current) setScale(Math.min(holder.current.clientWidth / WIDTH, holder.current.clientHeight / HEIGHT) || 1) }
    fit()
    const sizes = new ResizeObserver(fit)
    sizes.observe(holder.current)
    const key = (e) => { if ((e.key === 'f' || e.key === 'F') && !e.metaKey && !e.ctrlKey) toggleFull() }
    window.addEventListener('keydown', key)
    return () => { sizes.disconnect(); window.removeEventListener('keydown', key) }
  }, [])

  // --- The referee: four times a second, see whether the current step is over ---
  useEffect(() => {
    const change = (fields) => {
      busy.current = true
      return link.current.change(fields).catch(() => {}).finally(() => { busy.current = false })
    }
    const starts = (phase) => ({ phase, endsAt: now() + game.seconds[phase] * 1000 })

    // Writing is over: shuffle what came in onto a ballot, or skip ahead if there's nothing to vote on.
    function closeWriting(round, room) {
      const sent = entries(room.answers?.[round])
        .filter(([seat, a]) => typeof a?.text === 'string' && a.text.trim() && (round === 1 || room.finalists?.[seat]))
        .sort((a, b) => (a[1].at ?? 0) - (b[1].at ?? 0))
        .slice(0, round === 1 ? game.maxPlayers : game.finalists)
      const mixed = shuffle(sent)
      const ballot = Object.fromEntries(mixed.map(([, a], i) => [`n${i + 1}`, a.text.trim().slice(0, game.maxLength)]))
      const authors = Object.fromEntries(mixed.map(([seat], i) => [`n${i + 1}`, seat]))
      const sheets = { [`ballot/${round}`]: ballot, [`authors/${round}`]: authors }
      if (round === 1) {
        if (!mixed.length) return change({ phase: 'result', endsAt: null, result: { none: true } })
        if (mixed.length === 1) return change({ ...sheets, 'tally/1': { n1: 0 }, finalists: { [authors.n1]: true }, ...starts('cut') })
        return change({ ...sheets, ...starts('vote1') })
      }
      if (!mixed.length) {
        // Nobody in the final answered: round 1's top answer wins.
        const best = ranked(room.tally?.[1] ?? {})[0]
        if (!best) return change({ phase: 'result', endsAt: null, result: { none: true } })
        return change({ phase: 'result', endsAt: null, result: { key: best, text: room.ballot[1][best], count: room.tally[1][best], winner: room.authors[1][best] } })
      }
      if (mixed.length === 1) return change({ ...sheets, 'tally/2': { n1: 0 }, phase: 'result', endsAt: null, result: { key: 'n1', text: ballot.n1, count: 0, winner: authors.n1 } })
      return change({ ...sheets, ...starts('vote2') })
    }

    function referee() {
      const room = latest.current
      if (!room || busy.current || !link.current) return
      setBeat((n) => n + 1)
      if (began.current.phase !== room.phase) began.current = { phase: room.phase, at: now() }
      const settled = now() - began.current.at > GRACE
      const timeUp = room.endsAt && now() >= room.endsAt
      const players = Object.keys(room.players ?? {})
      const round = room.phase?.endsWith('2') ? 2 : 1

      // Demo mode: the two bots join, and a few seconds into each step they answer or vote.
      if (demo) {
        const missing = BOTS.filter((bot) => !room.players?.[bot])
        if (missing.length) return void change(Object.fromEntries(missing.map((bot) => [`players/${bot}`, true])))
        if (bots.current.phase !== room.phase) bots.current = { phase: room.phase, wait: Object.fromEntries(BOTS.map((bot) => [bot, between(2500, 7000)])) }
        const waited = now() - began.current.at
        for (const [i, bot] of BOTS.entries()) {
          if (waited < bots.current.wait[bot]) continue
          const writing = room.phase === 'write1' || (room.phase === 'write2' && room.finalists?.[bot])
          if (writing && !room.answers?.[round]?.[bot]) {
            const lines = game.demo.lines[round]
            return void change({ [`answers/${round}/${bot}`]: { text: lines[(Math.floor(Math.random() * lines.length / 2) * 2 + i) % lines.length], at: now() } })
          }
          if ((room.phase === 'vote1' || room.phase === 'vote2') && !room.votes?.[round]?.[bot]) {
            const options = Object.keys(room.ballot?.[round] ?? {}).filter((key) => room.authors?.[round]?.[key] !== bot)
            if (options.length) return void change({ [`votes/${round}/${bot}`]: options[Math.floor(Math.random() * options.length)] })
          }
        }
      }

      // Show mode: after the verdict comes the police report, then the move to the experience.
      if (showMode) {
        if (room.pad !== pad) return void change({ pad })
        const moveOn = (winner, name) => {
          reveal.current.sent = true
          change({ next: { pad, winner, name } })
          setVeil(true)
          const lines = winner ? reportLines(room, code).map((l) => [l.label, l.value]) : null
          setTimeout(() => navigate('/experience', { replace: true, state: { handoff: { pad, winner, name, lines } } }), 900)
        }
        if (reveal.current.sent) return
        if (room.phase === 'result' && now() - began.current.at > game.show.verdictSeconds * 1000) {
          if (room.result?.none || !room.result?.winner) return void moveOn('', '')
          return void change({ phase: 'report', endsAt: null })
        }
        if (room.phase === 'report') {
          const lines = reportLines(room, code)
          const name = lines[lines.length - 1].value
          if (!reveal.current.shown && typed(lines, now() - began.current.at).done) {
            reveal.current = { shown: true, at: now(), sent: false }
            return void change({ revealed: name })
          }
          // It stays on the name until the admin presses Advance, or for a few seconds.
          if (reveal.current.shown && (room.advance || now() - reveal.current.at > game.show.holdSeconds * 1000)) moveOn(room.result.winner, name)
          return
        }
      }

      if (room.phase === 'write1' || room.phase === 'write2') {
        const writers = round === 1 ? players : players.filter((seat) => room.finalists?.[seat])
        const allIn = settled && writers.length > 0 && writers.every((seat) => room.answers?.[round]?.[seat])
        if (timeUp || allIn) closeWriting(round, room)
      } else if (room.phase === 'vote1' || room.phase === 'vote2') {
        const allIn = settled && players.length > 0 && players.every((seat) => room.votes?.[round]?.[seat])
        if (!timeUp && !allIn) return
        const counts = countVotes(room.ballot?.[round], room.authors?.[round], room.votes?.[round])
        if (round === 1) {
          const made = cut(counts, game.finalists)
          change({ 'tally/1': made.counts, finalists: Object.fromEntries(made.through.map((key) => [room.authors[1][key], true])), ...starts('cut') })
        } else {
          const won = winner(counts)
          change({ 'tally/2': won.counts, phase: 'result', endsAt: null, result: { key: won.key, text: room.ballot[2][won.key], count: won.counts[won.key], winner: room.authors[2][won.key] } })
        }
      } else if (room.phase === 'cut' && timeUp) {
        change(starts('write2'))
      }
    }
    const timer = setInterval(referee, 250)
    return () => clearInterval(timer)
  }, [demo])

  // One sound: a ding when the verdict comes up.
  const phase = g?.phase
  // Show mode: get the experience ready during the final vote, so the move to it is instant.
  useEffect(() => {
    if (!showMode || (phase !== 'vote2' && phase !== 'result')) return
    import('../Experience.jsx').catch(() => {})
    fetch('/pano/manifest.json').catch(() => {})
    fetch('/pano/preview.webp').catch(() => {})
  }, [showMode, phase])
  useEffect(() => {
    if (phase !== 'result') return
    try {
      const audio = new (window.AudioContext || window.webkitAudioContext)()
      const tone = audio.createOscillator()
      const volume = audio.createGain()
      tone.type = 'sine'
      tone.frequency.value = 880
      volume.gain.setValueAtTime(0.25, audio.currentTime)
      volume.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.9)
      tone.connect(volume).connect(audio.destination)
      tone.start()
      tone.stop(audio.currentTime + 0.9)
    } catch { /* no sound available */ }
  }, [phase])

  function toggleFull() {
    if (document.fullscreenElement) document.exitFullscreen?.()
    else document.documentElement.requestFullscreen?.().catch(() => {})
  }
  const start = () => link.current.change({ phase: 'write1', endsAt: now() + game.seconds.write1 * 1000 })
  const again = () => link.current.change({
    game: (g.game ?? 1) + 1, phase: 'lobby', endsAt: null, answers: null, ballot: null, authors: null, votes: null, tally: null, finalists: null, result: null,
  })

  // --- What to show ---
  const players = Object.keys(g?.players ?? {})
  const round = phase?.endsWith('2') ? 2 : 1
  const left = g?.endsAt ? Math.max(0, g.endsAt - now()) : 0
  const share = g?.endsAt && game.seconds[phase] ? left / (game.seconds[phase] * 1000) : 0
  const seconds = Math.ceil(left / 1000)
  const ballot = g?.ballot?.[round] ?? {}
  const live = g?.tally?.[round] ?? countVotes(ballot, g?.authors?.[round], g?.votes?.[round])
  const keys = Object.keys(ballot).sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)))
  const order = ranked(live)
  const top = order.slice(0, game.leaders) // the leaderboard
  const votesIn = Object.keys(g?.votes?.[round] ?? {}).length
  const filed = Object.keys(g?.answers?.[round] ?? {}).length
  const finalistCount = Object.keys(g?.finalists ?? {}).length
  const through = ranked(g?.tally?.[1] ?? {}).filter((key) => g?.finalists?.[g.authors?.[1]?.[key]])
  const clock = g?.endsAt && phase !== 'result' ? `0:${String(seconds).padStart(2, '0')}` : new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

  const most = Math.max(1, ...Object.values(live))

  const finalistsList = (
    <ol className="w9-sunken h-full overflow-hidden bg-white p-[6px]">
      {through.map((key) => (
        <li key={key} className="flex items-baseline justify-between gap-3 px-[6px] py-[3px] text-[17px] leading-tight">
          <span className="min-w-0 break-words">{g.ballot[1][key]}</span>
          <span className="shrink-0 tabular-nums text-[#404040]">{copy.votes(g.tally[1][key])}</span>
        </li>
      ))}
    </ol>
  )

  return (
    <main className="fixed inset-0 flex flex-col overflow-hidden bg-black md:flex-row">
      {/* Demo mode on a narrow display shows one half at a time. */}
      {demo && (
        <div className="w9 flex shrink-0 gap-[3px] bg-[#c0c0c0] p-[3px] text-[15px] md:hidden">
          {[['screen', game.demo.screen], ['phone', game.demo.phone]].map(([name, label]) => (
            <button key={name} type="button" className="w9-btn h-11 flex-1 font-bold" aria-pressed={side === name} onClick={() => setSide(name)}>{label}</button>
          ))}
        </div>
      )}
      <div ref={holder} className={`min-h-0 min-w-0 flex-1 items-center justify-center overflow-hidden ${demo && side !== 'screen' ? 'hidden md:flex' : 'flex'}`}>
      <div className="w9 relative shrink-0 select-none overflow-hidden bg-[#008080] text-[16px]" style={{ width: WIDTH, height: HEIGHT, transform: `scale(${scale})` }}>
        <div className="absolute inset-x-0 bottom-[36px] top-0 flex items-center justify-center gap-4 p-5">
          {failed && <Window title={game.name} className="w-[420px]"><p className="flex items-center gap-4"><BoxIcon kind="error" />{copy.failed}</p></Window>}
          {!failed && !g && <Window title={game.name} className="w-[360px]"><p>{copy.opening}</p></Window>}

          {!failed && phase === 'lobby' && (
            <Window title={game.name} className="w-[640px]" status={[copy.suspects(players.length), players.length < game.minPlayers ? copy.needMore(game.minPlayers) : `${players.length} / ${game.maxPlayers}`, ...(showMode ? [game.show.lobby] : [])]}>
              <div className="flex items-center gap-6">
                <div className="w9-sunken h-[250px] w-[250px] shrink-0 bg-white p-[10px]">
                  {qr && <svg viewBox={`0 0 ${qr.size} ${qr.size}`} className="h-full w-full" shapeRendering="crispEdges" role="img" aria-label="QR code to join"><path d={qr.d} /></svg>}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[30px] font-bold leading-tight">{copy.scan}</p>
                  <p className="mt-3 text-[15px]">{copy.orGo}</p>
                  <p className="text-[19px] font-bold">{game.address}</p>
                  <p className="mt-4 text-[15px]">{copy.code}</p>
                  <p className="w9-sunken mt-1 bg-white px-3 py-1 text-center text-[52px] font-bold leading-none tracking-[0.25em]">{code}</p>
                  <WinButton className="mt-5 w-full text-[20px] font-bold" onClick={start} disabled={players.length < game.minPlayers}>{copy.start}</WinButton>
                  {demo
                    ? <p className="mt-3 text-[14px] leading-snug"><b>{game.demo.label}.</b> {game.demo.hint}</p>
                    : <a href={show ? '/experience?demo=1' : showMode ? '/game/join?then=experience&demo=1' : '/game/join?demo=1'} className="mt-3 inline-block text-[14px] text-[#000080] underline">{game.demo.open}</a>}
                </div>
              </div>
            </Window>
          )}

          {!failed && (phase === 'write1' || phase === 'write2') && (
            <>
              {phase === 'write2' && <Window title={copy.finalists} className="h-[520px] w-[400px]" bodyClass="p-[6px]" status={[copy.objects(through.length)]}>{finalistsList}</Window>}
              <Window title={game.rounds[round]} className={phase === 'write2' ? 'w-[540px]' : 'w-[700px]'} status={[copy.filed(filed, round === 1 ? players.length : finalistCount), clock]}>
                <div className="flex items-start gap-5">
                  <BoxIcon className="h-[56px] w-[56px]" />
                  <p className={`font-bold leading-tight ${phase === 'write2' ? 'text-[27px]' : 'text-[34px]'}`}>{game.prompts[round]}</p>
                </div>
                <Progress value={share} className="mt-6 text-[20px]" />
              </Window>
            </>
          )}

          {!failed && (phase === 'vote1' || phase === 'vote2') && (
            <Window title={round === 1 ? copy.alibis : copy.final} className="h-full w-full" bodyClass="flex flex-col p-[4px]" menu={['File', 'Edit', 'View', 'Help']} status={[copy.objects(keys.length), copy.votesIn(votesIn, players.length), clock]}>
              <p className="w9-raised shrink-0 px-[8px] py-[3px] text-[15px]">{game.prompts[round]}</p>
              {/* The leaderboard: the top ten answers, live. The full list is on the phones. */}
              <ol className="w9-sunken mt-[2px] grid min-h-0 flex-1 bg-white p-[6px]" style={{ gridTemplateRows: `repeat(${game.leaders}, minmax(0, 1fr))` }}>
                {top.map((key, i) => {
                  const first = i === 0 && live[key] > 0
                  return (
                    <li key={key} className={`flex min-h-0 items-center gap-3 overflow-hidden px-[8px] ${first ? 'bg-[#000080] text-white' : ''}`}>
                      <span className="w-[1.4em] shrink-0 text-right text-[20px] tabular-nums opacity-60">{i + 1}</span>
                      <span className="line-clamp-2 min-w-0 flex-[3] text-[23px] leading-tight [overflow-wrap:anywhere]">{ballot[key]}</span>
                      <span className="flex h-[18px] flex-[2] items-center"><span className={`h-full ${first ? 'bg-white' : 'bg-[#000080]'}`} style={{ width: `${(live[key] / most) * 100}%` }} /></span>
                      <span className="w-[3em] shrink-0 text-center leading-none">
                        <span className="block text-[23px] font-bold tabular-nums">{live[key]}</span>
                        <span className="mt-[2px] block text-[11px]">{copy.voteWord(live[key])}</span>
                      </span>
                    </li>
                  )
                })}
              </ol>
              <Progress value={share} blocks={48} className="mt-[3px] shrink-0" />
            </Window>
          )}

          {!failed && phase === 'cut' && (
            <Window title={copy.finalists} className="h-[560px] w-[640px]" bodyClass="p-[6px]" status={[copy.through, copy.objects(through.length)]}>{finalistsList}</Window>
          )}

          {!failed && phase === 'report' && (() => {
            const view = typed(reportLines(g, code), now() - began.current.at)
            return (
              <Window title={game.show.title} className="w-[860px]" menu={['File', 'Edit', 'Records', 'Help']} bodyClass="p-[6px]" status={[`${view.lines[0].shown}`, clock]}>
                <dl className="w9-sunken bg-white px-[18px] py-[14px]">
                  {view.lines.map((line, i) => (
                    <div key={line.label} className={`flex items-baseline gap-4 ${line.big ? 'mt-[14px] border-t border-[#808080] pt-[14px]' : 'py-[5px]'}`}>
                      <dt className="w-[230px] shrink-0 text-[17px] uppercase text-[#404040]">{line.label}</dt>
                      <dd className={`min-w-0 flex-1 break-words font-bold ${line.big ? 'text-[46px] leading-none' : 'text-[22px] leading-tight'}`}>
                        {line.shown}{i === view.cursor && !view.done && <span className="ml-[2px] inline-block h-[0.9em] w-[0.5em] translate-y-[0.1em] bg-black" />}
                      </dd>
                    </div>
                  ))}
                </dl>
              </Window>
            )
          })()}

          {!failed && phase === 'result' && (
            <Window title={g.result?.none ? game.name : copy.verdict} className="w-[620px]">
              <div className="flex items-center gap-5">
                <BoxIcon kind="error" className="h-[64px] w-[64px]" />
                <div className="min-w-0 flex-1">
                  <p className="break-words text-[36px] font-bold leading-tight">{g.result?.none ? copy.noAnswers : g.result?.text}</p>
                  {!g.result?.none && <p className="mt-2 text-[18px]">{copy.votes(g.result?.count ?? 0)}</p>}
                </div>
              </div>
              {!showMode && <div className="mt-6 flex justify-center"><WinButton className="w-[180px] text-[20px]" onClick={again} autoFocus>{copy.again}</WinButton></div>}
            </Window>
          )}
        </div>

        {/* The taskbar: one button per player, and the clock (the countdown while a step is running). */}
        <footer className="w9-raised absolute inset-x-0 bottom-0 flex h-[36px] items-center gap-[4px] px-[4px] py-[3px] text-[14px]">
          <span className="w9-btn flex h-full shrink-0 items-center gap-[6px] px-[8px] font-bold"><span className="h-[14px] w-[14px] bg-[#000080]" />Start</span>
          <div className="flex h-full min-w-0 flex-1 gap-[3px]">
            {players.slice(0, game.maxPlayers).map((seat) => (
              <span key={seat} className={`w9-btn flex h-full min-w-0 max-w-[110px] flex-1 items-center overflow-hidden px-[5px] ${g?.finalists?.[seat] ? 'font-bold' : ''}`} aria-pressed={Boolean(g?.answers?.[round]?.[seat] && phase?.startsWith('write')) || Boolean(g?.votes?.[round]?.[seat] && phase?.startsWith('vote'))}>
                <span className="mx-auto h-[10px] w-[10px] shrink-0 bg-[#000080]" />
              </span>
            ))}
          </div>
          <button type="button" onClick={toggleFull} aria-label={copy.fullscreen} title={copy.fullscreen} className="w9-btn h-full shrink-0 px-[8px]">▢</button>
          <p className="w9-well flex h-full shrink-0 items-center px-[10px] tabular-nums">{clock}</p>
        </footer>
      </div>
      </div>
      {/* Demo mode: your phone, beside the big screen. */}
      {demo && (
        <aside className={`w9 min-h-0 shrink-0 flex-col bg-[#c0c0c0] p-[3px] text-[15px] md:flex md:w-[380px] ${side === 'phone' ? 'flex flex-1' : 'hidden'}`}>
          <p className="w9-title hidden shrink-0 px-[6px] py-[2px] md:block">{game.demo.phone}</p>
          <iframe title={game.demo.phone} src={`/game/play?c=${code}`} className="min-h-0 w-full flex-1 border-0" />
        </aside>
      )}
      <div className={`pointer-events-none absolute inset-0 bg-black transition-opacity duration-700 motion-reduce:transition-none ${veil ? 'opacity-100' : 'opacity-0'}`} />
    </main>
  )
}
