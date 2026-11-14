import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import Button from '../components/ui/Button.jsx'
import Notice from '../components/ui/Notice.jsx'
import { useAuth } from '../components/auth/AuthProvider.jsx'
import { getCrewMember } from '../lib/crew.js'
import { getMembership } from '../lib/team.js'
import { crew as copy } from '../data/crew.js'

// /team/crew: Google sign-in for the crew. An email on the crew list (Crew, at /admin/team) goes
// on to its welcome; the owner and the team go straight to the boards; anyone else is told who to
// ask. This only decides what to show; firestore.rules protect the data.
export default function CrewLogin() {
  const { configured, user, loading, isOwner, signIn, signOut } = useAuth()
  const [access, setAccess] = useState('checking') // checking | crew | team | unknown | error
  const [attempt, setAttempt] = useState(0)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!user) return
    let current = true
    setAccess('checking')
    getCrewMember(user.email)
      .then(async (member) => (member ? 'crew' : isOwner || (await getMembership(user.email)) ? 'team' : 'unknown'))
      .then((found) => current && setAccess(found), () => current && setAccess('error'))
    return () => { current = false }
  }, [user, isOwner, attempt])

  async function handleSignIn() {
    setBusy(true)
    setError(await signIn())
    setBusy(false)
  }

  if (user && access === 'crew') return <Navigate to="/team/note/welcome" replace />
  if (user && access === 'team') return <Navigate to="/team/note/home" replace />

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="glass w-full max-w-md p-8">
        <h1 className="text-3xl font-bold">{copy.loginTitle}</h1>
        {!configured ? (
          <Notice>Firebase isn't configured yet. Fill in src/data/firebase.js (see README → Owner login).</Notice>
        ) : loading || (user && access === 'checking') ? (
          <p className="mt-6 text-sm text-white/50">{copy.checking}</p>
        ) : !user ? (
          <>
            <p className="mt-3 text-white/70">{copy.loginText}</p>
            <Button className="mt-8 w-full" onClick={handleSignIn} disabled={busy}>{busy ? 'Opening Google…' : copy.loginButton}</Button>
            <Notice>{error}</Notice>
          </>
        ) : access === 'error' ? (
          <>
            <p className="mt-3 text-white/70">{copy.checkFailed}</p>
            <Button className="mt-8 w-full" variant="secondary" onClick={() => setAttempt((n) => n + 1)}>{copy.tryAgain}</Button>
          </>
        ) : (
          <>
            <p className="mt-3 text-white/70">
              {copy.sorry('\u0000').split('\u0000')[0]}
              <a href={`mailto:${copy.contactEmail}`} className="text-white underline">{copy.contactEmail}</a>
              {copy.sorry('\u0000').split('\u0000')[1]}
            </p>
            <p className="mt-3 break-words text-sm text-white/40">{user.email}</p>
            <Button className="mt-8 w-full" variant="secondary" onClick={signOut}>{copy.differentEmail}</Button>
          </>
        )}
      </div>
    </main>
  )
}
