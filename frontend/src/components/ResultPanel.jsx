import { useState } from 'react'
import { api } from '../lib/api.js'
import { useAsync } from '../lib/hooks.js'
import { STATUS, isFinal } from '../lib/verdicts.js'

// Test data can be large, so each test loads its own once it is opened
function TestData({ submissionId, ordinal }) {
  const { data, error, loading } = useAsync(
    (signal) => api(`/submissions/${submissionId}/tests/${ordinal}`, { signal }),
    [submissionId, ordinal],
  )

  if (loading && !data) return <p className="muted test-data-note">Loading the test data</p>
  if (error) return <p className="muted test-data-note">{error.message}</p>

  const test = data.data.test
  const failed = test.verdict !== 'ACCEPTED'
  return (
    <>
      <div className="sample test-data">
        <div>
          <h4>Input</h4>
          <pre tabIndex={0}>{test.input || ' '}</pre>
        </div>
        <div>
          <h4>Expected output</h4>
          <pre tabIndex={0}>{test.expectedOutput || ' '}</pre>
        </div>
        {failed && (
          <div>
            <h4>Your output</h4>
            <pre tabIndex={0}>{test.output === undefined ? 'Not saved for this submission.' : test.output || ' '}</pre>
          </div>
        )}
        {failed && test.logs && (
          <div>
            <h4>Logs (stderr)</h4>
            <pre tabIndex={0}>{test.logs}</pre>
          </div>
        )}
      </div>
      {!failed && <p className="muted test-data-note">Your output matched the expected output.</p>}
    </>
  )
}

function TestRow({ test, submissionId, open }) {
  const [shown, setShown] = useState(open)
  const row = (
    <>
      <span>Test {test.ordinal}</span>
      <span className="verdict" data-tone={STATUS[test.verdict]?.tone}>
        {STATUS[test.verdict]?.label || test.verdict}
      </span>
      <span className="muted">{test.timeMs} ms</span>
    </>
  )

  if (!submissionId) return <li>{row}</li>
  return (
    <li className="test-row">
      <details open={open} onToggle={(e) => setShown(e.currentTarget.open)}>
        <summary>{row}</summary>
        {shown && <TestData submissionId={submissionId} ordinal={test.ordinal} />}
      </details>
    </li>
  )
}

// With a submissionId, a judged submission's tests open to show their data. Judging stops at the
// first failed test, so the list is every test up to and including that one
export default function ResultPanel({ result, waiting, submissionId }) {
  if (!result && !waiting) return null

  const status = result?.status || 'PENDING'
  const info = STATUS[status] || { label: status, tone: 'neutral' }
  const tests = result?.tests || []
  const final = isFinal(status)
  const last = tests[tests.length - 1]

  let summary = ''
  if (status === 'ACCEPTED') summary = `All ${tests.length} tests passed.`
  else if (status === 'SYSTEM_ERROR') summary = 'The judge hit a problem on our side. Your code was not judged. Submit it again.'
  else if (status === 'COMPILE_ERROR') summary = 'The code did not compile.'
  else if (final && last) summary = `Stopped at test ${last.ordinal}.`
  else summary = 'Running your code against the tests.'

  return (
    <section className="result inscribed" aria-live="polite" aria-label="Verdict">
      <div className="result-head">
        <span className="verdict result-status" data-tone={info.tone} data-live={info.live ? 'true' : undefined}>
          {info.label}
        </span>
      </div>
      <p className="muted" style={{ marginTop: 6 }}>
        {summary}
      </p>

      {status === 'COMPILE_ERROR' && result?.compileOutput && (
        <pre className="compile-output" tabIndex={0}>
          {result.compileOutput}
        </pre>
      )}

      {tests.length > 0 && (
        <ul className="tests">
          {tests.map((test) => (
            <TestRow
              key={test.ordinal}
              test={test}
              submissionId={final ? submissionId : undefined}
              open={test.verdict !== 'ACCEPTED'}
            />
          ))}
        </ul>
      )}
    </section>
  )
}
