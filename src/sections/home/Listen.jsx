import Button from '../../components/ui/Button.jsx'
import Eyebrow from '../../components/ui/Eyebrow.jsx'
import { flagship } from '../../data/roster.js'
import { spotifyEmbedUrl } from '../../lib/spotify.js'

// Flagship artist card with Spotify's official embed (top tracks, playable). No API key needed.
export default function Listen() {
  const embed = spotifyEmbedUrl(flagship.spotifyUrl)
  return (
    <section id={flagship.id} className="px-4 pb-16 md:pb-24">
      <div className="glass mx-auto max-w-3xl p-6 md:p-8">
        <Eyebrow>Flagship artist</Eyebrow>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-3xl font-bold tracking-tight">{flagship.name}</h2>
          {embed && (
            <Button href={flagship.spotifyUrl} target="_blank" rel="noreferrer" variant="secondary">Open in Spotify</Button>
          )}
        </div>
        {embed ? (
          <iframe
            title={`${flagship.name} on Spotify`}
            src={embed}
            className="mt-6 block h-[352px] w-full rounded-xl"
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            loading="lazy"
          />
        ) : (
          <p className="mt-6 rounded-xl border border-dashed border-white/20 p-8 text-center text-sm text-white/50">
            [Add {flagship.name}'s Spotify artist link to <code>spotifyUrl</code> in src/data/roster.js]
          </p>
        )}
      </div>
    </section>
  )
}
