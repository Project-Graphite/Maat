import { useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import Seo from '../components/Seo.jsx'
import { useAuth } from '../context/Auth.jsx'
import { safeNext } from '../lib/format.js'

export default function Signup() {
  const { user, signup } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = safeNext(params.get('next'))

  const [form, setForm] = useState({ name: '', email: '', password: '', passwordConfirm: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (user) return <Navigate to={next} replace />

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value })
  const mismatch = form.passwordConfirm && form.password !== form.passwordConfirm

  const submit = async (event) => {
    event.preventDefault()
    if (mismatch) return setError('The two passwords do not match.')
    setBusy(true)
    setError('')
    try {
      await signup(form)
      navigate(next, { replace: true })
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <div className="page auth">
      <Seo title="Create an account" description="Create a free Ma’at account to submit solutions and join contests." path="/signup" noindex />
      <div className="auth-panel inscribed">
        <h1>Create an account</h1>
        <p className="muted">One account for problems, contests and your submission history.</p>
        <form className="form" onSubmit={submit}>
          {error && (
            <div className="notice notice-error" role="alert">
              {error}
            </div>
          )}
          <div className="field">
            <label htmlFor="name">Name</label>
            <input id="name" className="input" autoComplete="nickname" required minLength={3} maxLength={30} value={form.name} onChange={set('name')} />
            <span className="field-hint">3 to 30 characters. Shown on contest standings.</span>
          </div>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" className="input" autoComplete="email" required value={form.email} onChange={set('email')} />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input id="password" type="password" className="input" autoComplete="new-password" required minLength={8} value={form.password} onChange={set('password')} />
            <span className="field-hint">At least 8 characters.</span>
          </div>
          <div className="field">
            <label htmlFor="confirm">Repeat the password</label>
            <input id="confirm" type="password" className="input" autoComplete="new-password" required value={form.passwordConfirm} onChange={set('passwordConfirm')} />
            {mismatch && <span className="field-error">The two passwords do not match.</span>}
          </div>
          <p className="muted small">
            By creating an account you agree to the <Link to="/terms">terms of use</Link> and the{' '}
            <Link to="/privacy">privacy policy</Link>.
          </p>
          <button className="btn" disabled={busy}>
            {busy ? 'Creating your account' : 'Create account'}
          </button>
        </form>
        <p className="auth-switch">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </div>
    </div>
  )
}
