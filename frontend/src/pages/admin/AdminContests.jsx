import { Link, useSearchParams } from 'react-router-dom'
import Pagination from '../../components/Pagination.jsx'
import { EmptyState, ErrorState, Loading } from '../../components/States.jsx'
import { useUi } from '../../context/Ui.jsx'
import { api, query } from '../../lib/api.js'
import { formatDateTime } from '../../lib/format.js'
import { useAsync } from '../../lib/hooks.js'
import { ContestStatus } from '../Contests.jsx'

const LIMIT = 20

export default function AdminContests() {
  const [params, setParams] = useSearchParams()
  const page = Number(params.get('page')) || 1
  const { toast, confirm } = useUi()

  const { data, error, loading, reload } = useAsync(
    (signal) => api(`/contests${query({ page, limit: LIMIT })}`, { signal }),
    [page],
  )
  const contests = data?.data.contests || []

  const remove = async (contest) => {
    const ok = await confirm(`“${contest.title}” will be deleted. Submissions stay, but the standings are gone.`, {
      confirmLabel: 'Delete contest',
      title: 'Delete this contest?',
    })
    if (!ok) return
    try {
      await api(`/contests/${contest._id}`, { method: 'DELETE' })
      toast('Contest deleted.', 'success')
      reload()
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Contests</h1>
          <p>Latest first.</p>
        </div>
        <div className="page-head-actions">
          <Link to="/admin/contests/new" className="btn">
            New contest
          </Link>
        </div>
      </header>

      {loading && !data && <Loading />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {data && contests.length === 0 && <EmptyState title="No contests yet">Schedule the first one with the button above.</EmptyState>}

      {contests.length > 0 && (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Title</th>
                  <th scope="col">Starts</th>
                  <th scope="col">Ends</th>
                  <th scope="col">Status</th>
                  <th scope="col">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {contests.map((contest) => (
                  <tr key={contest._id}>
                    <td>
                      <Link to={`/admin/contests/${contest._id}`}>{contest.title}</Link>
                    </td>
                    <td>{formatDateTime(contest.startsAt)}</td>
                    <td>{formatDateTime(contest.endsAt)}</td>
                    <td>
                      <ContestStatus status={contest.status} />
                    </td>
                    <td>
                      <div className="cell-actions">
                        <Link to={`/contests/${contest._id}`} className="btn btn-quiet btn-small">
                          View
                        </Link>
                        <button className="btn btn-danger btn-small" onClick={() => remove(contest)}>
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
