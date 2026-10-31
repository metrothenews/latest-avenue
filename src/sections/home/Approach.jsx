import Button from '../../components/ui/Button.jsx'
import Eyebrow from '../../components/ui/Eyebrow.jsx'

export default function Approach() {
  return (
    <section id="approach" className="px-4 py-12">
      <div className="glass mx-auto max-w-4xl p-8 text-center md:p-12">
        <Eyebrow>Our approach</Eyebrow>
        <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">Major-label moves. Independent terms.</h2>
        <p className="mx-auto mt-4 max-w-xl text-white/70">
          Everything the big labels do for their priority artists, on a fair deal built for independent hip-hop.
        </p>
        <Button to="/#services" variant="secondary" className="mt-8">See How It Works</Button>
      </div>
    </section>
  )
}
