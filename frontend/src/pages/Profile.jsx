import { useRef, useState } from 'react'
import { Avatar } from '../components/Layout.jsx'
import Seo from '../components/Seo.jsx'
import { useAuth } from '../context/Auth.jsx'
import { useUi } from '../context/Ui.jsx'
import { api } from '../lib/api.js'

const AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const AVATAR_MAX = 2 * 1024 * 1024

function Details() {
  const { user, setUser } = useAuth()
  const { toast } = useUi()
  const [name, setName] = useState(user.name)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const res = await api('/users/me', { method: 'PATCH', body: { name } })
      setUser(res.data.user)
      toast('Name saved.', 'success')
    } catch (err) {
      setError(err.message)
    }
    setBusy(false)
  }

  return (
    <section className="panel">
      <h2 className="panel-title">Your details</h2>
      <form className="form" onSubmit={submit}>
        {error && <div className="notice notice-error" role="alert">{error}</div>}
        <div className="field">
          <label htmlFor="name">Name</label>
          <input id="name" className="input" required minLength={3} maxLength={30} value={name} onChange={(e) => setName(e.target.value)} />
          <span className="field-hint">Shown on contest standings.</span>
        </div>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" className="input" value={user.email} disabled />
        </div>
        <button className="btn" disabled={busy || name === user.name}>
          {busy ? 'Saving' : 'Save name'}
        </button>
      </form>
    </section>
  )
}

function Photo() {
  const { user, setUser } = useAuth()
  const { toast } = useUi()
  const input = useRef(null)
  const [busy, setBusy] = useState(false)

  const upload = async (event) => {
    const file = event.target.files[0]
    event.target.value = ''
    if (!file) return
    if (!AVATAR_TYPES.includes(file.type)) return toast('Choose a JPEG, PNG or WebP image.', 'error')
    if (file.size > AVATAR_MAX) return toast('The image must be 2 MB or smaller.', 'error')

    setBusy(true)
    try {
      const res = await api('/users/me/avatar', { method: 'PUT', rawBody: file, contentType: file.type })
      setUser(res.data.user)
      toast('Photo saved.', 'success')
    } catch (err) {
      toast(err.message, 'error')
    }
    setBusy(false)
  }

  const remove = async () => {
    setBusy(true)
    try {
      await api('/users/me/avatar', { method: 'DELETE' })
      setUser({ ...user, photo: undefined })
      toast('Photo removed.', 'success')
    } catch (err) {
      toast(err.message, 'error')
    }
    setBusy(false)
  }

  return (
    <section className="panel">
      <h2 className="panel-title">Photo</h2>
      <div className="row" style={{ gap: 24 }}>
        <Avatar user={user} large />
        <div className="stack-sm">
          <div className="row">
            <input ref={input} type="file" accept={AVATAR_TYPES.join(',')} onChange={upload} hidden />
            <button className="btn btn-quiet btn-small" disabled={busy} onClick={() => input.current.click()}>
              {user.photo ? 'Change photo' : 'Upload a photo'}
            </button>
            {user.photo && (
              <button className="btn btn-danger btn-small" disabled={busy} onClick={remove}>
                Remove
              </button>
            )}
          </div>
          <span className="field-hint">JPEG, PNG or WebP, up to 2 MB.</span>
        </div>
      </div>
    </section>
  )
}

function Password() {
  const { setUser } = useAuth()
  const { toast } = useUi()
  const [form, setForm] = useState({ passwordCurrent: '', password: '', passwordConfirm: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value })

  const submit = async (event) => {
    event.preventDefault()
    if (form.password !== form.passwordConfirm) return setError('The two new passwords do not match.')
    setBusy(true)
    setError('')
    try {
      const res = await api('/auth/update-password', { method: 'PATCH', body: form })
      setUser(res.data.user)
      setForm({ passwordCurrent: '', password: '', passwordConfirm: '' })
      toast('Password changed.', 'success')
    } catch (err) {
      setError(err.message)
    }
    setBusy(false)
  }

  return (
    <section className="panel">
      <h2 className="panel-title">Password</h2>
      <form className="form" onSubmit={submit}>
        {error && <div className="notice notice-error" role="alert">{error}</div>}
        <div className="field">
          <label htmlFor="current">Current password</label>
          <input id="current" type="password" className="input" autoComplete="current-password" required value={form.passwordCurrent} onChange={set('passwordCurrent')} />
        </div>
        <div className="field">
          <label htmlFor="new">New password</label>
          <input id="new" type="password" className="input" autoComplete="new-password" required minLength={8} value={form.password} onChange={set('password')} />
          <span className="field-hint">At least 8 characters.</span>
        </div>
        <div className="field">
          <label htmlFor="repeat">Repeat the new password</label>
          <input id="repeat" type="password" className="input" autoComplete="new-password" required value={form.passwordConfirm} onChange={set('passwordConfirm')} />
        </div>
        <button className="btn" disabled={busy}>
          {busy ? 'Saving' : 'Change password'}
        </button>
      </form>
    </section>
  )
}

export default function Profile() {
  const { user } = useAuth()
  return (
    <div className="page">
      <Seo title="Your account" description="Manage your Ma’at account." path="/profile" noindex />
      <header className="page-head">
        <div>
          <h1>Your account</h1>
          <p>{user.role === 'admin' ? 'You are an administrator.' : 'Update how you appear and keep your account safe.'}</p>
        </div>
      </header>
      <div className="profile-grid">
        <div className="stack">
          <Details />
          <Photo />
        </div>
        <Password />
      </div>
    </div>
  )
}
