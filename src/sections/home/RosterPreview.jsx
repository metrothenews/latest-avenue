import Section from '../../components/ui/Section.jsx'
import Button from '../../components/ui/Button.jsx'
import ArtistCard from '../../components/artists/ArtistCard.jsx'
import { artists, flagship } from '../../data/roster.js'

const others = artists.filter((a) => a.id !== flagship.id)

export default function RosterPreview() {
  return (
    <Section id="roster" title="The Roster">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {others.map((a) => <ArtistCard key={a.id} artist={a} />)}
      </div>
      <Button to="/roster" variant="secondary" className="mt-8">See the full roster</Button>
    </Section>
  )
}
