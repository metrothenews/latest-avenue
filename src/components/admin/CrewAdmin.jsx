import { useEffect, useState } from 'react'
import Button from '../ui/Button.jsx'
import TextField from '../ui/TextField.jsx'
import Notice from '../ui/Notice.jsx'
import { addCrewMember, byProjectThenName, listCrew, removeCrewMember } from '../../lib/crew.js'
import { isEmail } from '../../lib/validation.js'
import { crew } from '../../data/crew.js'

const empty = { firstName: '', lastName: '', project: '', role: '', phone: '', email: '' }
const copy = crew.admin

// The Crew section of /admin/team: the people who can sign in at /team/crew.
export default function CrewAdmin() {
  const [list, setList] = useState(null) // null while loading
  const [form, setForm] = useState(empty)
  const [errors, setErrors] = useState({})
  const [confirmRemove, setConfirmRemove] = useState('')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')

  useEffect(() => {
    listCrew().then(setList, (err) => setStatus(`Couldn't load the crew: ${err.message}`))
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
    const found = {}
    for (const key of ['firstName', 'lastName', 'project', 'role']) if (!form[key].trim()) found[key] = copy.required
    if (!isEmail(form.email)) found.email = copy.emailError
    setErrors(found)
    if (Object.keys(found).length) return
    act(async () => {
      const member = await addCrewMember(form)
      setList((all) => [...all.filter((m) => m.email !== member.email), member].sort(byProjectThenName))
      setForm(empty)
      setStatus(copy.added(member))
    }, "Couldn't add them")
  }

  const remove = (email) => act(async () => {
    await removeCrewMember(email)
    setList((all) => all.filter((m) => m.email !== email))
    setConfirmRemove('')
    setStatus(copy.removed(email))
  }, "Couldn't remove them")

  const field = (key, label, props = {}) => (
    <TextField id={`crew-${key}`} label={label} showLabel value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} error={errors[key]} autoComplete="off" {...props} />
  )

  return (
    <section className="mt-14">
      <h2 className="text-2xl font-semibold">{copy.title}</h2>
      <p className="mt-2 max-w-2xl text-sm text-white/60">{copy.text}</p>
      <Notice>{status}</Notice>
      {list === null && !status && <p className="mt-4 text-sm text-white/50">Loading…</p>}
      {list?.length === 0 && <p className="mt-4 text-sm text-white/50">{copy.empty}</p>}
      {list?.length > 0 && (
        <ul className="glass mt-4 divide-y divide-white/10">
          {list.map((m) => (
            <li key={m.email} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-5 py-4 text-sm">
              <div className="min-w-0">
                <p className="truncate font-semibold">{m.firstName} {m.lastName}</p>
                <p className="break-words text-white/50">{[m.role, m.project, m.email, m.phone].filter(Boolean).join(' · ')}</p>
              </div>
              {confirmRemove === m.email ? (
                <span className="text-white/60">
                  Remove them?{' '}
                  <button type="button" className="text-white underline disabled:opacity-50" onClick={() => remove(m.email)} disabled={busy}>Remove</button>{' · '}
                  <button type="button" className="hover:text-white" onClick={() => setConfirmRemove('')}>Cancel</button>
                </span>
              ) : (
                <button type="button" className="text-white/40 hover:text-white disabled:opacity-50" onClick={() => setConfirmRemove(m.email)} disabled={busy}>Remove</button>
              )}
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={add} noValidate className="glass mt-6 grid gap-4 p-6 md:grid-cols-3">
        {field('firstName', 'First name')}
        {field('lastName', 'Last name')}
        {field('project', 'Project')}
        {field('role', 'Role')}
        {field('phone', 'Phone number (optional)', { type: 'tel', inputMode: 'tel' })}
        {field('email', 'Google account email', { type: 'email' })}
        <div className="md:col-span-3">
          <Button type="submit" disabled={busy || list === null}>{copy.add}</Button>
        </div>
      </form>
    </section>
  )
}
