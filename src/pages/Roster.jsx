import { useState } from 'react'
import Section from '../components/ui/Section.jsx'
import Eyebrow from '../components/ui/Eyebrow.jsx'
import Button from '../components/ui/Button.jsx'
import FlagshipArtist from '../components/artists/FlagshipArtist.jsx'
import ArtistCard from '../components/artists/ArtistCard.jsx'
import ArtistModal from '../components/artists/ArtistModal.jsx'
import FinalCTA from '../sections/home/FinalCTA.jsx'
import { artists, flagship, steps } from '../data/roster.js'
import { site } from '../data/site.js'

export default function Roster() {
  const [selected, setSelected] = useState(null)
  return (
    <>
      <section className="px-4 pb-8 pt-16 md:pt-24">
        <div className="mx-auto max-w-6xl">
          <Eyebrow>The roster</Eyebrow>
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight md:text-6xl">{site.name} artists</h1>
          <p className="mt-6 max-w-xl text-white/60">
            Independent hip-hop artists building real careers, release after release.
          </p>
          <Button to={site.submitPath} className="mt-8">Submit Your Music</Button>
        </div>
      </section>

      <section className="px-4 py-8">
        <div className="mx-auto max-w-6xl">
          <FlagshipArtist artist={flagship} />
        </div>
      </section>

      <Section id="artists" title="Everyone on the label">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {artists.map((a) => <ArtistCard key={a.id} artist={a} onClick={setSelected} />)}
        </div>
      </Section>

      <Section id="how-it-works" title="How it works">
        <ol className="grid gap-4 md:grid-cols-3">
          {steps.map((s, i) => (
            <li key={s.title} className="glass p-6">
              <span className="flex h-8 w-8 items-center justify-center rounded-full border border-white/25 bg-white/15 font-bold">{i + 1}</span>
              <h3 className="mt-4 text-lg font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm text-white/60">{s.text}</p>
            </li>
          ))}
        </ol>
      </Section>

      <FinalCTA />
      <ArtistModal artist={selected} onClose={() => setSelected(null)} />
    </>
  )
}
