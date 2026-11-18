import { useEffect, useState } from 'react'
import Button from '../components/ui/Button.jsx'
import TextField from '../components/ui/TextField.jsx'
import Notice from '../components/ui/Notice.jsx'
import Logo from '../components/layout/Logo.jsx'
import { useAuth } from '../components/auth/AuthProvider.jsx'
import { getMembership, getRequest, isBlocked, requestToJoin } from '../lib/team.js'
import { team } from '../data/team.js'

const copy = team.join

// /team/join: team sign-up. Sign in with Google, give a name and (optionally) what you do, and
// a request goes to the owner. It gives no access until the owner approves it at /admin/team
// (declining it blocks that email). This page only decides what to show; firestore.rules
// decide what can be written.
export default function TeamJoin() {
  const { configured, user, loading, signIn, signOut } = useAuth()
  const [stage, setStage] = useState('checking') // checking | details | pending | member | blocked
  const [attempt, setAttempt] = useState(0)
  const [form, setForm] = useState({ name: '', role: '' })
  const [nameError, setNameError] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!user) return
    let current = true
    setStage('checking')
    setForm({ name: user.displayName ?? '', role: '' })
    Promise.all([getMembership(user.email), isBlocked(user.email), getRequest(user.email)]).then(
      ([member, blocked, request]) => current && setStage(member ? 'member' : blocked ? 'blocked' : request ? 'pending' : 'details'),
      () => current && setStage('details'),
    )
    return () => { current = false }
  }, [user, attempt])

  async function handleSignIn() {
    setBusy(true)
    setError(await signIn())
    setBusy(false)
  }
  async function join(e) {
    e.preventDefault()
    if (!form.name.trim()) return setNameError(copy.nameError)
    setNameError('')
    setBusy(true)
    setError('')
    try {
      await requestToJoin(user, form)
      setStage('pending')
    } catch (err) {
      setError(err.code === 'permission-denied' ? copy.blocked : copy.failed)
    } finally {
      setBusy(false)
    }
  }

  const account = user && (
    <p className="mt-6 text-sm text-white/50">
      {copy.signedInAs} <span className="break-all text-white/80">{user.email}</span>.{' '}
      <button type="button" className="underline hover:text-white" onClick={signOut}>{copy.other}</button>
    </p>
  )

  return (
    <main className="flex min-h-screen flex-col px-4 py-8">
      <Logo />
      <div className="glass m-auto w-full max-w-md p-8">
        {!configured ? (
          <Notice>Firebase isn't configured yet. Fill in src/data/firebase.js (see README → Owner login).</Notice>
        ) : loading || (user && stage === 'checking') ? (
          <p className="text-sm text-white/50">Checking sign-in…</p>
        ) : !user ? (
          <>
            <h1 className="text-3xl font-bold">{copy.title}</h1>
            <p className="mt-3 text-white/70">{copy.intro}</p>
            <Button className="mt-8 w-full" onClick={handleSignIn} disabled={busy}>{busy ? 'Opening Google…' : team.signInButton}</Button>
            <Notice>{error}</Notice>
          </>
        ) : stage === 'details' ? (
          <form onSubmit={join} noValidate>
            <h1 className="text-3xl font-bold">{copy.detailsTitle}</h1>
            <p className="mt-3 text-white/70">{copy.detailsText}</p>
            <div className="mt-6 grid gap-4">
              <TextField id="join-name" label={copy.name} showLabel value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={nameError} maxLength={80} autoComplete="name" />
              <TextField id="join-role" label={copy.role} showLabel value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} maxLength={80} autoComplete="organization-title" />
            </div>
            <Button type="submit" className="mt-6 w-full" disabled={busy}>{busy ? copy.joining : copy.submit}</Button>
            <Notice>{error}</Notice>
            {account}
          </form>
        ) : stage === 'blocked' ? (
          <>
            <h1 className="text-3xl font-bold">{copy.title}</h1>
            <p className="mt-3 text-white/70">{copy.blocked}</p>
            {account}
          </>
        ) : stage === 'pending' ? (
          <>
            <h1 className="text-3xl font-bold">{copy.pendingTitle}</h1>
            <p className="mt-3 text-white/70">{copy.pendingText}</p>
            <Button variant="secondary" className="mt-8 w-full" onClick={() => setAttempt((n) => n + 1)}>{copy.checkAgain}</Button>
            {account}
          </>
        ) : (
          <>
            <h1 className="text-3xl font-bold">{copy.title}</h1>
            <p className="mt-3 text-white/70">{copy.already}</p>
            <Button to="/team" className="mt-8 w-full">{copy.open}</Button>
            {account}
          </>
        )}
      </div>
    </main>
  )
}
