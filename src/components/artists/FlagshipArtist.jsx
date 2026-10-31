import Button from '../ui/Button.jsx'
import Eyebrow from '../ui/Eyebrow.jsx'
import { num } from '../../lib/format.js'

export default function FlagshipArtist({ artist }) {
  const stats = [
    { value: `${num(artist.before)} → ${num(artist.after)}`, label: 'monthly listeners since signing' },
    { value: artist.streams, label: 'streams' },
    { value: artist.latestRelease, label: 'latest release' },
  ]
  return (
    <div className="glass grid gap-8 p-8 md:grid-cols-2 md:p-12">
      <div>
        <Eyebrow>Flagship artist</Eyebrow>
        <h2 className="mt-3 text-4xl font-extrabold tracking-tight md:text-5xl">{artist.name}</h2>
        <p className="mt-4 text-white/70">{artist.bio}</p>
        <blockquote className="mt-6 border-l-2 border-white/30 pl-4 text-white/80">
          “{artist.quote}”
          <footer className="mt-1 text-sm text-white/40">— {artist.name}</footer>
        </blockquote>
        <Button href={artist.spotifyUrl} target="_blank" rel="noreferrer" className="mt-8">Listen on Spotify</Button>
      </div>
      <dl className="grid content-center gap-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
            <dd className="text-2xl font-bold">{s.value}</dd>
            <dt className="mt-1 text-sm text-white/50">{s.label}</dt>
          </div>
        ))}
      </dl>
    </div>
  )
}
