import { STATUS } from '../lib/verdicts.js'

export default function VerdictBadge({ status }) {
  const info = STATUS[status] || { label: status, tone: 'neutral' }
  return (
    <span className="verdict" data-tone={info.tone} data-live={info.live ? 'true' : undefined}>
      {info.label}
    </span>
  )
}

export function Difficulty({ level }) {
  return (
    <span className="difficulty" data-level={level}>
      {level ? level[0].toUpperCase() + level.slice(1) : ''}
    </span>
  )
}
