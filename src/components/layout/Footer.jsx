import { Link } from 'react-router-dom'
import Logo from './Logo.jsx'
import { footerNav } from '../../data/navigation.js'
import { site } from '../../data/site.js'

export default function Footer() {
  return (
    <footer className="glass-bar border-t">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 md:flex-row md:items-center md:justify-between">
        <Logo />
        <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/60">
          {footerNav.map((item) => (
            <Link key={item.label} to={item.to} className="hover:text-white">{item.label}</Link>
          ))}
        </nav>
        <p className="text-xs text-white/40">© {new Date().getFullYear()} {site.name}. All rights reserved.</p>
      </div>
    </footer>
  )
}
