import { useState } from 'react'
import { Link } from 'react-router-dom'
import Seo from '../components/Seo.jsx'
import { api } from '../lib/api.js'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await api('/auth/forgot-password', { method: 'POST', body: { email } })
      setSent(true)
    } catch (err) {
      setError(err.message)
    }
    setBusy(false)
  }

  return (
    <div className="page auth">
      <Seo title="Reset your password" description="Get a link to reset your Ma’at password." path="/forgot-password" noindex />
      <div className="auth-panel inscribed">
        <h1>Reset your password</h1>
        {sent ? (
          <div className="stack-sm" style={{ marginTop: 24 }}>
            <div className="notice notice-success" role="status">
              If that email is registered, a reset link is on its way. It works for a short time only.
            </div>
            <Link to="/login">Back to log in</Link>
          </div>
        ) : (
          <>
            <p className="muted">Enter your email and we will send you a link to choose a new password.</p>
            <form className="form" onSubmit={submit}>
              {error && (
                <div className="notice notice-error" role="alert">
                  {error}
                </div>
              )}
              <div className="field">
                <label htmlFor="email">Email</label>
                <input id="email" type="email" className="input" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <button className="btn" disabled={busy}>
                {busy ? 'Sending' : 'Send the link'}
              </button>
            </form>
            <p className="auth-switch">
              Remembered it? <Link to="/login">Log in</Link>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
