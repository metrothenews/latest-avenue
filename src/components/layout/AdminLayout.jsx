import { NavLink, Outlet } from 'react-router-dom'
import Logo from './Logo.jsx'
import Button from '../ui/Button.jsx'
import { useAuth } from '../auth/AuthProvider.jsx'

const adminNav = [
  { label: 'Dashboard', to: '/admin' },
  { label: 'Drive', to: '/admin/drive' },
  { label: 'Campaigns', to: '/admin/campaigns' },
  { label: 'Admin', to: '/admin/team' },
  // The team portal, as team members see it.
  { label: 'Team', to: '/team' },
]

// Header + content for owner-only pages under /admin.
export default function AdminLayout() {
  const { user, signOut } = useAuth()
  return (
    <div className="flex min-h-screen flex-col">
      <header className="glass-bar sticky top-0 z-50 border-b">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-3">
            <Logo />
            <span className="hidden rounded-full border border-white/15 px-2 py-0.5 text-xs text-white/60 sm:inline">admin</span>
            <nav className="flex gap-1 sm:ml-2">
              {adminNav.map((item) => (
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
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-white/50 sm:inline">{user.email}</span>
            <Button variant="secondary" onClick={signOut}>Sign out</Button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-12"><Outlet /></main>
    </div>
  )
}
