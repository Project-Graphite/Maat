import { Link } from 'react-router-dom'
import Seo from '../components/Seo.jsx'

export default function NotFound() {
  return (
    <div className="page">
      <Seo title="Page not found" description="This page does not exist." noindex />
      <div className="state">
        <h1>This page is not here.</h1>
        <p>The address may be wrong, or the page may have been removed.</p>
        <div className="row">
          <Link to="/problems" className="btn">
            Browse problems
          </Link>
          <Link to="/" className="btn btn-quiet">
            Go home
          </Link>
        </div>
      </div>
    </div>
  )
}
