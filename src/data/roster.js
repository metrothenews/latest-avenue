// Artists on the label. Numbers left as null show as "[X]" until you fill them in.
// before/after = monthly listeners before signing and now; months = time since signing.

export const flagship = {
  id: 'metro-the-news',
  name: 'Metro The News',
  bio: "[Short bio of Metro The News: where he's from, his sound, and what he's released on latest avenue.]",
  before: null,
  after: null,
  months: null,
  streams: '[X]M+',
  latestRelease: '[Title]',
  quote: '[Quote from Metro The News, in his own words.]',
  // Public Spotify artist link (Share → Copy link to artist). Powers the homepage player.
  spotifyUrl: 'https://open.spotify.com/artist/2OM8IgYZBb9Wm57RfA6nm8',
}

const placeholder = (n) => ({
  id: `artist-${n}`,
  name: `[Artist ${n}]`,
  bio: '[Short bio.]',
  before: null,
  after: null,
  months: null,
  quote: '[Quote.]',
  spotifyUrl: '#',
})

// Everyone on the roster, flagship first.
export const artists = [flagship, placeholder(2), placeholder(3), placeholder(4)]
