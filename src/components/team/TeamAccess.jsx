import { createContext, useContext, useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import Button from '../ui/Button.jsx'
import Notice from '../ui/Notice.jsx'
import { useAuth } from '../auth/AuthProvider.jsx'
import { ensureOwnerMember, getMembership } from '../../lib/team.js'
import { team as copy } from '../../data/team.js'

const TeamContext = createContext(null)

// The signed-in person's team entry: { email, name, role }.
export function useTeamMember() {
  return useContext(TeamContext)
}

const checking = <p className="text-sm text-white/50">Checking sign-in…</p>

// Layout route for the team portal: Google sign-in, then child pages only for the owner and for
// emails listed at /admin/team. This only decides what to show; firestore.rules protect the data.
export default function TeamAccess() {
  const { configured, user, loading, isOwner, signIn, signOut } = useAuth()
  const [access, setAccess] = useState({ state: 'checking' }) // checking | member | denied | error
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!user) return
    let current = true
    setAccess({ state: 'checking' })
    const lookup = isOwner ? ensureOwnerMember(user) : getMembership(user.email)
    lookup.then(
      (member) => current && setAccess(member ? { state: 'member', member } : { state: 'denied' }),
      () => current && setAccess({ state: 'error' }),
    )
    return () => { current = false }
  }, [user, isOwner])

  async function handleSignIn() {
    setBusy(true)
    setError(await signIn())
    setBusy(false)
  }

  if (!configured) return <Notice>Firebase isn't configured yet. Fill in src/data/firebase.js (see README → Owner login).</Notice>
  if (loading) return checking

  if (!user) {
    return (
      <div className="glass mx-auto mt-8 max-w-md p-8">
        <h1 className="text-3xl font-bold">{copy.signInTitle}</h1>
        <p className="mt-3 text-white/70">{copy.signInText}</p>
        <Button className="mt-8 w-full" onClick={handleSignIn} disabled={busy}>
          {busy ? 'Opening Google…' : copy.signInButton}
        </Button>
        <Notice>{error}</Notice>
      </div>
    )
  }

  if (access.state === 'checking') return checking

  if (access.state !== 'member') {
    return (
      <div className="glass mx-auto mt-8 max-w-md space-y-4 p-8 text-white/70">
        <h1 className="text-3xl font-bold text-white">{copy.signInTitle}</h1>
        {access.state === 'denied' ? (
          <>
            <p>Signed in as <span className="text-white">{user.email}</span>, {copy.notOnTeam}</p>
            <p>{copy.join.offer} <a href="/team/join" className="text-white underline">{copy.join.offerLink}</a></p>
          </>
        ) : (
          <p>{copy.checkFailed}</p>
        )}
        <Button variant="secondary" onClick={signOut}>Sign out</Button>
      </div>
    )
  }

  return <TeamContext.Provider value={access.member}><Outlet /></TeamContext.Provider>
}
