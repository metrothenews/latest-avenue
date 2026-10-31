import FlagshipArtist from '../../components/artists/FlagshipArtist.jsx'
import { flagship } from '../../data/roster.js'

export default function Flagship() {
  return (
    <section id={flagship.id} className="px-4 py-16 md:py-24">
      <div className="mx-auto max-w-6xl">
        <FlagshipArtist artist={flagship} />
      </div>
    </section>
  )
}
