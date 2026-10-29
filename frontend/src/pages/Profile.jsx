import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Avatar } from '../components/Layout.jsx'
import Seo from '../components/Seo.jsx'
import { ErrorState, Loading } from '../components/States.jsx'
import VerdictBadge, { Difficulty } from '../components/VerdictBadge.jsx'
import { useAuth } from '../context/Auth.jsx'
import { useUi } from '../context/Ui.jsx'
import { api } from '../lib/api.js'
import { formatDateTime } from '../lib/format.js'
import { useAsync } from '../lib/hooks.js'
import { ROLE_LABELS, isAdmin } from '../lib/roles.js'
import { LANGUAGES } from '../lib/verdicts.js'

const AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const AVATAR_MAX = 2 * 1024 * 1024

const memberSince = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' })

function Meter({ value, total, label }) {
  return (
    <div className="meter" role="img" aria-label={`${label}: ${value} of ${total}`}>
      <span style={{ width: total ? `${(100 * value) / total}%` : 0 }} />
    </div>
  )
}

function Overview() {
  const { user } = useAuth()
  const { data, error, loading, reload } = useAsync((signal) => api('/users/me/stats', { signal }), [])

  if (loading && !data) return <Loading label="Loading your progress" />
  if (error) return <ErrorState error={error} onRetry={reload} />

  const stats = data.data.stats
  const rate = stats.submissions ? Math.round((100 * stats.accepted) / stats.submissions) : 0
  const language = stats.languages[0] && LANGUAGES[stats.languages[0].language]?.label

  return (
    <>
      <section className="panel profile-hero">
        <Avatar user={user} large />
        <div>
          <h2 className="profile-name">{user.name}</h2>
          <p className="muted">
            Member since {memberSince.format(new Date(stats.memberSince))}
            {isAdmin(user) && ` · ${ROLE_LABELS[user.role]}`}
          </p>
        </div>
      </section>

      <div className="profile-grid">
        <section className="panel" aria-labelledby="progress-title">
          <h2 id="progress-title" className="panel-title">Progress</h2>
          <p className="stat-big">
            <strong>{stats.solved}</strong> of {stats.total} problems solved
          </p>
          <Meter value={stats.solved} total={stats.total} label="Problems solved" />
          <ul className="stat-levels">
            {Object.entries(stats.progress).map(([level, { solved, total }]) => (
              <li key={level}>
                <Difficulty level={level} />
                <Meter value={solved} total={total} label={`${level} problems solved`} />
                <span className="muted">
                  {solved} / {total}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="panel" aria-labelledby="numbers-title">
          <h2 id="numbers-title" className="panel-title">In numbers</h2>
          <dl className="stat-grid">
            <div>
              <dt>Submissions</dt>
              <dd>{stats.submissions}</dd>
            </div>
            <div>
              <dt>Accepted</dt>
              <dd>{rate}%</dd>
            </div>
            <div>
              <dt>Tried, not solved</dt>
              <dd>{stats.tried}</dd>
            </div>
            <div>
              <dt>Main language</dt>
              <dd>{language || '—'}</dd>
            </div>
          </dl>
        </section>
      </div>

      <section className="panel" aria-labelledby="recent-title">
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 id="recent-title" className="panel-title" style={{ margin: 0 }}>
            Latest submissions
          </h2>
          {stats.recent.length > 0 && <Link to="/submissions">All submissions</Link>}
        </div>
        {stats.recent.length === 0 ? (
          <p className="muted">
            Nothing yet. <Link to="/problems">Pick a problem</Link> to start.
          </p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Problem</th>
                  <th scope="col">Verdict</th>
                  <th scope="col">Language</th>
                  <th scope="col">Sent</th>
                </tr>
              </thead>
              <tbody>
                {stats.recent.map((submission) => (
                  <tr key={submission._id}>
                    <td>
                      {submission.problemId ? <Link to={`/problems/${submission.problemId.slug}`}>{submission.problemId.title}</Link> : 'Deleted problem'}
                    </td>
                    <td>
                      <Link to={`/submissions/${submission._id}`}>
                        <VerdictBadge status={submission.status} />
                      </Link>
                    </td>
                    <td>{LANGUAGES[submission.language]?.label}</td>
                    <td className="muted">{formatDateTime(submission.submittedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}

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

function DeleteAccount() {
  const { logout } = useAuth()
  const { toast, confirm } = useUi()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    const ok = await confirm('Your account, photo and submissions will be deleted in 30 days. Log in before then to keep them.', {
      confirmLabel: 'Delete my account',
      title: 'Delete your account?',
    })
    if (!ok) return
    setBusy(true)
    setError('')
    try {
      await api('/users/me', { method: 'DELETE', body: { password } })
      await logout()
      toast('Your account will be deleted in 30 days. Log in before then to keep it.', 'success')
      navigate('/')
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <section className="panel">
      <h2 className="panel-title">Delete account</h2>
      <form className="form" onSubmit={submit}>
        {error && <div className="notice notice-error" role="alert">{error}</div>}
        <p className="muted">Your account is kept for 30 days in case you change your mind, then deleted for good.</p>
        <div className="field">
          <label htmlFor="delete-password">Password</label>
          <input id="delete-password" type="password" className="input" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <button className="btn btn-danger" disabled={busy}>
          {busy ? 'Deleting' : 'Delete my account'}
        </button>
      </form>
    </section>
  )
}

export default function Profile() {
  return (
    <div className="page">
      <Seo title="Your profile" description="Your progress and account on Ma’at." path="/profile" noindex />
      <header className="page-head">
        <div>
          <h1>Your profile</h1>
          <p>Your progress so far, and your account settings.</p>
        </div>
      </header>
      <div className="stack" style={{ gap: 32 }}>
        <Overview />
      </div>
      <h2 className="section-title">Settings</h2>
      <div className="profile-grid">
        <div className="stack">
          <Details />
          <Photo />
        </div>
        <div className="stack">
          <Password />
          <DeleteAccount />
        </div>
      </div>
    </div>
  )
}
