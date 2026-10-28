import { useEffect, useState } from 'react'
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom'
import CodeEditor from '../components/CodeEditor.jsx'
import Markdown from '../components/Markdown.jsx'
import ResultPanel from '../components/ResultPanel.jsx'
import Seo from '../components/Seo.jsx'
import { ErrorState, Loading } from '../components/States.jsx'
import { Difficulty } from '../components/VerdictBadge.jsx'
import { useAuth } from '../context/Auth.jsx'
import { useUi } from '../context/Ui.jsx'
import { api } from '../lib/api.js'
import { useAsync, useSubmissionStream } from '../lib/hooks.js'
import { load, save } from '../lib/storage.js'
import { LANGUAGES, STARTERS, isFinal } from '../lib/verdicts.js'

// A plain-text line for search results: markdown marks removed, cut at a word
const summarize = (markdown) => {
  const text = markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[#>*_`$\\[\]()-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return text.length > 155 ? `${text.slice(0, text.lastIndexOf(' ', 155))}…` : text
}

const draftKey = (slug, language) => `maat:draft:${slug}:${language}`

function Samples({ samples }) {
  if (!samples.length) return null
  return (
    <section aria-labelledby="samples-title" style={{ marginTop: 40 }}>
      <h2 id="samples-title" style={{ fontSize: 'var(--step-2)' }}>
        {samples.length === 1 ? 'Example' : 'Examples'}
      </h2>
      <div className="samples">
        {samples.map((sample) => (
          <div className="sample" key={sample.ordinal}>
            <div>
              <h4>Input</h4>
              <pre>{sample.input}</pre>
            </div>
            <div>
              <h4>Output</h4>
              <pre>{sample.expectedOutput}</pre>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

export default function ProblemDetail() {
  const { slug } = useParams()
  const [params] = useSearchParams()
  const contestId = params.get('contest') || undefined
  const location = useLocation()
  const { user } = useAuth()
  const { confirm } = useUi()

  const { data, error, loading, reload } = useAsync((signal) => api(`/problems/${slug}`, { signal }), [slug])
  const contest = useAsync(
    (signal) => (contestId ? api(`/contests/${contestId}`, { signal }) : Promise.resolve(null)),
    [contestId],
  )

  const [language, setLanguage] = useState(() => load('maat:language', 'cpp17'))
  const [code, setCode] = useState('')
  const [submissionId, setSubmissionId] = useState(null)
  const [sending, setSending] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const health = useAsync((signal) => fetch('/health', { signal }).then((res) => res.json()), [])
  const [judgeOnline, setJudgeOnline] = useState(true)
  const judgeOffline = !judgeOnline || health.data?.workers === 0

  // The draft for this problem and language, or a starter file
  useEffect(() => {
    setCode(load(draftKey(slug, language), STARTERS[language]))
    setSubmissionId(null)
    setSubmitError('')
  }, [slug, language])

  const result = useSubmissionStream(submissionId)

  const onCode = (next) => {
    setCode(next)
    save(draftKey(slug, language), next)
  }
  const onLanguage = (next) => {
    setLanguage(next)
    save('maat:language', next)
  }

  const submit = async () => {
    setSending(true)
    setSubmitError('')
    try {
      const res = await api('/submissions', {
        method: 'POST',
        body: { problemId: data.data.problem._id, language, sourceCode: code, contestId },
      })
      setSubmissionId(res.data.submission._id)
      setJudgeOnline(res.data.judgeOnline)
    } catch (err) {
      setSubmitError(err.message)
    }
    setSending(false)
  }

  if (loading && !data) return <div className="page"><Loading label="Loading the problem" /></div>
  if (error) return <div className="page"><ErrorState error={error} onRetry={reload} /></div>

  const { problem, samples } = data.data
  const inFlight = submissionId && !(result && isFinal(result.status))

  return (
    <div className="page page-wide">
      <Seo
        title={problem.title}
        description={`${problem.title}: ${summarize(problem.statementMd)}`}
        path={`/problems/${problem.slug}`}
      />
      <div className="workbench">
        <article className="workbench-statement">
          <h1>{problem.title}</h1>
          <div className="problem-meta">
            <Difficulty level={problem.difficulty} />
            <span>Time limit {problem.timeLimitMs / 1000} s</span>
            <span>Memory limit {problem.memoryLimitMb} MB</span>
          </div>
          <Markdown>{problem.statementMd}</Markdown>
          <Samples samples={samples} />
        </article>

        <div className="workbench-side">
          {contestId && contest.data && (
            <div className="notice">
              Submitting to the contest{' '}
              <Link to={`/contests/${contestId}`}>{contest.data.data.contest.title}</Link>.
            </div>
          )}

          <div className="editor-bar">
            <label className="row" style={{ gap: 10 }}>
              <span className="muted">Language</span>
              <select className="select" value={language} onChange={(e) => onLanguage(e.target.value)}>
                {Object.entries(LANGUAGES).map(([value, { label }]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="btn btn-quiet btn-small"
              onClick={async () => {
                const ok = await confirm('Your code for this problem will be replaced with the starter file.', { confirmLabel: 'Reset code', title: 'Reset your code?' })
                if (ok) onCode(STARTERS[language])
              }}
            >
              Reset code
            </button>
          </div>

          <CodeEditor language={language} value={code} onChange={onCode} label={`${problem.title} solution`} />

          {judgeOffline && (
            <div className="notice" role="status">
              No judge is running right now. You can still submit, and your solution will be judged as soon as one starts.
            </div>
          )}

          {submitError && (
            <div className="notice notice-error" role="alert">
              {submitError}
            </div>
          )}

          {user ? (
            <button className="btn btn-large" onClick={submit} disabled={sending || inFlight || !code.trim()}>
              {sending ? 'Sending' : inFlight ? 'Being weighed' : 'Submit solution'}
            </button>
          ) : (
            <Link className="btn btn-large" to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`}>
              Log in to submit
            </Link>
          )}

          <ResultPanel result={result} waiting={Boolean(submissionId)} />
          {submissionId && result && isFinal(result.status) && (
            <Link to={`/submissions/${submissionId}`}>Open this submission</Link>
          )}
        </div>
      </div>
    </div>
  )
}
