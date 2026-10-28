import { useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Pagination from '../components/Pagination.jsx'
import Seo from '../components/Seo.jsx'
import { EmptyState, ErrorState, Loading } from '../components/States.jsx'
import VerdictBadge from '../components/VerdictBadge.jsx'
import { api, query } from '../lib/api.js'
import { formatDateTime } from '../lib/format.js'
import { useAsync } from '../lib/hooks.js'
import { LANGUAGES, STATUS_OPTIONS, isFinal } from '../lib/verdicts.js'

const LIMIT = 20

export default function Submissions() {
  const [params, setParams] = useSearchParams()
  const page = Number(params.get('page')) || 1
  const status = params.get('status') || ''

  const { data, error, loading, reload } = useAsync(
    (signal) => api(`/submissions${query({ page, limit: LIMIT, status })}`, { signal }),
    [page, status],
  )

  const submissions = data?.data.submissions || []
  const waiting = submissions.some((s) => !isFinal(s.status))

  // While something is still being judged, look again every few seconds
  useEffect(() => {
    if (!waiting) return undefined
    const timer = setInterval(reload, 4000)
    return () => clearInterval(timer)
  }, [waiting])

  const update = (changes) => {
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value)
      else next.delete(key)
    }
    setParams(next, { replace: true })
  }

  return (
    <div className="page">
      <Seo title="My submissions" description="Your submissions and their verdicts." path="/submissions" noindex />
      <header className="page-head">
        <div>
          <h1>My submissions</h1>
          <p>Every solution you have sent, newest first.</p>
        </div>
      </header>

      <div className="toolbar">
        <div className="field">
          <label htmlFor="status" className="sr-only">
            Filter by verdict
          </label>
          <select id="status" className="select" value={status} onChange={(e) => update({ status: e.target.value, page: '' })}>
            <option value="">All verdicts</option>
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading && !data && <Loading label="Loading submissions" />}
      {error && <ErrorState error={error} onRetry={reload} />}

      {data && submissions.length === 0 && (
        <EmptyState
          title={status ? 'No submissions with that verdict' : 'Nothing submitted yet'}
          action={
            !status && (
              <Link to="/problems" className="btn">
                Find a problem
              </Link>
            )
          }
        >
          {status ? 'Try another verdict.' : 'Your submissions show up here as soon as you send one.'}
        </EmptyState>
      )}

      {submissions.length > 0 && (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Sent</th>
                  <th scope="col">Problem</th>
                  <th scope="col">Language</th>
                  <th scope="col">Verdict</th>
                  <th scope="col">
                    <span className="sr-only">Open</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((s) => (
                  <tr key={s._id}>
                    <td>{formatDateTime(s.submittedAt)}</td>
                    <td>{s.problemId ? <Link to={`/problems/${s.problemId.slug}`}>{s.problemId.title}</Link> : 'Removed problem'}</td>
                    <td>{LANGUAGES[s.language]?.label || s.language}</td>
                    <td>
                      <VerdictBadge status={s.status} />
                    </td>
                    <td className="num">
                      <Link to={`/submissions/${s._id}`}>Details</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} total={data.total} limit={LIMIT} onPage={(p) => update({ page: p > 1 ? String(p) : '' })} />
        </>
      )}
    </div>
  )
}
