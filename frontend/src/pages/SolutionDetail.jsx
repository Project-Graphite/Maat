import { Link, useParams } from 'react-router-dom'
import CodeEditor from '../components/CodeEditor.jsx'
import { Avatar } from '../components/Layout.jsx'
import Seo from '../components/Seo.jsx'
import { EmptyState, ErrorState, Loading } from '../components/States.jsx'
import { api } from '../lib/api.js'
import { formatDateTime } from '../lib/format.js'
import { useAsync } from '../lib/hooks.js'
import { LANGUAGES } from '../lib/verdicts.js'

export default function SolutionDetail() {
  const { id } = useParams()
  const { data, error, loading, reload } = useAsync((signal) => api(`/solutions/${id}`, { signal }), [id])

  if (loading && !data) return <div className="page"><Loading label="Loading the solution" /></div>
  if (error) {
    return (
      <div className="page">
        {error.status === 403 ? (
          <EmptyState title="Solutions are hidden for now">{error.message}</EmptyState>
        ) : (
          <ErrorState error={error} onRetry={reload} />
        )}
      </div>
    )
  }

  const { solution } = data.data
  const { problem, author } = solution
  return (
    <div className="page">
      <Seo
        title={`${author.name}’s solution to ${problem.title}`}
        description={`An accepted ${LANGUAGES[solution.language]?.label} solution to ${problem.title}, shared by its author.`}
        path={`/solutions/${solution._id}`}
      />
      <header className="page-head">
        <div>
          <h1>Solution to {problem.title}</h1>
          <div className="row" style={{ gap: 12, marginTop: 12 }}>
            <Avatar user={author} />
            <span>
              <strong>{author.name}</strong>
              <span className="muted">
                {' '}
                · {LANGUAGES[solution.language]?.label} · accepted {formatDateTime(solution.submittedAt)}
              </span>
            </span>
          </div>
        </div>
        <div className="page-head-actions">
          <Link to={`/problems/${problem.slug}/solutions`} className="btn btn-quiet">
            All solutions
          </Link>
          <Link to={`/problems/${problem.slug}`} className="btn btn-quiet">
            Solve it
          </Link>
        </div>
      </header>
      <CodeEditor language={solution.language} value={solution.sourceCode} readOnly tall label={`${author.name}’s solution`} />
    </div>
  )
}
