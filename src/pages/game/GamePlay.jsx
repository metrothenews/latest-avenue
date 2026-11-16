import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { BoxIcon, Progress, Window, WinButton } from '../../components/game/Win.jsx'
import { cleanCode, CODE_LENGTH, joinGame, mySeat, now } from '../../lib/gameLink.js'
import { countVotes, ranked } from '../../lib/gameTally.js'
import { game } from '../../data/game.js'

const copy = game.play

// /game/play: a phone in ALIBI.EXE. One window at a time: join, write an answer, vote, and find
// out. The big screen (/game/join) runs the game; this page only sends this phone's answer and vote.
export default function GamePlay() {
  const [params, setParams] = useSearchParams()
  const code = cleanCode(params.get('c'))
  const ready = code.length === CODE_LENGTH
  const [seat] = useState(mySeat)
  const [typed, setTyped] = useState('')
  const [s, setS] = useState(null) // the game as this phone sees it (lib/gameLink.js → joinGame)
  const [text, setText] = useState('')
  const [name, setName] = useState('')
  const navigate = useNavigate()
  const [, setBeat] = useState(0)
  const link = useRef(null)

  useEffect(() => {
    if (!ready) return setS(null)
    link.current = joinGame(code, seat, game.maxPlayers, setS)
    return () => { link.current.stop(); link.current = null }
  }, [code, ready, seat])

  // Redraw the timer; keep the phone awake while playing.
  useEffect(() => {
    const timer = setInterval(() => setBeat((n) => n + 1), 250)
    let lock = null
    const keep = () => navigator.wakeLock?.request('screen').then((l) => { lock = l }, () => {})
    keep()
    const back = () => { if (document.visibilityState === 'visible') keep() }
    document.addEventListener('visibilitychange', back)
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', back); lock?.release().catch(() => {}) }
  }, [])

  // Show mode: when the game is over, this phone follows the room to the experience as the same player.
  const next = s?.next
  useEffect(() => {
    if (next?.pad) navigate(`/experience/controller?c=${next.pad}`, { replace: true, state: { seat, name: s?.name ?? '' } })
  }, [next?.pad]) // eslint-disable-line react-hooks/exhaustive-deps

  // A fresh text box for each round and each new game.
  const phase = s?.phase
  useEffect(() => setText(''), [phase, s?.game])

  const round = phase?.endsWith('2') ? 2 : 1
  const left = s?.endsAt ? Math.max(0, s.endsAt - now()) : 0
  const share = s?.endsAt && game.seconds[phase] ? left / (game.seconds[phase] * 1000) : 0
  const leave = () => setParams({}, { replace: true })
  const tidy = (value) => value.replace(/\s+/g, ' ').trim()

  const message = (words, kind) => <p className="flex items-center gap-[0.8em] text-[1.1em]">{kind && <BoxIcon kind={kind} />}<span>{words}</span></p>
  const timer = <Progress value={share} className="mt-[1em]" />

  let title = game.name
  let body

  if (!ready) {
    body = (
      <form onSubmit={(e) => { e.preventDefault(); if (typed.length === CODE_LENGTH) setParams({ c: typed }, { replace: true }) }}>
        <label htmlFor="game-code" className="block">{copy.enterCode}</label>
        <input
          id="game-code" value={typed} onChange={(e) => setTyped(cleanCode(e.target.value))} maxLength={CODE_LENGTH}
          autoCapitalize="characters" autoComplete="off" autoCorrect="off" spellCheck="false"
          className="w9-sunken mt-[0.5em] w-full select-text rounded-none bg-white px-[0.4em] py-[0.2em] text-center text-[2.2em] font-bold tracking-[0.3em] outline-none"
        />
        <WinButton type="submit" disabled={typed.length !== CODE_LENGTH} className="mt-[1em] w-full font-bold">{copy.join}</WinButton>
      </form>
    )
  } else if (!s || s.status === 'joining') {
    body = message(copy.joining)
  } else if (s.status !== 'in') {
    body = <>{message({ unknown: copy.unknown, full: copy.full, over: copy.over, failed: copy.lost }[s.status], 'error')}<WinButton className="mt-[1em] w-full" onClick={leave}>{copy.tryCode}</WinButton></>
  } else if (s.showMode && !s.name) {
    // Show mode keeps a name on file; it is shown to nobody unless this player wins.
    body = (
      <form onSubmit={(e) => { e.preventDefault(); const clean = tidy(name); if (clean) link.current?.name(clean).catch(() => {}) }}>
        <label htmlFor="game-name" className="block font-bold">{game.show.askName}</label>
        <input
          id="game-name" value={name} onChange={(e) => setName(e.target.value.slice(0, game.show.nameLength))} maxLength={game.show.nameLength}
          autoComplete="given-name" autoCapitalize="words" enterKeyHint="done"
          className="w9-sunken mt-[0.6em] block w-full select-text rounded-none bg-white px-[0.5em] py-[0.4em] outline-none"
        />
        <WinButton type="submit" disabled={!tidy(name)} className="mt-[0.8em] w-full font-bold">{game.show.nameOk}</WinButton>
      </form>
    )
  } else if (phase === 'report') {
    title = game.show.title
    body = s.revealed
      ? <><p>{game.show.suspect}</p><p className="mt-[0.2em] break-words text-[2em] font-bold leading-tight">{s.revealed}</p></>
      : message(s.result?.winner === seat ? game.show.stay : game.show.watch)
  } else if (phase === 'lobby' || !phase) {
    body = message(copy.inLobby)
  } else if (phase === 'write1' || phase === 'write2') {
    title = game.rounds[round]
    const playing = round === 1 || s.finalists?.[seat]
    if (!playing) body = message(copy.juryWaits)
    else if (s.answer[round]) body = <>{message(copy.filed)}<p className="w9-sunken mt-[0.8em] break-words bg-white px-[0.6em] py-[0.4em]">{s.answer[round]}</p></>
    else if (!left) body = message(copy.missed)
    else {
      body = (
        <form onSubmit={(e) => { e.preventDefault(); const clean = tidy(text); if (clean) link.current?.answer(round, clean).catch(() => {}) }}>
          <label htmlFor="game-answer" className="block font-bold leading-snug">{game.prompts[round]}</label>
          <textarea
            id="game-answer" value={text} onChange={(e) => setText(e.target.value.replace(/\n/g, ' ').slice(0, game.maxLength))} maxLength={game.maxLength} rows={2}
            autoComplete="off" enterKeyHint="send" onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.form.requestSubmit() } }}
            className="w9-sunken mt-[0.7em] block w-full resize-none select-text rounded-none bg-white px-[0.5em] py-[0.4em] outline-none"
          />
          <div className="mt-[0.7em] flex items-center justify-between gap-[1em]">
            <span className="tabular-nums text-[#404040]">{copy.left(game.maxLength - text.length)}</span>
            <WinButton type="submit" disabled={!tidy(text)} className="min-w-[6em] font-bold">{copy.send}</WinButton>
          </div>
          {timer}
        </form>
      )
    }
  } else if (phase === 'vote1' || phase === 'vote2') {
    title = game.rounds[round]
    const options = Object.entries(s.ballot[round] ?? {}).filter(([key]) => s.authors[round]?.[key] !== seat).sort((a, b) => Number(a[0].slice(1)) - Number(b[0].slice(1)))
    if (s.vote[round]) {
      // After voting: the whole leaderboard, live, to scroll through (the big screen shows the top few).
      const counts = s.tally[round] ?? countVotes(s.ballot[round], s.authors[round], s.votes[round])
      body = (
        <>
          <p className="font-bold">{copy.voted}</p>
          <ol className="w9-sunken mt-[0.6em] bg-white">
            {ranked(counts).map((key, i) => (
              <li key={key} className={`flex items-center gap-[0.6em] px-[0.5em] py-[0.35em] ${i % 2 ? 'bg-[#f0f0f0]' : ''}`}>
                <span className="w-[1.4em] shrink-0 text-right tabular-nums text-[#808080]">{i + 1}</span>
                <span className="min-w-0 flex-1 leading-snug [overflow-wrap:anywhere]">{s.ballot[round][key]}{key === s.vote[round] && <span className="ml-[0.4em] whitespace-nowrap text-[0.8em] text-[#000080]">({copy.yours})</span>}</span>
                <span className="w-[2.6em] shrink-0 text-center leading-none">
                  <span className="block font-bold tabular-nums">{counts[key]}</span>
                  <span className="block text-[0.65em]">{game.screen.voteWord(counts[key])}</span>
                </span>
              </li>
            ))}
          </ol>
        </>
      )
    }
    else if (!options.length) body = message(copy.nothingToVote)
    else {
      body = (
        <>
          <p className="font-bold">{copy.pick}</p>
          <ul className="mt-[0.6em] space-y-[0.4em]">
            {options.map(([key, words]) => (
              <li key={key}><WinButton className="w-full break-words py-[0.5em] text-left leading-snug" onClick={() => link.current?.vote(round, key).catch(() => {})}>{words}</WinButton></li>
            ))}
          </ul>
          {timer}
        </>
      )
    }
  } else if (phase === 'cut') {
    body = message(s.finalists?.[seat] ? copy.inFinal : copy.onJury)
  } else if (phase === 'result') {
    const won = s.result?.winner === seat
    title = won ? game.screen.verdict : game.name
    body = s.result?.none ? message(game.screen.noAnswers, 'error') : (
      <>
        <p className="flex items-center gap-[0.6em] text-[2em] font-bold leading-none">{won && <BoxIcon kind="error" className="h-[1.2em] w-[1.2em]" />}{won ? copy.guilty : copy.free}</p>
        <p className="mt-[1em]">{copy.winner}</p>
        <p className="w9-sunken mt-[0.4em] break-words bg-white px-[0.6em] py-[0.4em] font-bold">{s.result?.text}</p>
      </>
    )
  }

  return (
    <main className="w9 fixed inset-0 flex touch-manipulation select-none flex-col items-center justify-center overflow-hidden bg-[#008080] p-3 text-[17px]">
      <Window title={title} className="max-h-full w-full max-w-sm" bodyClass="overflow-y-auto p-[0.9em]" status={ready && s?.status === 'in' ? [code] : undefined}>{body}</Window>
    </main>
  )
}
