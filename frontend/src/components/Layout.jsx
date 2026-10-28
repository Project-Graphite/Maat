import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/Auth.jsx'
import { initial } from '../lib/format.js'
import Glyphs from './Glyphs.jsx'
import Logo from './Logo.jsx'

export function Avatar({ user, large }) {
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    setFailed(false)
  }, [user?.photo])

  if (user?.photo && !failed) {
    return (
      <img
        className={`avatar ${large ? 'avatar-large' : ''}`}
        src={`/api/v1/users/${user._id}/avatar?v=${encodeURIComponent(user.photo)}`}
        alt=""
        onError={() => setFailed(true)}
      />
    )
  }
  return <span className={`avatar ${large ? 'avatar-large' : ''}`}>{initial(user?.name)}</span>
}

function Header() {
  const { user, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    setOpen(false)
  }, [location.pathname])

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link to="/" className="brand" aria-label="Ma’at, home">
          <Logo />
        </Link>
        <button
          className="btn btn-quiet btn-small nav-toggle"
          aria-expanded={open}
          aria-controls="site-nav"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? 'Close' : 'Menu'}
        </button>
        <nav className="nav" id="site-nav" data-open={open} aria-label="Main">
          <NavLink to="/problems" className="nav-link">Problems</NavLink>
          <NavLink to="/contests" className="nav-link">Contests</NavLink>
          {user && <NavLink to="/submissions" className="nav-link">My submissions</NavLink>}
          {user?.role === 'admin' && <NavLink to="/admin" className="nav-link">Admin</NavLink>}
          <span className="nav-spacer" />
          {user ? (
            <div className="nav-account">
              <NavLink to="/profile" className="nav-link row" style={{ gap: 10 }}>
                <Avatar user={user} />
                <span>{user.name}</span>
              </NavLink>
              <button
                className="nav-link"
                onClick={async () => {
                  await logout()
                  navigate('/')
                }}
              >
                Log out
              </button>
            </div>
          ) : (
            <div className="nav-account">
              <Link to="/login" className="btn btn-quiet btn-small">
                Log in
              </Link>
              <Link to="/signup" className="btn btn-small">
                Sign up
              </Link>
            </div>
          )}
        </nav>
      </div>
    </header>
  )
}

function Footer() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <span>© {new Date().getFullYear()} Ma’at</span>
        <nav className="footer-links" aria-label="Legal">
          <Link to="/privacy">Privacy policy</Link>
          <Link to="/terms">Terms of use</Link>
        </nav>
      </div>
    </footer>
  )
}

export default function Layout() {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <div className="shell">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      {/* The problem page uses the full width, so it has no room for the columns */}
      {!pathname.startsWith('/problems/') && <Glyphs variant={pathname === '/' ? 'hero' : 'ambient'} />}
      <Header />
      <main id="main" className="shell-main">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}
