import Section from '../../components/ui/Section.jsx'
import { lessons } from '../../data/label.js'

export default function StreamingLessons() {
  return (
    <Section id="lessons" title="What We've Learned About Streaming">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {lessons.map((l) => (
          <div key={l.title} className="glass p-6">
            <h3 className="font-semibold">{l.title}</h3>
            <p className="mt-2 text-sm text-white/60">{l.text}</p>
          </div>
        ))}
      </div>
    </Section>
  )
}
