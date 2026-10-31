import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './AuthProvider.jsx'

// Only renders child routes for the owner; everyone else goes to /login.
// This hides pages in the browser. Data must also be protected by firestore.rules.
export default function RequireOwner() {
  const { loading, isOwner } = useAuth()
  const location = useLocation()
  if (loading) return <p className="p-8 text-sm text-white/50">Checking sign-in…</p>
  if (!isOwner) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <Outlet />
}
