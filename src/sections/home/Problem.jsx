import Section from '../../components/ui/Section.jsx'
import { traps } from '../../data/label.js'
import { site } from '../../data/site.js'

export default function Problem() {
  return (
    <Section id="problem" title="The Independent Rapper's Trap">
      <div className="grid gap-4 md:grid-cols-3">
        {traps.map((t, i) => (
          <div key={t.title} className="glass p-6">
            <p className="text-sm text-white/40">{i + 1}</p>
            <h3 className="mt-1 text-xl font-semibold">{t.title}</h3>
            <ul className="mt-4 space-y-2 text-sm text-white/70">
              {t.points.map((p) => <li key={p}>• {p}</li>)}
            </ul>
          </div>
        ))}
      </div>
      <p className="mt-10 max-w-3xl text-white/70">
        Most independent rappers never get past 1,000 monthly listeners. Not because the music isn't there, but because
        they're doing a whole label's job by themselves. {site.name} gives you the team, the strategy and the reach, and
        you keep your sound and your masters.
      </p>
    </Section>
  )
}
