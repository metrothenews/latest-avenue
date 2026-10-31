import { useState } from 'react'
import { Link } from 'react-router-dom'
import Logo from './Logo.jsx'
import Button from '../ui/Button.jsx'
import { mainNav } from '../../data/navigation.js'
import { site } from '../../data/site.js'

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false)
  return (
    <header className="glass-bar sticky top-0 z-50 border-b">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Logo />

        <nav className="hidden items-center gap-1 md:flex">
          {mainNav.map((item) => (
            <Link key={item.label} to={item.to} className="rounded-full px-3 py-2 text-sm text-white/70 hover:bg-white/5 hover:text-white">
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:block">
          <Button to={site.submitPath}>Submit a Demo</Button>
        </div>

        <button
          type="button"
          className="rounded-md p-2 md:hidden"
          aria-label="Toggle menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((o) => !o)}
        >
          {menuOpen ? '✕' : '☰'}
        </button>
      </div>

      {menuOpen && (
        <nav className="border-t border-white/10 px-4 py-4 md:hidden">
          {mainNav.map((item) => (
            <Link key={item.label} to={item.to} onClick={() => setMenuOpen(false)} className="block py-2 text-white/80">
              {item.label}
            </Link>
          ))}
          <Button to={site.submitPath} className="mt-4 w-full" onClick={() => setMenuOpen(false)}>Submit a Demo</Button>
        </nav>
      )}
    </header>
  )
}
