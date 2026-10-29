import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/Auth.jsx'
import { ErrorState, Loading } from './States.jsx'
import { isAdmin } from '../lib/roles.js'

export default function RequireAuth({ role, children }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <Loading />
  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/login?next=${next}`} replace />
  }
  if (role === 'admin' ? !isAdmin(user) : role && user.role !== role) {
    return <ErrorState error={{ status: 403, message: 'You do not have access to this page.' }} />
  }
  return children
}
