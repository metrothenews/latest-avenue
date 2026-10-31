// Turns a public Spotify link (https://open.spotify.com/artist/<id>, also album/track/playlist)
// into its embed URL. Returns null if the link isn't a Spotify link.
export function spotifyEmbedUrl(url) {
  const match = /open\.spotify\.com\/(?:intl-[a-z-]+\/)?(artist|album|track|playlist)\/([A-Za-z0-9]+)/.exec(url ?? '')
  return match ? `https://open.spotify.com/embed/${match[1]}/${match[2]}?theme=0` : null
}
