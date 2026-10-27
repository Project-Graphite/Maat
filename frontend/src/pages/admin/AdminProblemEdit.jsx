import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Dialog from '../../components/Dialog.jsx'
import Markdown from '../../components/Markdown.jsx'
import { EmptyState, ErrorState, Loading } from '../../components/States.jsx'
import { useUi } from '../../context/Ui.jsx'
import { api } from '../../lib/api.js'
import { useAsync } from '../../lib/hooks.js'

const BLANK = {
  title: '',
  slug: '',
  statementMd: '',
  timeLimitMs: 2000,
  memoryLimitMb: 256,
  difficulty: 'easy',
  visible: false,
}

const preview = (text = '') => (text.length > 240 ? `${text.slice(0, 240)}…` : text)

function ProblemForm({ problem, isNew }) {
  const navigate = useNavigate()
  const { toast } = useUi()
  const [form, setForm] = useState({ ...BLANK, ...problem })
  const [showPreview, setShowPreview] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (field) => (e) => setForm({ ...form, [field]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })

  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    const body = {
      title: form.title,
      statementMd: form.statementMd,
      timeLimitMs: Number(form.timeLimitMs),
      memoryLimitMb: Number(form.memoryLimitMb),
      difficulty: form.difficulty,
      visible: form.visible,
    }
    if (isNew && form.slug.trim()) body.slug = form.slug.trim()

    try {
      if (isNew) {
        const res = await api('/admin/problems', { method: 'POST', body })
        toast('Problem created. Now add its test cases.', 'success')
        navigate(`/admin/problems/${res.data.problem._id}`, { replace: true })
      } else {
        await api(`/admin/problems/${problem._id}`, { method: 'PATCH', body })
        toast('Problem saved.', 'success')
      }
    } catch (err) {
      setError(err.message)
    }
    setBusy(false)
  }

  return (
    <form className="form form-wide" onSubmit={submit}>
      {error && <div className="notice notice-error" role="alert">{error}</div>}
      <div className="field">
        <label htmlFor="title">Title</label>
        <input id="title" className="input" required maxLength={100} value={form.title} onChange={set('title')} />
      </div>
      {isNew ? (
        <div className="field">
          <label htmlFor="slug">Address</label>
          <input id="slug" className="input" placeholder="Made from the title if left empty" value={form.slug} onChange={set('slug')} />
          <span className="field-hint">The part after /problems/. It cannot change once the problem exists.</span>
        </div>
      ) : (
        <p className="muted small">
          Public address: <Link to={`/problems/${problem.slug}`}>/problems/{problem.slug}</Link>
        </p>
      )}
      <div className="field">
        <div className="row-between">
          <label htmlFor="statement">Statement (Markdown)</label>
          <button type="button" className="btn btn-quiet btn-small" onClick={() => setShowPreview((v) => !v)}>
            {showPreview ? 'Edit' : 'Preview'}
          </button>
        </div>
        {showPreview ? (
          <div className="panel" style={{ minHeight: 200 }}>
            <Markdown>{form.statementMd || '*Nothing to preview yet.*'}</Markdown>
          </div>
        ) : (
          <textarea id="statement" className="textarea textarea-code" rows={14} required value={form.statementMd} onChange={set('statementMd')} />
        )}
      </div>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="time">Time limit (ms)</label>
          <input id="time" type="number" className="input" min={100} max={10000} step={100} required value={form.timeLimitMs} onChange={set('timeLimitMs')} />
          <span className="field-hint">100 to 10,000</span>
        </div>
        <div className="field">
          <label htmlFor="memory">Memory limit (MB)</label>
          <input id="memory" type="number" className="input" min={16} max={1024} required value={form.memoryLimitMb} onChange={set('memoryLimitMb')} />
          <span className="field-hint">16 to 1,024</span>
        </div>
        <div className="field">
          <label htmlFor="difficulty">Difficulty</label>
          <select id="difficulty" className="select" value={form.difficulty} onChange={set('difficulty')}>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </div>
      </div>
      <label className="check">
        <input type="checkbox" checked={form.visible} onChange={set('visible')} />
        Published, so everyone can see and solve it
      </label>
      <div className="row">
        <button className="btn" disabled={busy}>
          {busy ? 'Saving' : isNew ? 'Create problem' : 'Save changes'}
        </button>
        <Link to="/admin/problems" className="btn btn-quiet">
          Back to problems
        </Link>
      </div>
    </form>
  )
}

function TestCaseDialog({ problemId, testCase, open, onClose, onSaved }) {
  const { toast } = useUi()
  const [form, setForm] = useState({ input: '', expectedOutput: '', isSample: false })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) {
      setForm({
        input: testCase?.input ?? '',
        expectedOutput: testCase?.expectedOutput ?? '',
        isSample: testCase?.isSample ?? false,
      })
      setError('')
    }
  }, [open, testCase])

  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      if (testCase) await api(`/admin/problems/${problemId}/testcases/${testCase._id}`, { method: 'PATCH', body: form })
      else await api(`/admin/problems/${problemId}/testcases`, { method: 'POST', body: form })
      toast('Test case saved.', 'success')
      onSaved()
      onClose()
    } catch (err) {
      setError(err.message)
    }
    setBusy(false)
  }

  return (
    <Dialog open={open} onClose={onClose} title={testCase ? `Edit test ${testCase.ordinal}` : 'New test case'} wide>
      <form className="form" style={{ maxWidth: 'none' }} onSubmit={submit}>
        {error && <div className="notice notice-error" role="alert">{error}</div>}
        <div className="field">
          <label htmlFor="tc-input">Input</label>
          <textarea id="tc-input" className="textarea textarea-code" rows={6} value={form.input} onChange={(e) => setForm({ ...form, input: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="tc-output">Expected output</label>
          <textarea id="tc-output" className="textarea textarea-code" rows={6} value={form.expectedOutput} onChange={(e) => setForm({ ...form, expectedOutput: e.target.value })} />
        </div>
        <label className="check">
          <input type="checkbox" checked={form.isSample} onChange={(e) => setForm({ ...form, isSample: e.target.checked })} />
          Show as an example on the problem page
        </label>
        <div className="dialog-actions" style={{ marginTop: 0 }}>
          <button type="button" className="btn btn-quiet" onClick={onClose}>
            Cancel
          </button>
          <button className="btn" disabled={busy}>
            {busy ? 'Saving' : 'Save test case'}
          </button>
        </div>
      </form>
    </Dialog>
  )
}

const BULK_EXAMPLE = '[\n  { "input": "1 2\\n", "expectedOutput": "3\\n", "isSample": true },\n  { "input": "5 7\\n", "expectedOutput": "12\\n" }\n]'

function BulkDialog({ problemId, open, onClose, onSaved }) {
  const { toast } = useUi()
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) {
      setText('')
      setError('')
    }
  }, [open])

  const submit = async (event) => {
    event.preventDefault()
    let testCases
    try {
      testCases = JSON.parse(text)
    } catch {
      return setError('That is not valid JSON. Check the commas and quotes.')
    }
    if (!Array.isArray(testCases)) return setError('Paste a list: [ { … }, { … } ].')

    setBusy(true)
    setError('')
    try {
      await api(`/admin/problems/${problemId}/testcases/bulk`, { method: 'POST', body: { testCases } })
      toast(`${testCases.length} test cases added.`, 'success')
      onSaved()
      onClose()
    } catch (err) {
      setError(err.message)
    }
    setBusy(false)
  }

  return (
    <Dialog open={open} onClose={onClose} title="Add several test cases" wide>
      <form className="form" style={{ maxWidth: 'none' }} onSubmit={submit}>
        {error && <div className="notice notice-error" role="alert">{error}</div>}
        <div className="field">
          <label htmlFor="bulk">Test cases as JSON</label>
          <textarea id="bulk" className="textarea textarea-code" rows={10} placeholder={BULK_EXAMPLE} value={text} onChange={(e) => setText(e.target.value)} />
          <span className="field-hint">Up to 100 at a time. They are numbered after the ones you already have.</span>
        </div>
        <div className="dialog-actions" style={{ marginTop: 0 }}>
          <button type="button" className="btn btn-quiet" onClick={onClose}>
            Cancel
          </button>
          <button className="btn" disabled={busy || !text.trim()}>
            {busy ? 'Adding' : 'Add test cases'}
          </button>
        </div>
      </form>
    </Dialog>
  )
}

function TestCases({ problemId }) {
  const { toast, confirm } = useUi()
  const { data, error, loading, reload } = useAsync((signal) => api(`/admin/problems/${problemId}/testcases`, { signal }), [problemId])
  const [editing, setEditing] = useState(undefined) // undefined: closed, null: new, object: edit
  const [bulk, setBulk] = useState(false)

  const remove = async (testCase) => {
    const ok = await confirm(`Test ${testCase.ordinal} will be deleted. Submissions are judged against the tests that remain.`, {
      confirmLabel: 'Delete test',
      title: 'Delete this test case?',
    })
    if (!ok) return
    try {
      await api(`/admin/problems/${problemId}/testcases/${testCase._id}`, { method: 'DELETE' })
      toast('Test case deleted.', 'success')
      reload()
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  const testCases = data?.data.testCases || []

  return (
    <section aria-labelledby="tests-title" style={{ marginTop: 56 }}>
      <div className="row-between" style={{ marginBottom: 16 }}>
        <div>
          <h2 id="tests-title" style={{ fontSize: 'var(--step-2)' }}>
            Test cases
          </h2>
          <p className="muted small">Every submission runs against these in order and stops at the first failure.</p>
        </div>
        <div className="row">
          <button className="btn btn-quiet" onClick={() => setBulk(true)}>
            Add several
          </button>
          <button className="btn" onClick={() => setEditing(null)}>
            Add test case
          </button>
        </div>
      </div>

      {loading && !data && <Loading />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {data && testCases.length === 0 && (
        <EmptyState title="No test cases yet">A problem cannot be submitted to until it has at least one.</EmptyState>
      )}

      {testCases.length > 0 && (
        <ul className="testcase-list">
          {testCases.map((testCase) => (
            <li key={testCase._id}>
              <div>
                <strong>{testCase.ordinal}</strong>
                {testCase.isSample && <div className="tag tag-gold" style={{ marginTop: 6 }}>Example</div>}
              </div>
              <div>
                <div className="muted small">Input</div>
                <pre>{preview(testCase.input)}</pre>
              </div>
              <div>
                <div className="muted small">Expected output</div>
                <pre>{preview(testCase.expectedOutput)}</pre>
              </div>
              <div className="cell-actions">
                <button className="btn btn-quiet btn-small" onClick={() => setEditing(testCase)}>
                  Edit
                </button>
                <button className="btn btn-danger btn-small" onClick={() => remove(testCase)}>
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <TestCaseDialog
        problemId={problemId}
        testCase={editing || undefined}
        open={editing !== undefined}
        onClose={() => setEditing(undefined)}
        onSaved={reload}
      />
      <BulkDialog problemId={problemId} open={bulk} onClose={() => setBulk(false)} onSaved={reload} />
    </section>
  )
}

export default function AdminProblemEdit() {
  const { id } = useParams()
  const isNew = !id
  const { data, error, loading, reload } = useAsync(
    (signal) => (isNew ? Promise.resolve(null) : api(`/admin/problems/${id}`, { signal })),
    [id],
  )

  if (loading && !isNew) return <Loading />
  if (error) return <ErrorState error={error} onRetry={reload} />

  return (
    <>
      <header className="page-head">
        <div>
          <h1>{isNew ? 'New problem' : data.data.problem.title}</h1>
          <p>{isNew ? 'Write the statement and set the limits. Add test cases after saving.' : 'Changes apply to new submissions straight away.'}</p>
        </div>
      </header>
      <ProblemForm key={id || 'new'} problem={data?.data.problem} isNew={isNew} />
      {!isNew && <TestCases problemId={id} />}
    </>
  )
}
