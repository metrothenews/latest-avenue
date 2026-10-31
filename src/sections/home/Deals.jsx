import Section from '../../components/ui/Section.jsx'
import Button from '../../components/ui/Button.jsx'
import { deals } from '../../data/deals.js'

export default function Deals() {
  return (
    <Section id="deals" title="How Our Deals Work" subtitle="Fair terms. Drop after drop.">
      <div className="grid gap-6 md:grid-cols-2">
        {deals.map((d) => (
          <div key={d.id} className={`glass flex flex-col p-8 ${d.badge ? 'border-white/30 bg-white/10' : ''}`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-2xl font-semibold">{d.name}</h3>
                {d.subtitle && <p className="text-sm text-white/50">{d.subtitle}</p>}
              </div>
              {d.badge && (
                <span className="rounded-full border border-white/25 bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide">
                  {d.badge}
                </span>
              )}
            </div>
            <ul className="mt-6 space-y-2 text-white/80">
              {d.features.map((f) => <li key={f}>✓ {f}</li>)}
            </ul>
            {d.bonuses.length > 0 && (
              <>
                <p className="mt-6 text-xs font-semibold uppercase tracking-widest text-white/50">Bonuses</p>
                <ul className="mt-2 space-y-2 text-white/70">
                  {d.bonuses.map((b) => <li key={b}>+ {b}</li>)}
                </ul>
              </>
            )}
            <div className="flex-1" />
            <Button to={`/?deal=${d.id}#submit`} variant={d.badge ? 'primary' : 'secondary'} className="mt-8 w-full">
              {d.cta}
            </Button>
          </div>
        ))}
      </div>
      <div className="mt-10 max-w-2xl">
        <h3 className="text-lg font-semibold">Why we think in rollouts, not one-offs.</h3>
        <p className="mt-2 text-white/60">
          Careers in hip-hop are built over consistent drops. Our deals give us time to grow your audience, keep pushing
          and carry that momentum into what's next.
        </p>
      </div>
    </Section>
  )
}
