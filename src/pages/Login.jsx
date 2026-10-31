import { useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import Button from '../components/ui/Button.jsx'
import Notice from '../components/ui/Notice.jsx'
import { useAuth } from '../components/auth/AuthProvider.jsx'
import { ownerUid } from '../data/firebase.js'

// Owner-only sign-in. Not linked from the public site.
export default function Login() {
  const { configured, user, loading, isOwner, signIn, signOut } = useAuth()
  const location = useLocation()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (isOwner) return <Navigate to={location.state?.from ?? '/admin'} replace />

  async function handleSignIn() {
    setBusy(true)
    setError(await signIn())
    setBusy(false)
  }

  return (
    <div>
      <h1 className="text-3xl font-bold">Owner sign-in</h1>

      {!configured ? (
        <Notice>Firebase isn't configured yet. Fill in src/data/firebase.js (see README → Owner login).</Notice>
      ) : loading ? (
        <p className="mt-6 text-sm text-white/50">Checking sign-in…</p>
      ) : user ? (
        <div className="mt-6 space-y-4 text-white/70">
          <p>Signed in as <span className="text-white">{user.email}</span>, but this account doesn't have access.</p>
          {!ownerUid && (
            <div className="glass p-4 text-sm">
              <p>If this is your account, paste this user ID into <code>ownerUid</code> in src/data/firebase.js and into firestore.rules:</p>
              <code className="mt-2 block select-all break-all rounded bg-black/40 p-2 text-white">{user.uid}</code>
            </div>
          )}
          <Button variant="secondary" onClick={signOut}>Sign out</Button>
        </div>
      ) : (
        <div className="mt-8">
          <Button className="w-full" onClick={handleSignIn} disabled={busy}>
            {busy ? 'Opening Google…' : 'Continue with Google'}
          </Button>
          <Notice>{error}</Notice>
        </div>
      )}
    </div>
  )
}
