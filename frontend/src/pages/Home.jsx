import { Link } from 'react-router-dom'
import Seo from '../components/Seo.jsx'

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
  return (
    <div className="page">
      <Seo path="/" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(siteData) }} />

      <section className="hero">
        <div className="hero-copy">
          <h1>Your code, weighed against the feather.</h1>
          <p className="hero-lead">
            Solve problems in C++ and Python, see every test pass or fail in seconds, and compete in timed
            contests.
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
            <span className="muted small">Python 3</span>
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
    </div>
  )
}
