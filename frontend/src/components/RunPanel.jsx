import { STATUS } from '../lib/verdicts.js'

// The result of a trial run: every example with what was expected and what the code printed
export default function RunPanel({ run, running, error }) {
  if (!run && !running && !error) return null

  const tests = run?.tests || []
  const passed = tests.filter((test) => test.verdict === 'ACCEPTED').length
  let summary = 'Running your code on the examples.'
  if (error) summary = error
  else if (run?.status === 'COMPILE_ERROR') summary = 'The code did not compile.'
  else if (run && !tests.length) summary = 'This problem has no examples to run against.'
  else if (run) summary = `${passed} of ${tests.length} ${tests.length === 1 ? 'example' : 'examples'} passed. Nothing was submitted.`

  return (
    <section className="result inscribed" aria-live="polite" aria-label="Run on the examples">
      <div className="result-head">
        <span className="verdict result-status" data-tone={running ? 'live' : error ? 'bad' : run && tests.length && passed === tests.length ? 'good' : 'bad'} data-live={running ? 'true' : undefined}>
          {running ? 'Running' : error ? 'Not run' : 'Examples'}
        </span>
      </div>
      <p className="muted" style={{ marginTop: 6 }}>
        {summary}
      </p>

      {run?.compileOutput && (
        <pre className="compile-output" tabIndex={0}>
          {run.compileOutput}
        </pre>
      )}

      {tests.map((test) => (
        <div className="run-test" key={test.ordinal}>
          <div className="run-test-head">
            <span>Example {test.ordinal}</span>
            <span className="verdict" data-tone={STATUS[test.verdict]?.tone}>
              {test.verdict === 'ACCEPTED' ? 'Passed' : STATUS[test.verdict]?.label || test.verdict}
            </span>
            <span className="muted">{test.timeMs} ms</span>
          </div>
          <div className="sample">
            <div>
              <h4>Input</h4>
              <pre>{test.input}</pre>
            </div>
            <div>
              <h4>Expected output</h4>
              <pre>{test.expectedOutput}</pre>
            </div>
            <div>
              <h4>Your output</h4>
              <pre>{test.output || ' '}</pre>
            </div>
            {test.logs && (
              <div>
                <h4>Logs (stderr)</h4>
                <pre>{test.logs}</pre>
              </div>
            )}
          </div>
        </div>
      ))}
    </section>
  )
}
