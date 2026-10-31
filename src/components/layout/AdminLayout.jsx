import { Outlet } from 'react-router-dom'
import Logo from './Logo.jsx'
import Button from '../ui/Button.jsx'
import { useAuth } from '../auth/AuthProvider.jsx'

// Header + content for owner-only pages under /admin.
export default function AdminLayout() {
  const { user, signOut } = useAuth()
  return (
    <div className="flex min-h-screen flex-col">
      <header className="glass-bar sticky top-0 z-50 border-b">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-3">
            <Logo />
            <span className="rounded-full border border-white/15 px-2 py-0.5 text-xs text-white/60">admin</span>
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
