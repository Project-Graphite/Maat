import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Avatar } from '../../components/Layout.jsx'
import Pagination from '../../components/Pagination.jsx'
import { EmptyState, ErrorState, Loading } from '../../components/States.jsx'
import { useAuth } from '../../context/Auth.jsx'
import { useUi } from '../../context/Ui.jsx'
import { api, query } from '../../lib/api.js'
import { useAsync, useDebounced } from '../../lib/hooks.js'
import { ROLE_LABELS, canChangeRole, canManage } from '../../lib/roles.js'

const LIMIT = 20

export default function AdminUsers() {
  const [params, setParams] = useSearchParams()
  const page = Number(params.get('page')) || 1
  const [search, setSearch] = useState('')
  const debounced = useDebounced(search)
  const { user: me } = useAuth()
  const { toast, confirm } = useUi()

  const { data, error, loading, reload } = useAsync(
    (signal) => api(`/users${query({ page, limit: LIMIT, search: debounced })}`, { signal }),
    [page, debounced],
  )
  const users = data?.data.users || []

  const changeRole = async (user, role) => {
    if (role === 'admin') {
      const ok = await confirm(`${user.name} will be able to manage problems, contests and users.`, {
        confirmLabel: 'Make admin',
        title: 'Make this person an admin?',
      })
      if (!ok) return reload()
    }
    try {
      await api(`/users/${user._id}/role`, { method: 'PATCH', body: { role } })
      toast(`${user.name} is now ${role === 'admin' ? 'an admin' : 'a regular user'}.`, 'success')
    } catch (err) {
      toast(err.message, 'error')
    }
    reload()
  }

  const remove = async (user) => {
    const ok = await confirm(`${user.name}’s account, photo, submissions and contest results will be deleted for good.`, {
      confirmLabel: 'Delete user',
      title: 'Delete this user?',
    })
    if (!ok) return
    try {
      await api(`/users/${user._id}`, { method: 'DELETE' })
      toast(`${user.name} was deleted.`, 'success')
    } catch (err) {
      toast(err.message, 'error')
    }
    reload()
  }

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Users</h1>
          <p>Admins manage problems and contests and can delete regular users. Only the super admin changes roles and manages admins.</p>
        </div>
      </header>

      <div className="toolbar">
        <label htmlFor="search" className="sr-only">
          Search users by name
        </label>
        <input id="search" type="search" className="input" placeholder="Search by name" value={search} onChange={(e) => { setSearch(e.target.value); setParams({}, { replace: true }) }} />
      </div>

      {loading && !data && <Loading />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {data && users.length === 0 && <EmptyState title="No users found" />}

      {users.length > 0 && (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Email</th>
                  <th scope="col">Role</th>
                  <th scope="col">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user._id}>
                    <td>
                      <div className="row" style={{ gap: 12 }}>
                        <Avatar user={user} />
                        <span>{user.name}</span>
                      </div>
                    </td>
                    <td className="muted">{user.email}</td>
                    <td>
                      {canChangeRole(me, user) ? (
                        <>
                          <label className="sr-only" htmlFor={`role-${user._id}`}>
                            Role of {user.name}
                          </label>
                          <select
                            id={`role-${user._id}`}
                            className="select"
                            style={{ width: 'auto', minWidth: 130 }}
                            value={user.role}
                            onChange={(e) => changeRole(user, e.target.value)}
                          >
                            <option value="user">User</option>
                            <option value="admin">Admin</option>
                          </select>
                        </>
                      ) : (
                        <span className={user.role === 'user' ? 'tag' : 'tag tag-gold'}>{ROLE_LABELS[user.role]}</span>
                      )}
                    </td>
                    <td className="num">
                      {canManage(me, user) && (
                        <button className="btn btn-danger btn-small" onClick={() => remove(user)}>
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} total={data.total} limit={LIMIT} onPage={(p) => setParams(p > 1 ? { page: String(p) } : {}, { replace: true })} />
        </>
      )}
    </>
  )
}
