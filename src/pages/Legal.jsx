import { legal } from '../data/legal.js'
import { slugify } from '../lib/format.js'

const Paragraphs = ({ items }) => items.map((p, i) => <p key={i} className="mt-3 text-white/70">{p}</p>)

// One template for Privacy, Terms and Refund. `doc` is a key in data/legal.js.
export default function Legal({ doc }) {
  const { title, updated, intro, sections } = legal[doc]
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 md:py-24">
      <h1 className="text-4xl font-extrabold tracking-tight">{title}</h1>
      <p className="mt-3 text-sm text-white/50">Last updated: {updated}</p>
      <Paragraphs items={intro} />

      <nav aria-label="Contents" className="mt-10 rounded-2xl glass p-6">
        <p className="text-sm font-semibold">Contents</p>
        <ol className="mt-3 space-y-1 text-sm">
          {sections.map((s) => (
            <li key={s.heading}>
              <a href={`#${slugify(s.heading)}`} className="text-white/60 hover:text-white">{s.heading}</a>
            </li>
          ))}
        </ol>
      </nav>

      {sections.map((s) => (
        <section key={s.heading} id={slugify(s.heading)} className="mt-12 scroll-mt-24">
          <h2 className="text-2xl font-semibold">{s.heading}</h2>
          <Paragraphs items={s.body} />
          {s.subsections.map((sub) => (
            <div key={sub.heading} className="mt-6">
              <h3 className="text-lg font-semibold">{sub.heading}</h3>
              <Paragraphs items={sub.body} />
            </div>
          ))}
        </section>
      ))}
    </div>
  )
}
