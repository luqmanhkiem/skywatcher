import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import api from '../utils/api'

const AuthContext = createContext(null)

const TOKEN_KEY = 'sw_token'

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null)   // { id, username, role, checkpoint, flight_id, tag_id }
  const [token,   setToken]   = useState(() => localStorage.getItem(TOKEN_KEY))
  const [loading, setLoading] = useState(true)   // true until initial token validation resolves

  // Validate stored token on mount and re-hydrate user state
  useEffect(() => {
    if (!token) {
      setLoading(false)
      return
    }

    api.get('/auth/me')
      .then(r => setUser(r.data.user))
      .catch(() => {
        // Token stale or invalid — clear it
        localStorage.removeItem(TOKEN_KEY)
        setToken(null)
        setUser(null)
      })
      .finally(() => setLoading(false))
  }, []) // run once on mount only

  const login = useCallback(async (username, password) => {
    const { data } = await api.post('/auth/login', { username, password })
    localStorage.setItem(TOKEN_KEY, data.token)
    setToken(data.token)
    setUser(data.user)
    return data.user   // caller can read role for redirect
  }, [])

  const logout = useCallback(() => {
    api.post('/auth/logout').catch(() => {})   // best-effort
    localStorage.removeItem(TOKEN_KEY)
    setToken(null)
    setUser(null)
  }, [])

  const isRole = useCallback((...roles) => {
    return user ? roles.includes(user.role) : false
  }, [user])

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, isRole }}>
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
