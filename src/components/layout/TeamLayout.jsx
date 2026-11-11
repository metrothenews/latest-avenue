import { NavLink, Outlet } from 'react-router-dom'
import Logo from './Logo.jsx'
import Button from '../ui/Button.jsx'
import { useAuth } from '../auth/AuthProvider.jsx'
import { team } from '../../data/team.js'

// Header + content for the team portal (/team and its pages). TeamAccess decides who gets in.
// On a phone the nav drops to a second row under the logo.
export default function TeamLayout() {
  const { user, signOut } = useAuth()
  return (
    <div className="flex min-h-screen flex-col">
      <header className="glass-bar sticky top-0 z-50 border-b">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:h-16 sm:py-0">
          <Logo />
          <span className="rounded-full border border-white/15 px-2 py-0.5 text-xs text-white/60">{team.badge}</span>
          {user && (
            <nav className="order-last -mx-1 flex w-full gap-1 sm:order-none sm:mx-0 sm:ml-2 sm:w-auto">
              {team.nav.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end
                  className={({ isActive }) => `rounded-full px-3 py-1.5 text-sm ${isActive ? 'bg-white/10 text-white' : 'text-white/60 hover:text-white'}`}
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          )}
          {user && (
            <div className="ml-auto flex items-center gap-3">
              <span className="hidden text-sm text-white/50 md:inline">{user.email}</span>
              <Button variant="secondary" onClick={signOut}>Sign out</Button>
            </div>
          )}
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 md:py-12"><Outlet /></main>
    </div>
  )
}
