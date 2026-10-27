import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Seo from '../components/Seo.jsx'
import { useAuth } from '../context/Auth.jsx'
import { useUi } from '../context/Ui.jsx'

export default function ResetPassword() {
  const { token } = useParams()
  const { resetPassword } = useAuth()
  const { toast } = useUi()
  const navigate = useNavigate()

  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    if (password !== passwordConfirm) return setError('The two passwords do not match.')
    setBusy(true)
    setError('')
    try {
      await resetPassword(token, { password, passwordConfirm })
      toast('Your password is changed. You are logged in.', 'success')
      navigate('/', { replace: true })
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <div className="page auth">
      <Seo title="Choose a new password" description="Choose a new password for your Ma’at account." path="/reset-password" noindex />
      <div className="auth-panel inscribed">
        <h1>Choose a new password</h1>
        <form className="form" onSubmit={submit}>
          {error && (
            <div className="notice notice-error" role="alert">
              {error} <Link to="/forgot-password">Ask for a new link</Link>
            </div>
          )}
          <div className="field">
            <label htmlFor="password">New password</label>
            <input id="password" type="password" className="input" autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
            <span className="field-hint">At least 8 characters.</span>
          </div>
          <div className="field">
            <label htmlFor="confirm">Repeat the new password</label>
            <input id="confirm" type="password" className="input" autoComplete="new-password" required value={passwordConfirm} onChange={(e) => setPasswordConfirm(e.target.value)} />
          </div>
          <button className="btn" disabled={busy}>
            {busy ? 'Saving' : 'Save the new password'}
          </button>
        </form>
      </div>
    </div>
  )
}
