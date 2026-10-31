import { useState } from 'react'
import { Link } from 'react-router-dom'
import Button from '../components/ui/Button.jsx'
import TextField from '../components/ui/TextField.jsx'
import { isEmail } from '../lib/validation.js'

export default function ResetPassword() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  function handleSubmit(event) {
    event.preventDefault()
    if (!isEmail(email)) return setError('Enter a valid email address.')
    setError('')
    // TODO: request a reset link from the backend
    setSent(true)
  }

  return (
    <div>
      <h1 className="text-3xl font-bold">Reset your password</h1>
      {sent ? (
        <p className="mt-6 text-white/70">
          If an account exists for <span className="text-white">{email}</span>, a reset link is on its way.
          (No email is actually sent until the backend is connected.)
        </p>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="mt-8 space-y-3">
          <TextField
            id="reset-email"
            type="email"
            label="Email address"
            placeholder="Enter your email"
            autoComplete="email"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={error}
          />
          <Button type="submit" className="w-full">Send reset link</Button>
        </form>
      )}
      <p className="mt-6 text-sm text-white/60">
        Remember your password? <Link to="/login" className="text-white underline">Log in</Link>
      </p>
    </div>
  )
}
