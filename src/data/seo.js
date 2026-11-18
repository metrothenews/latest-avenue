import { site } from './site.js'
import { legal } from './legal.js'

// Browser-tab titles and meta descriptions, keyed by route path.
// Pages not listed here use `fallback`.
const description =
  `${site.name} is an independent hip-hop label. Release strategy, marketing, playlist pitching and distribution for artists who want real growth without giving up control.`

export const seo = {
  fallback: { title: site.name, description },
  '/': { title: `${site.name} | independent hip-hop label`, description },
  '/contact': {
    title: `Contact | ${site.name}`,
    description: `Questions about ${site.name}, a release or a deal? Get in touch.`,
  },
  '/privacy': { title: `${legal.privacy.title} | ${site.name}`, description },
  '/terms': { title: `${legal.terms.title} | ${site.name}`, description },
  '/global': {
    title: `global | ${site.name}`,
    description: `Name the country from its outline. A game from ${site.name}.`,
  },
  '/experience': { title: `experience | ${site.name}`, description: `Look around. A 360° view from ${site.name}.`, preview: true },
  '/experience/controller': { title: `controller | ${site.name}`, description: `A phone controller for the ${site.name} experience.` },
  '/game/join': { title: 'ALIBI.EXE', description: 'A two-round party game for 2 to 40 phones and one big screen.' },
  '/game/play': { title: 'ALIBI.EXE', description: 'Join the game on your phone.', preview: true },
  '/login': { title: `Sign in | ${site.name}`, description },
  '/admin': { title: `Admin | ${site.name}`, description },
  '/admin/drive': { title: `Drive | ${site.name}`, description },
  '/admin/campaigns': { title: `New Meta campaign | ${site.name}`, description },
  '/analytics': { title: `Analytics | ${site.name}`, description },
  '/admin/experience': { title: `Experience admin | ${site.name}`, description },
  '/edit': { title: `Edit | ${site.name}`, description },
  '/edit/sequencer': { title: `Sequencer | ${site.name}`, description },
  '/admin/team': { title: `Team admin | ${site.name}`, description },
  '/team/join': { title: `Join the team | ${site.name}`, description: `Sign up for the ${site.name} team portal.`, preview: true },
  '/team': { title: `Team portal | ${site.name}`, description },
  '/team/assignments': { title: `Assignments | ${site.name}`, description },
  // Also written into the built page for this address, so link previews show it (see vite.config.js).
  '/team/crew': { title: 'Crew Login', description: `Crew sign-in for ${site.name}.`, preview: true },
  '/team/note': { title: `Note | ${site.name}`, description },
  '/team/note/*': { title: `Note | ${site.name}`, description },
  '/team/chat': { title: `Messages | ${site.name}`, description },
}

export const notFoundTitle = `Page not found | ${site.name}`
