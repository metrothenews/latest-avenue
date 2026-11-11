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
  '/login': { title: `Sign in | ${site.name}`, description },
  '/admin': { title: `Admin | ${site.name}`, description },
  '/admin/drive': { title: `Drive | ${site.name}`, description },
  '/admin/campaigns': { title: `New Meta campaign | ${site.name}`, description },
  '/admin/team': { title: `Team | ${site.name}`, description },
  '/team': { title: `Team portal | ${site.name}`, description },
  '/team/messages': { title: `Messages | ${site.name}`, description },
}

export const notFoundTitle = `Page not found | ${site.name}`
