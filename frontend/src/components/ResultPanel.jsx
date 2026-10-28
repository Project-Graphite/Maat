import { STATUS, isFinal } from '../lib/verdicts.js'

export default function ResultPanel({ result, waiting }) {
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
            <li key={test.ordinal}>
              <span>Test {test.ordinal}</span>
              <span className="verdict" data-tone={STATUS[test.verdict]?.tone}>
                {STATUS[test.verdict]?.label || test.verdict}
              </span>
              <span className="muted">{test.timeMs} ms</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
