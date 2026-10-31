import { site } from './site.js'

// Header menu. `to` values starting with "/#" scroll to a homepage section.
export const mainNav = [
  { label: 'Home', to: '/' },
  { label: 'How it works', to: '/#services' },
  { label: 'Roster', to: '/roster' },
  { label: 'Contact', to: '/contact' },
]

export const footerNav = [
  { label: 'Contact', to: '/contact' },
  { label: 'Submit a Demo', to: site.submitPath },
  { label: 'Privacy Policy', to: '/privacy' },
  { label: 'Terms of Service', to: '/terms' },
]
