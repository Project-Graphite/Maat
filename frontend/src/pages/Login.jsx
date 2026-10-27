import { useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import Seo from '../components/Seo.jsx'
import { useAuth } from '../context/Auth.jsx'
import { safeNext } from '../lib/format.js'

export default function Login() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = safeNext(params.get('next'))

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (user) return <Navigate to={next} replace />

  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await login(email, password)
      navigate(next, { replace: true })
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <div className="page auth">
      <Seo title="Log in" description="Log in to Ma’at to submit solutions and join contests." path="/login" noindex />
      <div className="auth-panel inscribed">
        <h1>Log in</h1>
        <p className="muted">Welcome back. Your drafts are where you left them.</p>
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
          <div className="field">
            <label htmlFor="password">Password</label>
            <input id="password" type="password" className="input" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <button className="btn" disabled={busy}>
            {busy ? 'Logging in' : 'Log in'}
          </button>
          <Link to="/forgot-password">Forgot your password?</Link>
        </form>
        <p className="auth-switch">
          New here? <Link to={`/signup${params.get('next') ? `?next=${encodeURIComponent(next)}` : ''}`}>Create an account</Link>
        </p>
      </div>
    </div>
  )
}
