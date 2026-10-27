import { Link } from 'react-router-dom'
import Seo from '../components/Seo.jsx'
import { useAuth } from '../context/Auth.jsx'

const EXAMPLE = [
  { name: 'Test 1', time: '12 ms' },
  { name: 'Test 2', time: '14 ms' },
  { name: 'Test 3', time: '31 ms' },
  { name: 'Test 4', time: '27 ms' },
]

const siteData = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'Ma’at',
  description: 'An online judge for C++ and Python with timed contests and live standings.',
  url: __SITE_URL__,
}

export default function Home() {
  const { user } = useAuth()

  return (
    <div className="page">
      <Seo path="/" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(siteData) }} />

      <section className="hero">
        <div className="hero-copy">
          <h1>Your code, weighed against the feather.</h1>
          <p className="hero-lead">
            Send in C++ or Python. Ma’at runs it in a sealed sandbox against hidden tests and tells you,
            test by test, where it holds and where it breaks.
          </p>
          <div className="hero-actions">
            <Link to="/problems" className="btn btn-large">
              Start solving
            </Link>
            <Link to="/contests" className="btn btn-quiet btn-large">
              See contests
            </Link>
          </div>
        </div>

        <aside className="ledger inscribed" aria-label="Example of a verdict">
          <div className="ledger-head">
            <span className="ledger-title">Sum of two numbers</span>
            <span className="muted small">Python 3, an example</span>
          </div>
          <ul className="ledger-list">
            {EXAMPLE.map((test, i) => (
              <li key={test.name} style={{ '--i': i }}>
                <span>{test.name}</span>
                <span className="time">{test.time}</span>
                <span className="verdict" data-tone="good">
                  Accepted
                </span>
              </li>
            ))}
          </ul>
          <div className="ledger-verdict">
            <strong>Accepted</strong>
            <span className="muted small">4 of 4 tests passed</span>
          </div>
        </aside>
      </section>

      <section className="section" aria-labelledby="how">
        <h2 id="how">How a verdict is reached</h2>
        <p className="section-lead">Every submission goes through the same three steps.</p>
        <ol className="steps">
          <li>
            <h3>Compile</h3>
            <p>
              C++ is built with g++ at -O2 under the C++17 standard. Python runs as written. If the code does
              not build, you get the compiler’s message back.
            </p>
          </li>
          <li>
            <h3>Run every test</h3>
            <p>
              Each test runs in its own container with no network, a read-only filesystem, and hard limits on
              time, memory and processes.
            </p>
          </li>
          <li>
            <h3>Compare</h3>
            <p>
              The output is checked against the expected answer. The first test that fails ends the run and
              names the reason.
            </p>
          </li>
        </ol>
      </section>

      <section className="section" aria-labelledby="details">
        <h2 id="details">What you get</h2>
        <dl className="facts" style={{ marginTop: 32 }}>
          <div>
            <dt>Two languages</dt>
            <dd>C++17 and Python 3, in an editor with highlighting and your draft saved as you type.</dd>
          </div>
          <div>
            <dt>Verdicts as they happen</dt>
            <dd>The result appears on the page the moment the judge finishes. No reloading.</dd>
          </div>
          <div>
            <dt>Timed contests</dt>
            <dd>
              Ranked by problems solved, then penalty minutes, with 20 minutes added for each wrong attempt
              before a solve.
            </dd>
          </div>
          <div>
            <dt>Honest limits</dt>
            <dd>Each problem states its own time and memory limit, and the judge enforces exactly those.</dd>
          </div>
        </dl>
      </section>

      <section className="cta-band">
        <h2>{user ? 'Pick up where you left off.' : 'Ready to be weighed?'}</h2>
        {user ? (
          <Link to="/problems" className="btn btn-large">
            Browse problems
          </Link>
        ) : (
          <Link to="/signup" className="btn btn-large">
            Create an account
          </Link>
        )}
      </section>
    </div>
  )
}
