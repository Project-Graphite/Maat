import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Pagination from '../../components/Pagination.jsx'
import { EmptyState, ErrorState, Loading } from '../../components/States.jsx'
import { Difficulty } from '../../components/VerdictBadge.jsx'
import { useUi } from '../../context/Ui.jsx'
import { api, query } from '../../lib/api.js'
import { useAsync, useDebounced } from '../../lib/hooks.js'

const LIMIT = 20

export default function AdminProblems() {
  const [params, setParams] = useSearchParams()
  const page = Number(params.get('page')) || 1
  const [search, setSearch] = useState('')
  const debounced = useDebounced(search)
  const { toast, confirm } = useUi()

  const { data, error, loading, reload } = useAsync(
    (signal) => api(`/admin/problems${query({ page, limit: LIMIT, search: debounced })}`, { signal }),
    [page, debounced],
  )
  const problems = data?.data.problems || []

  const setVisible = async (problem) => {
    try {
      await api(`/admin/problems/${problem._id}`, { method: 'PATCH', body: { visible: !problem.visible } })
      toast(problem.visible ? 'Hidden from the public.' : 'Published.', 'success')
      reload()
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  const remove = async (problem) => {
    const ok = await confirm(`“${problem.title}”, its test cases and all its submissions will be deleted for good.`, {
      confirmLabel: 'Delete problem',
      title: 'Delete this problem?',
    })
    if (!ok) return
    try {
      await api(`/admin/problems/${problem._id}`, { method: 'DELETE' })
      toast('Problem deleted.', 'success')
      reload()
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Problems</h1>
          <p>Hidden problems are only visible here.</p>
        </div>
        <div className="page-head-actions">
          <Link to="/admin/problems/new" className="btn">
            New problem
          </Link>
        </div>
      </header>

      <div className="toolbar">
        <label htmlFor="search" className="sr-only">
          Search problems
        </label>
        <input id="search" type="search" className="input" placeholder="Search by title" value={search} onChange={(e) => { setSearch(e.target.value); setParams({}, { replace: true }) }} />
      </div>

      {loading && !data && <Loading />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {data && problems.length === 0 && <EmptyState title="No problems found">Create the first one with the button above.</EmptyState>}

      {problems.length > 0 && (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Title</th>
                  <th scope="col">Address</th>
                  <th scope="col">Difficulty</th>
                  <th scope="col">Visibility</th>
                  <th scope="col">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {problems.map((problem) => (
                  <tr key={problem._id}>
                    <td>
                      <Link to={`/admin/problems/${problem._id}`}>{problem.title}</Link>
                    </td>
                    <td className="muted">/problems/{problem.slug}</td>
                    <td>
                      <Difficulty level={problem.difficulty} />
                    </td>
                    <td>
                      <span className={problem.visible ? 'tag tag-gold' : 'tag'}>{problem.visible ? 'Published' : 'Hidden'}</span>
                    </td>
                    <td>
                      <div className="cell-actions">
                        <button className="btn btn-quiet btn-small" onClick={() => setVisible(problem)}>
                          {problem.visible ? 'Hide' : 'Publish'}
                        </button>
                        <button className="btn btn-danger btn-small" onClick={() => remove(problem)}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} total={data.total} limit={LIMIT} onPage={(p) => setParams(p > 1 ? { page: String(p) } : {}, { replace: true })} />
        </>
      )}
    </>
  )
}
