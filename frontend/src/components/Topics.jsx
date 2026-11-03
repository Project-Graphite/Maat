import { Link } from 'react-router-dom'
import { query } from '../lib/api.js'

// Each topic opens the problem list filtered by it. Hidden topics arrive as an empty list
export default function Topics({ topics, compact = false }) {
  if (!topics?.length) return null
  return (
    <ul className={compact ? 'topics topics-compact' : 'topics'} aria-label="Topics">
      {topics.map((topic) => (
        <li key={topic}>
          <Link className="tag" to={`/problems${query({ topic })}`}>
            {topic}
          </Link>
        </li>
      ))}
    </ul>
  )
}
