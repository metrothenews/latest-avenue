import { NavLink, Outlet } from 'react-router-dom'
import Logo from './Logo.jsx'
import Button from '../ui/Button.jsx'
import { useAuth } from '../auth/AuthProvider.jsx'

const adminNav = [
  { label: 'Dashboard', to: '/admin' },
  { label: 'Drive', to: '/admin/drive' },
  { label: 'Campaigns', to: '/admin/campaigns' },
  { label: 'Analytics', to: '/analytics' },
  { label: 'Admin', to: '/admin/team' },
  { label: 'Experience', to: '/admin/experience' },
  // The team portal, as team members see it.
  { label: 'Team', to: '/team' },
]

// Header + content for owner-only pages under /admin.
export default function AdminLayout() {
  const { user, signOut } = useAuth()
  return (
    <div className="flex min-h-screen flex-col">
      <header className="glass-bar sticky top-0 z-50 border-b">
        {/* One row on wide screens; below lg the tabs drop to a second row that scrolls sideways. */}
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 px-4 lg:h-16 lg:flex-nowrap">
          <div className="flex h-16 items-center gap-3">
            <Logo />
            <span className="hidden rounded-full border border-white/15 px-2 py-0.5 text-xs text-white/60 sm:inline">admin</span>
          </div>
          <nav className="order-last -mx-4 flex w-[calc(100%+2rem)] gap-1 overflow-x-auto px-4 pb-3 lg:order-none lg:mx-0 lg:ml-2 lg:w-auto lg:overflow-visible lg:p-0">
            {adminNav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end
                className={({ isActive }) => `shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-sm ${isActive ? 'bg-white/10 text-white' : 'text-white/60 hover:text-white'}`}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex h-16 items-center gap-3">
            <span className="hidden text-sm text-white/50 sm:inline">{user.email}</span>
            <Button variant="secondary" className="whitespace-nowrap" onClick={signOut}>Sign out</Button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-12"><Outlet /></main>
    </div>
  )
}
