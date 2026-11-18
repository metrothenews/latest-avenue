import { useEffect, useState } from 'react'
import Button from '../../components/ui/Button.jsx'
import TextField from '../../components/ui/TextField.jsx'
import Notice from '../../components/ui/Notice.jsx'
import CrewAdmin from '../../components/admin/CrewAdmin.jsx'
import AssignmentsAdmin from '../../components/admin/AssignmentsAdmin.jsx'
import { addMember, blockMember, listBlocked, listMembers, removeMember, saveWelcome, getWelcome, unblockMember } from '../../lib/team.js'
import { isEmail } from '../../lib/validation.js'
import { shortDate } from '../../lib/drive.js'
import { team as copy } from '../../data/team.js'

const emptyMember = { email: '', name: '', role: '' }

// /admin/team ("Admin" in the header and on the dashboard): who may open the team portal (/team), and the welcome message they see.
export default function Team() {
  const [members, setMembers] = useState(null) // null while loading
  const [blocked, setBlocked] = useState([]) // emails removed for good
  const [loadError, setLoadError] = useState('')
  const [form, setForm] = useState(emptyMember)
  const [emailError, setEmailError] = useState('')
  const [confirmRemove, setConfirmRemove] = useState('')
  const [welcome, setWelcome] = useState({ heading: '', message: '' })
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')

  useEffect(() => {
    Promise.all([listMembers(), getWelcome(), listBlocked()])
      .then(([list, saved, out]) => {
        setMembers(list)
        setBlocked(out)
        if (saved) setWelcome({ heading: saved.heading ?? '', message: saved.message ?? '' })
      })
      .catch((err) => setLoadError(`Couldn't load the team: ${err.message}`))
  }, [])

  async function act(fn, failure) {
    setBusy(true)
    setStatus('')
    try {
      await fn()
    } catch (err) {
      setStatus(`${failure}: ${err.message}`)
    } finally {
      setBusy(false)
    }
  }

  function add(e) {
    e.preventDefault()
    if (!isEmail(form.email)) return setEmailError('Enter a full email address.')
    setEmailError('')
    act(async () => {
      const member = await addMember(form)
      setMembers((list) => [...list.filter((m) => m.email !== member.email), member].sort((a, b) => a.email.localeCompare(b.email)))
      setForm(emptyMember)
      setStatus(`${member.email} can now open the team portal.`)
    }, "Couldn't add them")
  }

  // Someone who signed themselves up is also blocked, or they could simply sign up again.
  const remove = (email, signedUp) => act(async () => {
    if (signedUp) {
      await blockMember(email)
      setBlocked((list) => [...list.filter((b) => b.email !== email), { email }].sort((a, b) => a.email.localeCompare(b.email)))
    } else await removeMember(email)
    setMembers((list) => list.filter((m) => m.email !== email))
    setConfirmRemove('')
    setStatus(signedUp ? `${email} has been removed and can't sign up again.` : `${email} can no longer open the team portal.`)
  }, "Couldn't remove them")
  const unblock = (email) => act(async () => {
    await unblockMember(email)
    setBlocked((list) => list.filter((b) => b.email !== email))
    setStatus(`${email} can sign up again.`)
  }, "Couldn't unblock them")

  const saveMessage = (e) => {
    e.preventDefault()
    act(async () => {
      await saveWelcome(welcome)
      setStatus('Welcome message saved.')
    }, "Couldn't save the message")
  }

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value })

  return (
    <div>
      <h1 className="text-4xl font-extrabold tracking-tight">Admin</h1>
      <p className="mt-3 max-w-2xl text-white/60">
        People listed here can sign in to the team portal at <a href="/team" className="underline">/team</a> with their Google account. You always have access. Anyone can also sign themselves up at <a href="/team/join" className="underline">/team/join</a>: they get access straight away and appear here marked "Signed up", and you can remove anyone you don't approve of.
      </p>
      {loadError && <Notice>{loadError}</Notice>}
      <Notice>{status}</Notice>

      <section className="mt-10">
        <h2 className="text-2xl font-semibold">Members</h2>
        {members === null && !loadError && <p className="mt-4 text-sm text-white/50">Loading…</p>}
        {members?.length === 0 && <p className="mt-4 text-sm text-white/50">Nobody has been added yet.</p>}
        {members?.length > 0 && (
          <ul className="glass mt-4 divide-y divide-white/10">
            {members.map((m) => (
              <li key={m.email} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-5 py-4 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{m.name || m.email}{m.signedUp && <span className="ml-2 rounded-full border border-white/20 px-2 py-0.5 text-xs font-normal text-white/70">Signed up</span>}</p>
                  <p className="truncate text-white/50">
                    {[m.name && m.email, m.role, m.addedAt && `added ${shortDate(m.addedAt)}`].filter(Boolean).join(' · ')}
                  </p>
                </div>
                {m.owner ? (
                  <span className="text-white/40">You</span>
                ) : confirmRemove === m.email ? (
                  <span className="text-white/60">
                    {m.signedUp ? 'Remove and block them?' : 'Remove their access?'}{' '}
                    <button type="button" className="text-white underline disabled:opacity-50" onClick={() => remove(m.email, m.signedUp)} disabled={busy}>Remove</button>{' · '}
                    <button type="button" className="hover:text-white" onClick={() => setConfirmRemove('')}>Cancel</button>
                  </span>
                ) : (
                  <button type="button" className="text-white/40 hover:text-white disabled:opacity-50" onClick={() => setConfirmRemove(m.email)} disabled={busy}>Remove</button>
                )}
              </li>
            ))}
          </ul>
        )}

        {blocked.length > 0 && (
          <>
            <h3 className="mt-8 text-lg font-semibold">Blocked</h3>
            <p className="mt-1 text-sm text-white/60">Removed after signing up. These emails can't sign up again.</p>
            <ul className="glass mt-3 divide-y divide-white/10">
              {blocked.map((b) => (
                <li key={b.email} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-5 py-3 text-sm">
                  <p className="min-w-0 break-all text-white/70">{b.email}</p>
                  <button type="button" className="text-white/40 hover:text-white disabled:opacity-50" onClick={() => unblock(b.email)} disabled={busy}>Unblock</button>
                </li>
              ))}
            </ul>
          </>
        )}

        <form onSubmit={add} noValidate className="glass mt-6 grid gap-4 p-6 md:grid-cols-3">
          <TextField id="member-email" type="email" label="Google account email" showLabel value={form.email} onChange={set('email')} error={emailError} autoComplete="off" />
          <TextField id="member-name" label="Name (optional)" showLabel value={form.name} onChange={set('name')} autoComplete="off" />
          <TextField id="member-role" label="Role (optional)" showLabel value={form.role} onChange={set('role')} autoComplete="off" />
          <div className="md:col-span-3">
            <Button type="submit" disabled={busy || members === null}>Add to team</Button>
          </div>
        </form>
      </section>

      <CrewAdmin />

      <section className="mt-14">
        <h2 className="text-2xl font-semibold">Welcome message</h2>
        <p className="mt-2 text-sm text-white/60">What everyone sees when they open the portal.</p>
        <form onSubmit={saveMessage} className="glass mt-4 grid max-w-3xl gap-4 p-6">
          <TextField id="welcome-heading" label="Heading" showLabel placeholder={copy.defaultHeading} value={welcome.heading} onChange={(e) => setWelcome({ ...welcome, heading: e.target.value })} />
          <TextField id="welcome-message" as="textarea" rows={6} label="Message" showLabel value={welcome.message} onChange={(e) => setWelcome({ ...welcome, message: e.target.value })} />
          <div>
            <Button type="submit" disabled={busy || members === null}>Save message</Button>
          </div>
        </form>
      </section>

      <AssignmentsAdmin />
    </div>
  )
}
