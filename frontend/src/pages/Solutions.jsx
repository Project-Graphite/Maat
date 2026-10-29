import { Link, useParams, useSearchParams } from 'react-router-dom'
import { Avatar } from '../components/Layout.jsx'
import Pagination from '../components/Pagination.jsx'
import Seo from '../components/Seo.jsx'
import { EmptyState, ErrorState, Loading } from '../components/States.jsx'
import { api, query } from '../lib/api.js'
import { formatDateTime } from '../lib/format.js'
import { useAsync } from '../lib/hooks.js'
import { LANGUAGES } from '../lib/verdicts.js'

const LIMIT = 10

export default function Solutions() {
  const { slug } = useParams()
  const [params, setParams] = useSearchParams()
  const page = Number(params.get('page')) || 1
  const { data, error, loading, reload } = useAsync(
    (signal) => api(`/problems/${slug}/solutions${query({ page })}`, { signal }),
    [slug, page],
  )

  if (loading && !data) return <div className="page"><Loading label="Loading solutions" /></div>
  if (error) {
    return (
      <div className="page">
        {error.status === 403 ? (
          <EmptyState title="Solutions are hidden for now" action={<Link to={`/problems/${slug}`} className="btn">Back to the problem</Link>}>
            {error.message}
          </EmptyState>
        ) : (
          <ErrorState error={error} onRetry={reload} />
        )}
      </div>
    )
  }

  const { problem, solutions } = data.data
  return (
    <div className="page">
      <Seo title={`Solutions to ${problem.title}`} description={`Accepted solutions to ${problem.title}, shared by their authors.`} path={`/problems/${slug}/solutions`} />
      <header className="page-head">
        <div>
          <h1>Solutions to {problem.title}</h1>
          <p>
            Accepted solutions their authors chose to share. <Link to={`/problems/${slug}`}>Back to the problem</Link>
          </p>
        </div>
      </header>

      {solutions.length === 0 ? (
        <EmptyState title="No shared solutions yet" action={<Link to={`/problems/${slug}`} className="btn">Solve it</Link>}>
          Solve the problem and tick “Share this solution” to be the first.
        </EmptyState>
      ) : (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Author</th>
                  <th scope="col">Language</th>
                  <th scope="col">Accepted</th>
                  <th scope="col">
                    <span className="sr-only">Open</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {solutions.map((solution) => (
                  <tr key={solution._id}>
                    <td>
                      <div className="row" style={{ gap: 12 }}>
                        <Avatar user={solution.author} />
                        <span>{solution.author.name}</span>
                      </div>
                    </td>
                    <td>{LANGUAGES[solution.language]?.label || solution.language}</td>
                    <td>{formatDateTime(solution.submittedAt)}</td>
                    <td className="num">
                      <Link to={`/solutions/${solution._id}`}>Details</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} total={data.total} limit={LIMIT} onPage={(p) => setParams(p > 1 ? { page: String(p) } : {}, { replace: true })} />
        </>
      )}
    </div>
  )
}
