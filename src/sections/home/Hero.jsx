import Button from '../../components/ui/Button.jsx'
import { site } from '../../data/site.js'
import { flagship } from '../../data/roster.js'

export default function Hero() {
  return (
    <section id="hero" className="px-4 pb-16 pt-20 md:pb-24 md:pt-28">
      <div className="mx-auto max-w-4xl text-center">
        <p className="glass inline-block rounded-full px-4 py-1.5 text-xs text-white/70">
          Independent hip-hop. Founded by {site.founder}.
        </p>
        <h1 className="mt-8 text-4xl font-extrabold tracking-tight md:text-6xl">
          the label of the future is here
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg text-white/70">
          Stop waiting on a viral moment. Start building a name that lasts.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button to={site.submitPath}>Submit Your Music</Button>
          <Button to="/roster" variant="secondary">Meet the roster</Button>
        </div>
        <p className="mx-auto mt-10 max-w-2xl text-white/60">
          {site.name} is an independent hip-hop label for artists who want real growth without giving up control.
          We handle release strategy, marketing, playlist pitching and distribution, so every drop hits harder than the last.
        </p>
        <p className="mt-12 text-xs uppercase tracking-widest text-white/40">Home of</p>
        <p className="mt-2 text-2xl font-bold">{flagship.name}</p>
      </div>
    </section>
  )
}
