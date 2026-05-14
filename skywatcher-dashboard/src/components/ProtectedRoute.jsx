import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

/**
 * Guards a route by authentication and optional role check.
 *
 * Usage:
 *   <ProtectedRoute>                          — any logged-in user
 *   <ProtectedRoute roles={['admin']}>        — admin only
 *   <ProtectedRoute roles={['admin','ground_staff']}> — multiple roles
 *
 * While the initial token validation is in progress, renders nothing
 * to avoid a flash of the login page on page refresh.
 */
export default function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth()

  // Still validating stored token — render nothing to avoid flicker
  if (loading) return null

  // Not logged in
  if (!user) return <Navigate to="/login" replace />

  // Logged in but wrong role
  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}
