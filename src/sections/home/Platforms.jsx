import Section from '../../components/ui/Section.jsx'
import Eyebrow from '../../components/ui/Eyebrow.jsx'
import { platforms } from '../../data/label.js'

export default function Platforms() {
  return (
    <Section id="platforms">
      <Eyebrow>Wherever your fans listen</Eyebrow>
      <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">Released everywhere, not just Spotify.</h2>
      <ul className="mt-8 flex flex-wrap gap-3">
        {platforms.map((p) => <li key={p} className="glass rounded-full px-4 py-2 text-sm">{p}</li>)}
      </ul>
    </Section>
  )
}
