import Modal from '../ui/Modal.jsx'
import Button from '../ui/Button.jsx'
import { num } from '../../lib/format.js'

export default function ArtistModal({ artist, onClose }) {
  return (
    <Modal open={Boolean(artist)} onClose={onClose} title={artist?.name}>
      {artist && (
        <>
          <p className="text-2xl font-bold">{num(artist.before)} → {num(artist.after)}</p>
          <p className="text-sm text-white/50">monthly listeners in {num(artist.months)} months</p>
          <p className="mt-6 text-white/70">{artist.bio}</p>
          <blockquote className="mt-6 border-l-2 border-white/30 pl-4 text-white/80">“{artist.quote}”</blockquote>
          <Button href={artist.spotifyUrl} target="_blank" rel="noreferrer" variant="secondary" className="mt-6">
            Listen on Spotify
          </Button>
        </>
      )}
    </Modal>
  )
}
