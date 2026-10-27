import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Pagination from '../components/Pagination.jsx'
import Seo from '../components/Seo.jsx'
import { EmptyState, ErrorState, Loading } from '../components/States.jsx'
import { Difficulty } from '../components/VerdictBadge.jsx'
import { api, query } from '../lib/api.js'
import { useAsync, useDebounced } from '../lib/hooks.js'

const LIMIT = 20
const LEVELS = [
  ['', 'All'],
  ['easy', 'Easy'],
  ['medium', 'Medium'],
  ['hard', 'Hard'],
]

export default function Problems() {
  const [params, setParams] = useSearchParams()
  const page = Number(params.get('page')) || 1
  const difficulty = params.get('difficulty') || ''
  const sort = params.get('sort') || 'createdAt'
  const urlSearch = params.get('search') || ''

  const [search, setSearch] = useState(urlSearch)
  const debounced = useDebounced(search)

  const update = (changes) => {
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value)
      else next.delete(key)
    }
    setParams(next, { replace: true })
  }

  // Typing in the box changes the address bar once the typing pauses
  useEffect(() => {
    if (debounced !== urlSearch) update({ search: debounced, page: '' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced])

  const { data, error, loading, reload } = useAsync(
    (signal) => api(`/problems${query({ page, limit: LIMIT, difficulty, sort, search: urlSearch })}`, { signal }),
    [page, difficulty, sort, urlSearch],
  )

  const problems = data?.data.problems || []
  const filtered = Boolean(difficulty || urlSearch)

  return (
    <div className="page">
      <Seo
        title="Problems"
        description="Browse programming problems for C++ and Python. Filter by difficulty, write a solution in the browser and get a verdict in seconds."
        path="/problems"
      />
      <header className="page-head">
        <div>
          <h1>Problems</h1>
          <p>Pick one, write a solution, and see how it holds up.</p>
        </div>
      </header>

      <div className="toolbar">
        <div className="field" style={{ flex: '1 1 240px', maxWidth: 320 }}>
          <label htmlFor="search" className="sr-only">
            Search problems
          </label>
          <input
            id="search"
            type="search"
            className="input"
            placeholder="Search by title"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="segmented" role="group" aria-label="Difficulty">
          {LEVELS.map(([value, label]) => (
            <button
              key={label}
              aria-pressed={difficulty === value}
              onClick={() => update({ difficulty: value, page: '' })}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="field">
          <label htmlFor="sort" className="sr-only">
            Sort by
          </label>
          <select id="sort" className="select" value={sort} onChange={(e) => update({ sort: e.target.value, page: '' })}>
            <option value="createdAt">Oldest first</option>
            <option value="-createdAt">Newest first</option>
            <option value="title">Title, A to Z</option>
            <option value="difficulty">Difficulty</option>
          </select>
        </div>
      </div>

      {loading && !data && <Loading label="Loading problems" />}
      {error && <ErrorState error={error} onRetry={reload} />}

      {data && problems.length === 0 && (
        <EmptyState
          title={filtered ? 'No problems match' : 'No problems yet'}
          action={
            filtered && (
              <button
                className="btn btn-quiet"
                onClick={() => {
                  setSearch('')
                  setParams({}, { replace: true })
                }}
              >
                Clear filters
              </button>
            )
          }
        >
          {filtered ? 'Try a different search or difficulty.' : 'Problems appear here as soon as they are published.'}
        </EmptyState>
      )}

      {problems.length > 0 && (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Problem</th>
                  <th scope="col">Difficulty</th>
                  <th scope="col" className="num">
                    Time limit
                  </th>
                  <th scope="col" className="num">
                    Memory limit
                  </th>
                </tr>
              </thead>
              <tbody>
                {problems.map((problem) => (
                  <tr key={problem._id}>
                    <td>
                      <Link to={`/problems/${problem.slug}`}>{problem.title}</Link>
                    </td>
                    <td>
                      <Difficulty level={problem.difficulty} />
                    </td>
                    <td className="num">{problem.timeLimitMs / 1000} s</td>
                    <td className="num">{problem.memoryLimitMb} MB</td>
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
