import { Link, useSearchParams } from 'react-router-dom'
import Pagination from '../components/Pagination.jsx'
import Seo from '../components/Seo.jsx'
import { EmptyState, ErrorState, Loading } from '../components/States.jsx'
import { api, query } from '../lib/api.js'
import { formatDateTime } from '../lib/format.js'
import { useAsync } from '../lib/hooks.js'

const LIMIT = 20
const TABS = [
  ['', 'All'],
  ['running', 'Running'],
  ['upcoming', 'Upcoming'],
  ['ended', 'Ended'],
]

export const ContestStatus = ({ status }) => (
  <span className={status === 'running' ? 'tag tag-gold' : 'tag'}>
    {status === 'running' ? 'Running now' : status === 'upcoming' ? 'Upcoming' : 'Ended'}
  </span>
)

export default function Contests() {
  const [params, setParams] = useSearchParams()
  const page = Number(params.get('page')) || 1
  const status = params.get('status') || ''

  const { data, error, loading, reload } = useAsync(
    (signal) => api(`/contests${query({ page, limit: LIMIT, status })}`, { signal }),
    [page, status],
  )
  const contests = data?.data.contests || []

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
      <Seo
        title="Contests"
        description="Timed programming contests with live standings. Solve as many problems as you can before the clock runs out."
        path="/contests"
      />
      <header className="page-head">
        <div>
          <h1>Contests</h1>
          <p>Solve as many problems as you can before the clock runs out.</p>
        </div>
      </header>

      <div className="toolbar">
        <div className="segmented" role="group" aria-label="Contest status">
          {TABS.map(([value, label]) => (
            <button key={label} aria-pressed={status === value} onClick={() => update({ status: value, page: '' })}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading && !data && <Loading label="Loading contests" />}
      {error && <ErrorState error={error} onRetry={reload} />}

      {data && contests.length === 0 && (
        <EmptyState title="No contests here">
          {status ? 'Try another tab.' : 'Contests show up here once they are scheduled.'}
        </EmptyState>
      )}

      {contests.length > 0 && (
        <>
          <ul className="contest-list">
            {contests.map((contest) => (
              <li key={contest._id}>
                <div>
                  <h3>
                    <Link to={`/contests/${contest._id}`}>{contest.title}</Link>
                  </h3>
                  <p className="muted small">
                    {formatDateTime(contest.startsAt)} to {formatDateTime(contest.endsAt)}
                  </p>
                </div>
                <ContestStatus status={contest.status} />
              </li>
            ))}
          </ul>
          <Pagination page={page} total={data.total} limit={LIMIT} onPage={(p) => update({ page: p > 1 ? String(p) : '' })} />
        </>
      )}
    </div>
  )
}
