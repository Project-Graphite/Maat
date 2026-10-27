import { NavLink, Outlet } from 'react-router-dom'
import Seo from '../../components/Seo.jsx'

export default function AdminLayout() {
  return (
    <div className="page">
      <Seo title="Admin" description="Administration." path="/admin" noindex />
      <nav className="admin-nav" aria-label="Admin">
        <NavLink to="/admin" end>
          Overview
        </NavLink>
        <NavLink to="/admin/problems">Problems</NavLink>
        <NavLink to="/admin/contests">Contests</NavLink>
        <NavLink to="/admin/users">Users</NavLink>
      </nav>
      <Outlet />
    </div>
  )
}
