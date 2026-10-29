import { useEffect, useState } from 'react'
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom'
import CodeEditor from '../components/CodeEditor.jsx'
import Markdown from '../components/Markdown.jsx'
import ResultPanel from '../components/ResultPanel.jsx'
import RunPanel from '../components/RunPanel.jsx'
import Seo from '../components/Seo.jsx'
import { ErrorState, Loading } from '../components/States.jsx'
import { Difficulty } from '../components/VerdictBadge.jsx'
import { useAuth } from '../context/Auth.jsx'
import { useUi } from '../context/Ui.jsx'
import { api } from '../lib/api.js'
import { formatCode } from '../lib/formatter.js'
import { useAsync, useSubmissionStream } from '../lib/hooks.js'
import { DRAFT_PREFIX, load, save } from '../lib/storage.js'
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

// Drafts belong to one account, so the next person on this browser never sees them
const draftKey = (user, slug, language) => `${DRAFT_PREFIX}${user?._id || 'guest'}:${slug}:${language}`

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
  const { confirm, toast } = useUi()

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
  const [run, setRun] = useState(null)
  const [running, setRunning] = useState(false)
  const [runError, setRunError] = useState('')
  const [share, setShare] = useState(() => load('maat:share', '') === 'yes')
  const health = useAsync((signal) => fetch('/health', { signal }).then((res) => res.json()), [])
  const [judgeOnline, setJudgeOnline] = useState(true)
  const judgeOffline = !judgeOnline || health.data?.workers === 0

  // The draft for this problem and language, or a starter file
  useEffect(() => {
    setCode(load(draftKey(user, slug, language), STARTERS[language]))
    setSubmissionId(null)
    setSubmitError('')
    setRun(null)
    setRunError('')
  }, [slug, language, user?._id])

  const result = useSubmissionStream(submissionId)

  const onCode = (next) => {
    setCode(next)
    save(draftKey(user, slug, language), next)
  }

  const format = async () => {
    try {
      onCode(await formatCode(language, code))
    } catch {
      toast('Your code could not be formatted. Fix any syntax errors and try again.', 'error')
    }
  }

  // Inside the editor Monaco handles the shortcut itself and marks the event as handled
  useEffect(() => {
    const onKey = (event) => {
      if (event.altKey && event.shiftKey && event.code === 'KeyF' && !event.defaultPrevented) {
        event.preventDefault()
        format()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const onLanguage = (next) => {
    setLanguage(next)
    save('maat:language', next)
  }

  const onShare = (next) => {
    setShare(next)
    save('maat:share', next ? 'yes' : '')
  }

  const runExamples = async () => {
    setRunning(true)
    setRun(null)
    setRunError('')
    try {
      const res = await api('/submissions/run', {
        method: 'POST',
        body: { problemId: data.data.problem._id, language, sourceCode: code, contestId },
      })
      setRun(res.data.run)
    } catch (err) {
      setRunError(err.message)
    }
    setRunning(false)
  }

  const submit = async () => {
    setSending(true)
    setSubmitError('')
    try {
      const res = await api('/submissions', {
        method: 'POST',
        body: { problemId: data.data.problem._id, language, sourceCode: code, contestId, public: share },
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
            {user && <Link to={`/problems/${problem.slug}/submissions`}>My submissions</Link>}
            <Link to={`/problems/${problem.slug}/solutions`}>Solutions</Link>
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
            <div className="row" style={{ gap: 8 }}>
              <button className="btn btn-quiet btn-small" onClick={format} title="Format code (Alt+Shift+F)" aria-keyshortcuts="Alt+Shift+F">
                Format
              </button>
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
            <>
              <div className="submit-row">
                <button className="btn btn-large btn-quiet" onClick={runExamples} disabled={running || !code.trim()}>
                  {running ? 'Running' : 'Run on examples'}
                </button>
                <button className="btn btn-large" onClick={submit} disabled={sending || inFlight || !code.trim()}>
                  {sending ? 'Sending' : inFlight ? 'Being weighed' : 'Submit solution'}
                </button>
              </div>
              <label className="check">
                <input type="checkbox" checked={share} onChange={(e) => onShare(e.target.checked)} />
                Share this solution on the solutions page if it is accepted
              </label>
            </>
          ) : (
            <Link className="btn btn-large" to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`}>
              Log in to submit
            </Link>
          )}

          <RunPanel run={run} running={running} error={runError} />
          <ResultPanel result={result} waiting={Boolean(submissionId)} />
          {submissionId && result && isFinal(result.status) && (
            <Link to={`/submissions/${submissionId}`}>Open this submission</Link>
          )}
        </div>
      </div>
    </div>
  )
}
