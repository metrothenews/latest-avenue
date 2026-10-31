import { site } from './site.js'

const items = [
  ['Do you only sign hip-hop?', 'Yes. latest avenue is a hip-hop label: rap, trap, boom bap, drill, R&B-leaning hip-hop and everything in between.'],
  ['Do I keep ownership of my music?', '[Your policy on masters and publishing.]'],
  ['How do royalty splits work?', '[Your split, and when and how artists are paid.]'],
  ['Do I need a big following to apply?', 'No. We care about the music and your commitment to dropping consistently.'],
  ['How long are your deals?', '[Deal length and options.]'],
  ['Do you help with music videos and content?', '[What creative support you offer.]'],
  ['Can my manager or producers be involved?', "Yes. We're happy to work with your team."],
  ['Which platforms will my music be on?', 'Every major platform: Spotify, Apple Music, YouTube Music, SoundCloud, Tidal, Deezer, Amazon Music and more.'],
  ['How do I submit a demo?', `Use the form above. We listen to every submission and reply within ${site.replyDays} days.`],
]

export const faq = items.map(([question, answer], id) => ({ id, question, answer }))
