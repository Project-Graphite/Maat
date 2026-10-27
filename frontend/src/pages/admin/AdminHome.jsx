import { Link } from 'react-router-dom'

const SECTIONS = [
  {
    to: '/admin/problems',
    title: 'Problems',
    text: 'Write statements, set limits, and manage the tests every submission is judged against.',
    action: 'Manage problems',
  },
  {
    to: '/admin/contests',
    title: 'Contests',
    text: 'Schedule a contest, choose its problems and label them.',
    action: 'Manage contests',
  },
  {
    to: '/admin/users',
    title: 'Users',
    text: 'Find an account and change its role.',
    action: 'Manage users',
  },
]

export default function AdminHome() {
  return (
    <>
      <header className="page-head">
        <div>
          <h1>Administration</h1>
          <p>Everything that shapes what contestants see.</p>
        </div>
      </header>
      <div className="admin-cards">
        {SECTIONS.map((section) => (
          <section key={section.to} className="panel stack-sm">
            <h2 style={{ fontSize: 'var(--step-2)' }}>{section.title}</h2>
            <p className="muted">{section.text}</p>
            <div>
              <Link to={section.to} className="btn btn-quiet">
                {section.action}
              </Link>
            </div>
          </section>
        ))}
      </div>
    </>
  )
}
