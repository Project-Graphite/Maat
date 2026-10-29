import { useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import Seo from '../components/Seo.jsx'
import { EmptyState, ErrorState, Loading } from '../components/States.jsx'
import { Difficulty, ProblemStatus } from '../components/VerdictBadge.jsx'
import { useAuth } from '../context/Auth.jsx'
import { api } from '../lib/api.js'
import { countdown, formatDateTime } from '../lib/format.js'
import { useAsync, useNow } from '../lib/hooks.js'
import { getSocket } from '../lib/socket.js'
import { ContestStatus } from './Contests.jsx'

function Standings({ contest }) {
  const { user } = useAuth()
  const id = contest._id
  const running = contest.status === 'running'

  const { data, error, loading, reload } = useAsync((signal) => api(`/contests/${id}/standings?limit=100`, { signal }), [id])

  // Live: the server says when the table changed, and a slow poll covers a lost connection
  useEffect(() => {
    if (!running) return undefined
    const timer = setInterval(reload, 30000)

    // Sockets need a login. Everyone else gets the slow poll
    let socket
    const watch = () => socket.emit('contest:watch', id, () => {})
    if (user) {
      socket = getSocket()
      socket.on('contest:update', reload)
      socket.on('connect', watch)
      if (socket.connected) watch()
    }
    return () => {
      clearInterval(timer)
      if (socket) {
        socket.off('contest:update', reload)
        socket.off('connect', watch)
        socket.emit('contest:unwatch', id)
      }
    }
  }, [id, running, user?._id])

  if (loading && !data) return <Loading label="Loading standings" />
  if (error) return <ErrorState error={error} onRetry={reload} />

  const rows = data.data.standings
  if (!rows.length) {
    return <EmptyState title="No one is on the board yet">Standings appear after the first submission is judged.</EmptyState>
  }

  return (
    <div className="table-wrap">
      <table className="table standings">
        <thead>
          <tr>
            <th scope="col">Rank</th>
            <th scope="col">Name</th>
            <th scope="col" className="num">
              Solved
            </th>
            <th scope="col" className="num">
              Penalty
            </th>
            {contest.problems.map((problem) => (
              <th scope="col" key={problem._id} className="num">
                {problem.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.userId} data-me={user?._id === row.userId}>
              <td>
                <span className="rank">{row.rank}</span>
              </td>
              <td>{row.name}</td>
              <td className="num">{row.solved}</td>
              <td className="num">{row.penaltyMinutes}</td>
              {contest.problems.map((problem) => {
                const cell = row.problems[problem._id]
                if (!cell) return <td key={problem._id} className="num muted">–</td>
                if (cell.solved) {
                  return (
                    <td key={problem._id} className="num cell-solved">
                      {cell.minute}
                      {cell.wrong > 0 && <span className="muted small"> (+{cell.wrong})</span>}
                    </td>
                  )
                }
                return (
                  <td key={problem._id} className="num cell-wrong">
                    −{cell.wrong}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function ContestDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const { data, error, loading, reload } = useAsync((signal) => api(`/contests/${id}`, { signal }), [id, user?._id])
  const now = useNow()

  // Problems are hidden until the start. Fetch again the moment the contest begins
  const loaded = data?.data.contest
  const started = loaded && now >= new Date(loaded.startsAt).getTime()
  const hidden = loaded && loaded.problems.length === 0
  useEffect(() => {
    if (started && hidden) reload()
  }, [started, hidden])

  if (loading && !data) return <div className="page"><Loading label="Loading the contest" /></div>
  if (error) return <div className="page"><ErrorState error={error} onRetry={reload} /></div>

  const contest = data.data.contest
  const starts = new Date(contest.startsAt).getTime()
  const ends = new Date(contest.endsAt).getTime()

  // The status from the server is only right at load time, so the clock decides after that
  const status = !contest.startsAt ? 'unscheduled' : now < starts ? 'upcoming' : now < ends ? 'running' : 'ended'
  const live = { ...contest, status }

  return (
    <div className="page">
      <Seo
        title={contest.title}
        description={`${contest.title}, a timed programming contest on Ma’at. ${formatDateTime(contest.startsAt)} to ${formatDateTime(contest.endsAt)}.`}
        path={`/contests/${contest._id}`}
      />
      <header className="page-head">
        <div>
          <h1>{contest.title}</h1>
          <p>{contest.startsAt ? `${formatDateTime(contest.startsAt)} to ${formatDateTime(contest.endsAt)}` : 'Not scheduled yet'}</p>
        </div>
        <div className="stack-sm" style={{ alignItems: 'flex-end' }}>
          <ContestStatus status={status} />
          {status === 'upcoming' && (
            <span className="countdown" aria-label="Time until the contest starts">
              Starts in {countdown(starts - now)}
            </span>
          )}
          {status === 'running' && (
            <span className="countdown" aria-label="Time left in the contest">
              {countdown(ends - now)} left
            </span>
          )}
        </div>
      </header>

      <div className="stack" style={{ gap: 48 }}>
        <section aria-labelledby="problems-title">
          <h2 id="problems-title" style={{ fontSize: 'var(--step-2)', marginBottom: 16 }}>
            Problems
          </h2>
          {contest.problems.length === 0 ? (
            <p className="muted">The problems are revealed when the contest starts.</p>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Label</th>
                    <th scope="col">Problem</th>
                    {user && <th scope="col">Status</th>}
                    <th scope="col">Difficulty</th>
                  </tr>
                </thead>
                <tbody>
                  {contest.problems.map((problem) => (
                    <tr key={problem._id}>
                      <td>
                        <span className="rank">{problem.label}</span>
                      </td>
                      <td>
                        <Link to={`/problems/${problem.slug}?contest=${contest._id}`}>{problem.title}</Link>
                      </td>
                      {user && (
                        <td>
                          <ProblemStatus status={problem.status} />
                        </td>
                      )}
                      <td>
                        <Difficulty level={problem.difficulty} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section aria-labelledby="standings-title">
          <h2 id="standings-title" style={{ fontSize: 'var(--step-2)', marginBottom: 8 }}>
            Standings
          </h2>
          <p className="muted small" style={{ marginBottom: 16 }}>
            Ranked by problems solved, then penalty minutes. Each cell shows the minute of the first accepted
            solution, with earlier wrong attempts in brackets. Each wrong attempt adds 20 minutes.
          </p>
          {status === 'upcoming' ? (
            <p className="muted">Standings open when the contest starts.</p>
          ) : (
            <Standings contest={live} />
          )}
        </section>
      </div>
    </div>
  )
}
