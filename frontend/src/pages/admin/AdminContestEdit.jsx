import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ErrorState, Loading } from '../../components/States.jsx'
import { useUi } from '../../context/Ui.jsx'
import { api } from '../../lib/api.js'
import { toInputDateTime } from '../../lib/format.js'
import { useAsync } from '../../lib/hooks.js'

const LABELS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

function ContestForm({ contest, problems, isNew }) {
  const navigate = useNavigate()
  const { toast } = useUi()

  // Once a contest has started, only its title and end time can change
  const locked = !isNew && new Date(contest.startsAt) <= new Date()

  const [title, setTitle] = useState(contest?.title || '')
  const [startsAt, setStartsAt] = useState(toInputDateTime(contest?.startsAt))
  const [endsAt, setEndsAt] = useState(toInputDateTime(contest?.endsAt))
  const [rows, setRows] = useState(
    contest?.problems?.length
      ? contest.problems.map((p) => ({ problemId: p._id, label: p.label }))
      : [{ problemId: '', label: 'A' }],
  )
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const setRow = (index, changes) => setRows(rows.map((row, i) => (i === index ? { ...row, ...changes } : row)))
  const addRow = () => setRows([...rows, { problemId: '', label: LABELS[rows.length] || '' }])
  const removeRow = (index) => setRows(rows.filter((_, i) => i !== index))

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    if (new Date(endsAt) <= new Date(startsAt)) return setError('The contest must end after it starts.')
    if (rows.some((row) => !row.problemId)) return setError('Choose a problem for every row, or remove the empty ones.')

    const body = locked
      ? { title, endsAt: new Date(endsAt).toISOString() }
      : {
          title,
          startsAt: new Date(startsAt).toISOString(),
          endsAt: new Date(endsAt).toISOString(),
          problems: rows.map((row) => ({ problemId: row.problemId, label: row.label })),
        }

    setBusy(true)
    try {
      if (isNew) {
        await api('/contests', { method: 'POST', body })
        toast('Contest scheduled.', 'success')
        navigate('/admin/contests', { replace: true })
      } else {
        await api(`/contests/${contest._id}`, { method: 'PATCH', body })
        toast('Contest saved.', 'success')
      }
    } catch (err) {
      setError(err.message)
    }
    setBusy(false)
  }

  return (
    <form className="form form-wide" onSubmit={submit}>
      {error && <div className="notice notice-error" role="alert">{error}</div>}
      {locked && <div className="notice">This contest has started, so its problems and start time are fixed.</div>}

      <div className="field">
        <label htmlFor="title">Title</label>
        <input id="title" className="input" required maxLength={100} value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>

      <div className="form-grid">
        <div className="field">
          <label htmlFor="starts">Starts</label>
          <input id="starts" type="datetime-local" className="input" required disabled={locked} value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="ends">Ends</label>
          <input id="ends" type="datetime-local" className="input" required value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
        </div>
      </div>
      <p className="field-hint">Times are in your local time zone.</p>

      <fieldset style={{ border: 0, padding: 0, margin: 0 }} disabled={locked}>
        <legend style={{ fontWeight: 500, marginBottom: 12 }}>Problems</legend>
        {rows.map((row, index) => (
          <div className="problem-picker" key={index}>
            <input
              className="input"
              aria-label={`Label for row ${index + 1}`}
              maxLength={4}
              required
              value={row.label}
              onChange={(e) => setRow(index, { label: e.target.value })}
            />
            <select className="select" aria-label={`Problem for row ${index + 1}`} value={row.problemId} onChange={(e) => setRow(index, { problemId: e.target.value })}>
              <option value="">Choose a problem</option>
              {problems.map((problem) => (
                <option key={problem._id} value={problem._id}>
                  {problem.title}
                  {problem.visible ? '' : ' (hidden)'}
                </option>
              ))}
            </select>
            <button type="button" className="btn btn-danger btn-small" onClick={() => removeRow(index)} disabled={rows.length === 1}>
              Remove
            </button>
          </div>
        ))}
        <button type="button" className="btn btn-quiet btn-small" onClick={addRow}>
          Add a problem
        </button>
      </fieldset>

      <div className="row">
        <button className="btn" disabled={busy}>
          {busy ? 'Saving' : isNew ? 'Schedule contest' : 'Save changes'}
        </button>
        <Link to="/admin/contests" className="btn btn-quiet">
          Back to contests
        </Link>
      </div>
    </form>
  )
}

export default function AdminContestEdit() {
  const { id } = useParams()
  const isNew = !id

  const contest = useAsync((signal) => (isNew ? Promise.resolve(null) : api(`/contests/${id}`, { signal })), [id])
  const problems = useAsync((signal) => api('/admin/problems?limit=100&sort=title', { signal }), [])

  if ((contest.loading && !isNew) || problems.loading) return <Loading />
  if (contest.error) return <ErrorState error={contest.error} onRetry={contest.reload} />
  if (problems.error) return <ErrorState error={problems.error} onRetry={problems.reload} />

  return (
    <>
      <header className="page-head">
        <div>
          <h1>{isNew ? 'New contest' : contest.data.data.contest.title}</h1>
          <p>Contestants see the problems when the contest starts.</p>
        </div>
      </header>
      <ContestForm
        key={id || 'new'}
        contest={contest.data?.data.contest}
        problems={problems.data.data.problems}
        isNew={isNew}
      />
    </>
  )
}
