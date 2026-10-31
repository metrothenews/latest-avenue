import Button from '../../components/ui/Button.jsx'
import { site } from '../../data/site.js'

export default function FinalCTA() {
  return (
    <section id="get-started" className="px-4 py-20 text-center">
      <h2 className="text-3xl font-bold md:text-5xl">Your Next Drop Starts Here</h2>
      <p className="mx-auto mt-4 max-w-xl text-white/60">
        Join the artists building real careers with a label that's on their side.
      </p>
      <Button to={site.submitPath} className="mt-8">Submit Your Music</Button>
    </section>
  )
}
