import { useAuth } from '../../components/auth/AuthProvider.jsx'

// Landing page for owner-only features. Add new tools as routes under /admin in App.jsx.
export default function Dashboard() {
  const { user } = useAuth()
  return (
    <div>
      <h1 className="text-4xl font-extrabold tracking-tight">Dashboard</h1>
      <p className="mt-3 text-white/60">Signed in as {user.displayName ?? user.email}.</p>
      <div className="glass mt-10 p-8 text-white/60">No tools yet. Owner-only features will live here.</div>
    </div>
  )
}
