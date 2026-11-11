import { useState } from 'react'
import Button from '../ui/Button.jsx'
import { fieldClass } from '../ui/fieldStyles.js'
import { countries, outlineSize } from '../../data/countries.js'
import { globalGame as copy } from '../../data/global.js'
import { distanceKm, direction, normalizeName } from '../../lib/geo.js'
import { num } from '../../lib/format.js'

const byName = new Map(countries.map((c) => [normalizeName(c.name), c]))

// One round: the outline of `target`, a guess box and the hints for each guess so far.
// Calls onDone() when the player moves on after winning or running out of guesses.
export default function Round({ target, doneLabel, onDone }) {
  const [guesses, setGuesses] = useState([])
  const [value, setValue] = useState('')
  const [error, setError] = useState('')

  const won = guesses.some((g) => g.name === target.name)
  const over = won || guesses.length >= copy.maxGuesses

  function submit(e) {
    e.preventDefault()
    const guess = byName.get(normalizeName(value))
    if (!guess) return setError(copy.unknownCountry)
    if (guesses.includes(guess)) return setError(copy.alreadyGuessed)
    setGuesses([...guesses, guess])
    setValue('')
    setError('')
  }

  return (
    <div>
      <svg
        viewBox={`0 0 ${outlineSize} ${outlineSize}`}
        role="img"
        aria-label="Outline of the mystery country"
        className="mx-auto h-56 w-56 md:h-72 md:w-72"
      >
        <path d={target.path} fillRule="evenodd" className="fill-white/80" />
      </svg>

      {over ? (
        <div className="mt-6 text-center" role="status">
          <p className="text-lg">
            {won ? copy.won : copy.lost} <strong>{target.name}</strong>.
          </p>
          <Button onClick={onDone} className="mt-5">{doneLabel}</Button>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-6" noValidate>
          <label htmlFor="guess" className="mb-2 block text-sm text-white/70">
            {copy.inputLabel} ({guesses.length + 1} of {copy.maxGuesses})
          </label>
          <div className="flex gap-3">
            <input
              id="guess"
              list="guess-countries"
              value={value}
              onChange={(e) => { setValue(e.target.value); setError('') }}
              placeholder={copy.inputPlaceholder}
              autoComplete="off"
              aria-invalid={Boolean(error)}
              aria-describedby={error ? 'guess-error' : undefined}
              className={fieldClass(error)}
            />
            <Button type="submit">Guess</Button>
          </div>
          <datalist id="guess-countries">
            {countries.map((c) => <option key={c.name} value={c.name} />)}
          </datalist>
          {error && <p id="guess-error" className="mt-2 text-sm text-red-400">{error}</p>}
        </form>
      )}

      {guesses.length > 0 && (
        <ol className="mt-6 space-y-2" aria-label="Your guesses">
          {guesses.map((g) => {
            const hit = g.name === target.name
            const dir = direction(g, target)
            return (
              <li key={g.name} className={`glass flex items-center justify-between gap-4 px-4 py-3 text-sm ${hit ? 'border-white/30 bg-white/10' : ''}`}>
                <span className="font-semibold">{g.name}</span>
                {hit ? (
                  <span className="text-white/70">Correct</span>
                ) : (
                  <span className="shrink-0 text-white/70">
                    {num(distanceKm(g, target))} km <span aria-hidden="true">{dir.arrow}</span>
                    <span className="sr-only"> to the {dir.label}</span>
                  </span>
                )}
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
