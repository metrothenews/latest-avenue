import { useEffect, useState } from 'react'
import Button from '../components/ui/Button.jsx'
import Notice from '../components/ui/Notice.jsx'
import { useAuth } from '../components/auth/AuthProvider.jsx'
import { getMembership, getWelcome } from '../lib/team.js'
import { team as copy } from '../data/team.js'

const checking = <p className="text-sm text-white/50">Checking sign-in…</p>

// Team portal: Google sign-in, open only to the owner and to emails listed at /admin/team.
// The check here only decides what to show; Firestore's rules are what protect the content.
export default function Team() {
  const { configured, user, loading, isOwner, signIn, signOut } = useAuth()
  const [access, setAccess] = useState({ state: 'checking' }) // checking | member | denied | error
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!user) return
    let current = true
    setAccess({ state: 'checking' })
    async function check() {
      try {
        const member = isOwner ? { name: user.displayName } : await getMembership(user.email)
        if (!member) return current && setAccess({ state: 'denied' })
        const welcome = await getWelcome()
        if (current) setAccess({ state: 'member', member, welcome })
      } catch {
        if (current) setAccess({ state: 'error' })
      }
    }
    check()
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
          <p>Signed in as <span className="text-white">{user.email}</span>, {copy.notOnTeam}</p>
        ) : (
          <p>{copy.checkFailed}</p>
        )}
        <Button variant="secondary" onClick={signOut}>Sign out</Button>
      </div>
    )
  }

  const { member, welcome } = access
  const firstName = (member.name || user.displayName || '').trim().split(/\s+/)[0]
  return (
    <div>
      <h1 className="text-4xl font-extrabold tracking-tight">
        {welcome?.heading || copy.defaultHeading}{firstName && `, ${firstName}`}
      </h1>
      {member.role && <p className="mt-3 text-white/60">{member.role}</p>}
      <section className="glass mt-10 max-w-3xl p-8">
        <p className="whitespace-pre-line text-white/80">{welcome?.message || copy.defaultMessage}</p>
      </section>
    </div>
  )
}
