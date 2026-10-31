import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Section from '../../components/ui/Section.jsx'
import Button from '../../components/ui/Button.jsx'
import TextField from '../../components/ui/TextField.jsx'
import Notice from '../../components/ui/Notice.jsx'
import { fieldClass } from '../../components/ui/fieldStyles.js'
import { dealOptions } from '../../data/deals.js'
import { site } from '../../data/site.js'
import { isEmail } from '../../lib/validation.js'
import { submitForm } from '../../lib/submitForm.js'

const perks = [
  'A rollout plan built around your music and goals',
  "How we'd market and pitch your next single",
  'What a deal with latest avenue looks like',
  'Honest feedback, whether or not we sign you',
]

const empty = { name: '', artistName: '', email: '', link: '', deal: 'unsure', message: '' }

function validate(v) {
  const e = {}
  if (!v.name.trim()) e.name = 'Enter your name.'
  if (!v.artistName.trim()) e.artistName = 'Enter your artist name.'
  if (!isEmail(v.email)) e.email = 'Enter a valid email address.'
  if (!/^https?:\/\/\S+\.\S+/.test(v.link.trim())) e.link = 'Paste a full link, starting with https://'
  return e
}

export default function SubmitDemo() {
  const [params] = useSearchParams()
  const presetDeal = dealOptions.some((o) => o.value === params.get('deal')) ? params.get('deal') : 'unsure'
  const [values, setValues] = useState({ ...empty, deal: presetDeal })
  const [errors, setErrors] = useState({})
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')

  const update = (e) => setValues((v) => ({ ...v, [e.target.name]: e.target.value }))

  async function handleSubmit(event) {
    event.preventDefault()
    const found = validate(values)
    setErrors(found)
    setSendError('')
    if (Object.keys(found).length) return
    if (site.demoFormEndpoint) {
      setSending(true)
      try {
        await submitForm(site.demoFormEndpoint, { ...values, _subject: `New demo: ${values.artistName}` })
      } catch {
        setSendError(`Something went wrong sending your demo. Try again, or email us at ${site.supportEmail}.`)
        return
      } finally {
        setSending(false)
      }
    }
    setSent(true)
  }

  return (
    <Section id="submit" title="Submit a Demo">
      <div className="grid gap-10 md:grid-cols-2">
        <div>
          <h3 className="text-2xl font-semibold">Let's hear what you're working on.</h3>
          <p className="mt-4 text-white/70">
            Send us your music. If it's a fit, we'll set up a 30-minute call to talk through your goals and how we'd roll
            out your next release.
          </p>
          <ul className="mt-6 space-y-2 text-white/80">
            {perks.map((p) => <li key={p}>✓ {p}</li>)}
          </ul>
          <p className="mt-6 text-white/60">No pressure and no hard sell.</p>
        </div>

        <div className="glass p-6 md:p-8">
          {sent ? (
            <div role="status">
              <h4 className="text-xl font-semibold">Thanks, {values.artistName}.</h4>
              <p className="mt-3 text-white/70">
                We got your submission and will listen soon.
                {!site.demoFormEndpoint && " (Nothing is actually sent yet: the form isn't connected to a backend.)"}
              </p>
              <Button variant="secondary" className="mt-6" onClick={() => { setValues(empty); setSent(false) }}>
                Submit another
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              <TextField id="demo-name" name="name" label="Your name" showLabel autoComplete="name" value={values.name} onChange={update} error={errors.name} />
              <TextField id="demo-artist" name="artistName" label="Artist name" showLabel value={values.artistName} onChange={update} error={errors.artistName} />
              <TextField id="demo-email" name="email" type="email" label="Email" showLabel autoComplete="email" value={values.email} onChange={update} error={errors.email} />
              <TextField id="demo-link" name="link" type="url" label="Link to your music" showLabel placeholder="https://" value={values.link} onChange={update} error={errors.link} />
              <div>
                <label htmlFor="demo-deal" className="mb-1.5 block text-sm text-white/70">Deal you're interested in</label>
                <select id="demo-deal" name="deal" value={values.deal} onChange={update} className={fieldClass()}>
                  {dealOptions.map((o) => <option key={o.value} value={o.value} className="bg-neutral-900">{o.label}</option>)}
                </select>
              </div>
              <TextField id="demo-message" as="textarea" rows={4} name="message" label="Anything else? (optional)" showLabel value={values.message} onChange={update} />
              <Button type="submit" className="w-full" disabled={sending}>{sending ? 'Sending…' : 'Submit Your Music'}</Button>
              <Notice>{Object.keys(errors).length ? 'Fix the highlighted fields and try again.' : sendError}</Notice>
            </form>
          )}
        </div>
      </div>
    </Section>
  )
}
