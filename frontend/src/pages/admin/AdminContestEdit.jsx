import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ErrorState, Loading } from '../../components/States.jsx'
import { useUi } from '../../context/Ui.jsx'
import { api } from '../../lib/api.js'
import { toInputDateTime } from '../../lib/format.js'
import { useAsync } from '../../lib/hooks.js'

const LABELS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const START_OPTIONS = [
  ['none', 'Not scheduled'],
  ['at', 'At a set time'],
  ['now', 'Right now'],
]

function ContestForm({ contest, problems, isNew }) {
  const navigate = useNavigate()
  const { toast } = useUi()

  // Once a contest has started, only its title and duration can change
  const locked = Boolean(contest?.startsAt) && new Date(contest.startsAt) <= new Date()
  const minutes = contest?.startsAt ? (new Date(contest.endsAt) - new Date(contest.startsAt)) / 60000 : 120

  const [title, setTitle] = useState(contest?.title || '')
  const [start, setStart] = useState(contest?.startsAt ? 'at' : 'none')
  const [startsAt, setStartsAt] = useState(toInputDateTime(contest?.startsAt))
  const [hours, setHours] = useState(String(Math.floor(minutes / 60)))
  const [mins, setMins] = useState(String(Math.round(minutes % 60)))
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
    const duration = (Number(hours) * 60 + Number(mins)) * 60000
    if (start !== 'none' && !(duration > 0)) return setError('Set how long the contest lasts.')
    if (rows.some((row) => !row.problemId)) return setError('Choose a problem for every row, or remove the empty ones.')

    const begins = locked ? new Date(contest.startsAt) : start === 'now' ? new Date() : start === 'at' ? new Date(startsAt) : null
    const times = begins
      ? { startsAt: begins.toISOString(), endsAt: new Date(begins.getTime() + duration).toISOString() }
      : { startsAt: null, endsAt: null }
    const body = locked
      ? { title, endsAt: times.endsAt }
      : { title, ...times, problems: rows.map((row) => ({ problemId: row.problemId, label: row.label })) }

    setBusy(true)
    try {
      if (isNew) {
        await api('/contests', { method: 'POST', body })
        toast(start === 'none' ? 'Contest saved.' : start === 'now' ? 'Contest started.' : 'Contest scheduled.', 'success')
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
      {!locked && start === 'none' && <div className="notice">Only admins can see this contest until you give it a start time.</div>}

      <div className="field">
        <label htmlFor="title">Title</label>
        <input id="title" className="input" required maxLength={100} value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>

      {!locked && (
        <div className="field">
          <span id="start-label" className="label">Start</span>
          <div className="segmented" role="group" aria-labelledby="start-label" style={{ alignSelf: 'flex-start' }}>
            {START_OPTIONS.map(([value, label]) => (
              <button type="button" key={value} aria-pressed={start === value} onClick={() => setStart(value)}>
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {start !== 'none' && (
        <div className="form-grid">
          {start === 'at' && (
            <div className="field">
              <label htmlFor="starts">Starts</label>
              <input id="starts" type="datetime-local" className="input" required disabled={locked} value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
              <span className="field-hint">In your local time zone.</span>
            </div>
          )}
          <div className="field">
            <span id="duration-label" className="label">Duration</span>
            <div className="row" role="group" aria-labelledby="duration-label">
              <input type="number" className="input input-short" min={0} max={720} aria-label="Hours" value={hours} onChange={(e) => setHours(e.target.value)} />
              <span>h</span>
              <input type="number" className="input input-short" min={0} max={59} aria-label="Minutes" value={mins} onChange={(e) => setMins(e.target.value)} />
              <span>min</span>
            </div>
          </div>
        </div>
      )}

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
          {busy ? 'Saving' : locked ? 'Save changes' : start === 'now' ? 'Start contest' : start === 'at' ? 'Schedule contest' : 'Save contest'}
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
          <p>Contestants see the contest once it has a start time, and its problems when it starts.</p>
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
