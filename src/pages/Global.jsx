import { useState } from 'react'
import Button from '../components/ui/Button.jsx'
import Eyebrow from '../components/ui/Eyebrow.jsx'
import Round from '../components/global/Round.jsx'
import { countries } from '../data/countries.js'
import { globalGame as copy } from '../data/global.js'

// Picks the answers for one game: different countries, only ones with an outline.
function pickTargets() {
  const pool = countries.filter((c) => c.path)
  const targets = []
  while (targets.length < copy.rounds) {
    const [target] = pool.splice(Math.floor(Math.random() * pool.length), 1)
    targets.push(target)
  }
  return targets
}

// Hidden page (/global, not in the menu): an outline guessing game, then a gift link.
export default function Global() {
  const [targets, setTargets] = useState(pickTargets)
  const [round, setRound] = useState(0)
  const finished = round >= copy.rounds
  const { gift } = copy

  function playAgain() {
    setTargets(pickTargets())
    setRound(0)
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-16 md:py-24">
      <h1 className="text-4xl font-extrabold tracking-tight">{copy.title}</h1>

      {finished ? (
        <section className="glass mt-10 p-8 text-center">
          <h2 className="text-2xl font-semibold">{gift.heading}</h2>
          <p className="mt-3 text-white/70">{gift.body}</p>
          {gift.url ? (
            <Button href={gift.url} target="_blank" rel="noreferrer" className="mt-6">{gift.label}</Button>
          ) : (
            <p className="mt-6 rounded-lg border border-dashed border-white/20 p-4 text-sm text-white/50">{gift.placeholder}</p>
          )}
          <div className="mt-4">
            <Button variant="ghost" onClick={playAgain}>{copy.playAgain}</Button>
          </div>
        </section>
      ) : (
        <>
          <p className="mt-4 text-white/70">{copy.intro}</p>
          <section className="glass mt-10 p-6 md:p-8">
            <Eyebrow>Round {round + 1} of {copy.rounds}</Eyebrow>
            <Round
              key={targets[round].name}
              target={targets[round]}
              doneLabel={round + 1 < copy.rounds ? copy.nextRound : copy.finish}
              onDone={() => setRound(round + 1)}
            />
          </section>
        </>
      )}
    </div>
  )
}
