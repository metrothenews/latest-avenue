import Section from '../../components/ui/Section.jsx'
import { services } from '../../data/label.js'

export default function Services() {
  return (
    <Section
      id="services"
      title="Everything Your Drop Needs"
      subtitle="You focus on the music. We bring the team, the tools and the connections."
    >
      <div className="grid gap-4 md:grid-cols-2">
        {services.map((s, i) => (
          <div key={s.title} className="glass p-6 md:p-8">
            <span className="flex h-8 w-8 items-center justify-center rounded-full border border-white/25 bg-white/15 text-sm font-bold">
              {i + 1}
            </span>
            <h3 className="mt-4 text-xl font-semibold">{s.title}</h3>
            <p className="mt-2 text-white/70">{s.text}</p>
          </div>
        ))}
      </div>
    </Section>
  )
}
