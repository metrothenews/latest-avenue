import Section from '../../components/ui/Section.jsx'
import Eyebrow from '../../components/ui/Eyebrow.jsx'
import { founder } from '../../data/label.js'
import { site } from '../../data/site.js'

export default function Founder() {
  return (
    <Section id="founder">
      <Eyebrow>The founder</Eyebrow>
      <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">{site.founder}</h2>
      <p className="mt-4 max-w-2xl text-white/70">
        {site.name} was started by {site.founder}. {founder.story}
      </p>
      <div className="mt-10 grid gap-6 md:grid-cols-2">
        <div className="glass p-6">
          <h3 className="font-semibold">What Sam learned</h3>
          <ul className="mt-4 space-y-2 text-white/70">
            {founder.lessons.map((l) => <li key={l}>• {l}</li>)}
          </ul>
        </div>
        <div className="glass p-6">
          <h3 className="font-semibold">Where we are now</h3>
          <dl className="mt-4 grid grid-cols-3 gap-4">
            {founder.stats.map((s) => (
              <div key={s.label}>
                <dd className="text-2xl font-bold">{s.value}</dd>
                <dt className="mt-1 text-xs text-white/50">{s.label}</dt>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </Section>
  )
}
