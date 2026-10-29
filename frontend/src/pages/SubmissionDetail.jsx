import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import CodeEditor from '../components/CodeEditor.jsx'
import ResultPanel from '../components/ResultPanel.jsx'
import Seo from '../components/Seo.jsx'
import { ErrorState, Loading } from '../components/States.jsx'
import { useAuth } from '../context/Auth.jsx'
import { useUi } from '../context/Ui.jsx'
import { api } from '../lib/api.js'
import { formatDateTime } from '../lib/format.js'
import { useAsync, useSubmissionStream } from '../lib/hooks.js'
import { LANGUAGES } from '../lib/verdicts.js'

// Authors choose whether an accepted solution appears on the problem's solutions page
function Sharing({ submission }) {
  const { toast } = useUi()
  const [shared, setShared] = useState(Boolean(submission.public))
  const [busy, setBusy] = useState(false)

  const change = async (next) => {
    setBusy(true)
    try {
      await api(`/submissions/${submission._id}`, { method: 'PATCH', body: { public: next } })
      setShared(next)
      toast(next ? 'Shared on the solutions page.' : 'Hidden from the solutions page.', 'success')
    } catch (err) {
      toast(err.message, 'error')
    }
    setBusy(false)
  }

  return (
    <label className="check">
      <input type="checkbox" checked={shared} disabled={busy} onChange={(e) => change(e.target.checked)} />
      Share on the solutions page {submission.status === 'ACCEPTED' ? '' : '(only accepted solutions are shown)'}
    </label>
  )
}

function Detail({ submission }) {
  const { user } = useAuth()
  // Still being judged: the verdict arrives here without a reload
  const live = useSubmissionStream(submission._id, submission)
  const result = live || submission
  const problem = submission.problemId

  return (
    <div className="page">
      <Seo title="Submission" description="A submission and its verdict." path={`/submissions/${submission._id}`} noindex />
      <header className="page-head">
        <div>
          <h1>{problem ? problem.title : 'Submission'}</h1>
          <p>
            {LANGUAGES[submission.language]?.label} · sent {formatDateTime(submission.submittedAt)}
          </p>
        </div>
        <div className="page-head-actions">
          {problem && (
            <Link to={`/problems/${problem.slug}`} className="btn btn-quiet">
              Solve it again
            </Link>
          )}
          <Link to="/submissions" className="btn btn-quiet">
            All submissions
          </Link>
        </div>
      </header>

      <div className="stack">
        <ResultPanel result={result} />
        {user && submission.userId === user._id && <Sharing submission={submission} />}
        <section aria-labelledby="source-title">
          <h2 id="source-title" style={{ fontSize: 'var(--step-1)', marginBottom: 12 }}>
            Your code
          </h2>
          <CodeEditor language={submission.language} value={submission.sourceCode} readOnly tall label="Submitted code" />
        </section>
      </div>
    </div>
  )
}

export default function SubmissionDetail() {
  const { id } = useParams()
  const { data, error, loading, reload } = useAsync((signal) => api(`/submissions/${id}`, { signal }), [id])

  if (loading && !data) return <div className="page"><Loading label="Loading the submission" /></div>
  if (error) return <div className="page"><ErrorState error={error} onRetry={reload} /></div>
  return <Detail submission={data.data.submission} />
}
