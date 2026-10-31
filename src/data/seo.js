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
  '/login': { title: `Sign in | ${site.name}`, description },
  '/admin': { title: `Admin | ${site.name}`, description },
}

export const notFoundTitle = `Page not found | ${site.name}`
