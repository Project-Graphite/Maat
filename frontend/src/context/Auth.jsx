import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api.js'
import { resetSocket } from '../lib/socket.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api('/users/me')
      .then((res) => setUser(res.data.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

  const signIn = useCallback(async (path, body) => {
    const res = await api(path, { method: 'POST', body })
    resetSocket()
    setUser(res.data.user)
    return res.data.user
  }, [])

  const value = useMemo(
    () => ({
      user,
      loading,
      setUser,
      login: (email, password) => signIn('/auth/login', { email, password }),
      signup: (body) => signIn('/auth/signup', body),
      resetPassword: (token, body) =>
        api(`/auth/reset-password/${token}`, { method: 'PATCH', body }).then((res) => {
          resetSocket()
          setUser(res.data.user)
        }),
      logout: async () => {
        await api('/auth/logout', { method: 'POST' }).catch(() => {})
        resetSocket()
        setUser(null)
      },
    }),
    [user, loading, signIn],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
