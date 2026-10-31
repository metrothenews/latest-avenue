import { useState } from 'react'
import { Link } from 'react-router-dom'
import Button from '../ui/Button.jsx'
import TextField from '../ui/TextField.jsx'
import Notice from '../ui/Notice.jsx'
import { isEmail } from '../../lib/validation.js'

const COPY = {
  login: {
    heading: 'Welcome back.',
    submit: 'Log in',
    passwordPlaceholder: 'Password',
    footer: "Don't have an account?",
    footerLink: { to: '/signup', label: 'Sign up' },
  },
  signup: {
    heading: 'Start your climb.',
    submit: 'Create account',
    passwordPlaceholder: 'Password (6+ characters)',
    footer: 'Already have an account?',
    footerLink: { to: '/login', label: 'Log in' },
  },
}

// Shared by /login and /signup. Validates on the client; no backend yet.
export default function AuthForm({ mode, plan }) {
  const copy = COPY[mode]
  const [showEmail, setShowEmail] = useState(false)
  const [values, setValues] = useState({ email: '', password: '' })
  const [errors, setErrors] = useState({})
  const [notice, setNotice] = useState('')

  const update = (e) => setValues((v) => ({ ...v, [e.target.name]: e.target.value }))

  function validate() {
    const e = {}
    if (!isEmail(values.email)) e.email = 'Enter a valid email address.'
    if (mode === 'signup' && values.password.length < 6) e.password = 'Password must be at least 6 characters.'
    if (mode === 'login' && !values.password) e.password = 'Enter your password.'
    return e
  }

  function handleSubmit(event) {
    event.preventDefault()
    const found = validate()
    setErrors(found)
    if (Object.keys(found).length) return
    // TODO: send { email, password, plan } to the auth backend
    setNotice(`${copy.submit} isn't connected to a backend yet.`)
  }

  return (
    <div>
      <h1 className="text-3xl font-bold">{copy.heading}</h1>
      {plan && (
        <p className="mt-2 text-sm text-white/60">
          Selected plan: <span className="capitalize text-white">{plan}</span>
        </p>
      )}

      <div className="mt-8 space-y-3">
        <Button variant="secondary" className="w-full" onClick={() => setNotice("Google sign-in isn't connected yet.")}>
          Continue with Google
        </Button>

        <div className="flex items-center gap-3 text-xs text-white/40">
          <span className="h-px flex-1 bg-white/10" />
          or
          <span className="h-px flex-1 bg-white/10" />
        </div>

        {showEmail ? (
          <form onSubmit={handleSubmit} noValidate className="space-y-3">
            <TextField
              id="email"
              name="email"
              type="email"
              label="Email"
              placeholder="Email"
              autoComplete="email"
              autoFocus
              value={values.email}
              onChange={update}
              error={errors.email}
            />
            <TextField
              id="password"
              name="password"
              type="password"
              label="Password"
              placeholder={copy.passwordPlaceholder}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={values.password}
              onChange={update}
              error={errors.password}
            />
            <Button type="submit" className="w-full">{copy.submit}</Button>
            {mode === 'login' && (
              <Link to="/reset-password" className="block pt-1 text-center text-sm text-white/60 hover:text-white">
                Forgot your password?
              </Link>
            )}
          </form>
        ) : (
          <Button variant="secondary" className="w-full" onClick={() => setShowEmail(true)}>
            Continue with email
          </Button>
        )}
      </div>

      <Notice>{notice}</Notice>

      <p className="mt-6 text-sm text-white/60">
        {copy.footer}{' '}
        <Link to={copy.footerLink.to} className="text-white underline">{copy.footerLink.label}</Link>
      </p>
    </div>
  )
}
