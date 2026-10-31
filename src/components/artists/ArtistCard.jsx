import { num } from '../../lib/format.js'

// Roster card. Pass onClick to make it open the artist's details.
export default function ArtistCard({ artist, onClick }) {
  const body = (
    <>
      <h3 className="text-lg font-semibold">{artist.name}</h3>
      <p className="mt-2 text-sm text-white/60">
        {num(artist.before)} → {num(artist.after)} monthly listeners in {num(artist.months)} months
      </p>
      <blockquote className="mt-4 text-white/80">“{artist.quote}”</blockquote>
    </>
  )
  if (!onClick) return <div className="glass p-6">{body}</div>
  return (
    <button type="button" onClick={() => onClick(artist)} className="glass w-full p-6 text-left hover:bg-white/10">
      {body}
    </button>
  )
}
