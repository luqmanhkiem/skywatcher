import { Routes, Route, NavLink, Navigate } from 'react-router-dom'
import { Activity, Luggage, Bell, BarChart2, Plane, Radio, LogOut, User, Users, Wifi, WifiOff } from 'lucide-react'
import { useCallback, useEffect, useRef } from 'react'

import { useAuth }       from './context/AuthContext'
import { useToast }      from './context/ToastContext'
import ProtectedRoute    from './components/ProtectedRoute'
import LoginPage         from './pages/LoginPage'
import LiveMap           from './pages/LiveMap'
import BagTable          from './pages/BagTable'
import AlertPanel        from './pages/AlertPanel'
import StatsView         from './pages/StatsView'
import FlightsView       from './pages/FlightsView'
import PassengerTrack    from './pages/PassengerTrack'
import UsersView         from './pages/UsersView'
import PublicTrack       from './pages/PublicTrack'
import { usePolling }    from './hooks/usePolling'
import { fetchAlerts }   from './utils/api'

// Nav items per role
const NAV_ADMIN = [
  { to: '/',        icon: Activity,  label: 'Live Map'  },
  { to: '/bags',    icon: Luggage,   label: 'Bags'      },
  { to: '/alerts',  icon: Bell,      label: 'Alerts'    },
  { to: '/stats',   icon: BarChart2, label: 'Analytics' },
  { to: '/flights', icon: Plane,     label: 'Flights'   },
  { to: '/users',   icon: Users,     label: 'Users'     },
]

const NAV_STAFF = [
  { to: '/',       icon: Activity, label: 'Live Map' },
  { to: '/bags',   icon: Luggage,  label: 'Bags'     },
  { to: '/alerts', icon: Bell,     label: 'Alerts'   },
]

const ROLE_BADGE_STYLE = {
  admin:        { bg: 'rgba(245,166,35,0.12)',  color: '#F5A623' },
  ground_staff: { bg: 'rgba(0,204,125,0.12)',   color: '#00CC7D' },
  passenger:    { bg: 'rgba(167,139,250,0.12)', color: '#A78BFA' },
}

const ROLE_LABELS = {
  admin:        'Admin',
  ground_staff: 'Ground Staff',
  passenger:    'Passenger',
}

function Sidebar({ unresolved, error }) {
  const { user, logout, isRole } = useAuth()
  const nav = isRole('admin') ? NAV_ADMIN : NAV_STAFF
  const roleStyle = ROLE_BADGE_STYLE[user?.role] ?? ROLE_BADGE_STYLE.admin

  return (
    <aside style={{
      width: 220,
      background: 'var(--surface)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
      position: 'relative',
    }}>
      {/* Amber accent top rule */}
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0,
        height: 2,
        background: 'linear-gradient(90deg, var(--accent) 0%, transparent 100%)',
      }} />

      {/* Logo */}
      <div style={{ padding: '22px 18px 16px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* SW monogram */}
          <div style={{
            width: 36, height: 36, borderRadius: 8,
            background: 'var(--surface-2)',
            border: '1px solid var(--accent)',
            boxShadow: '0 0 12px var(--accent-glow)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Luggage size={17} color="var(--accent)" />
          </div>
          <div>
            <div style={{
              fontFamily: 'var(--font-heading)',
              fontWeight: 700,
              fontSize: 16,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--text)',
              lineHeight: 1,
            }}>
              SkyWatcher
            </div>
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              color: 'var(--accent)',
              marginTop: 3,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              opacity: 0.8,
            }}>
              OPS CENTER
            </div>
          </div>
        </div>
      </div>

      {/* Nav links */}
      <nav style={{ padding: '12px 10px', flex: 1 }}>
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 9, fontWeight: 500,
          color: 'var(--muted)',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          padding: '4px 10px 10px',
        }}>
          Navigation
        </div>
        {nav.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 10px',
              borderRadius: 7,
              marginBottom: 2,
              fontSize: 13,
              fontWeight: isActive ? 600 : 400,
              color: isActive ? 'var(--accent)' : 'var(--muted-2)',
              background: isActive ? 'var(--accent-dim)' : 'transparent',
              borderLeft: isActive ? '2px solid var(--accent)' : '2px solid transparent',
              transition: 'all 0.15s ease',
              cursor: 'pointer',
              textDecoration: 'none',
              letterSpacing: '0.01em',
            })}
            onMouseEnter={e => {
              if (!e.currentTarget.style.color.includes('F5A623')) {
                e.currentTarget.style.background = 'rgba(245,166,35,0.05)'
                e.currentTarget.style.color = 'var(--text-2)'
              }
            }}
            onMouseLeave={e => {
              if (!e.currentTarget.style.color.includes('F5A623')) {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.color = 'var(--muted-2)'
              }
            }}
          >
            <Icon size={15} strokeWidth={1.75} />
            <span style={{ flex: 1 }}>{label}</span>
            {label === 'Alerts' && unresolved > 0 && (
              <span style={{
                background: 'var(--danger)',
                color: '#fff',
                fontFamily: 'var(--font-mono)',
                fontSize: 9, fontWeight: 700,
                borderRadius: 10,
                padding: '1px 6px',
                minWidth: 18,
                textAlign: 'center',
                lineHeight: '16px',
              }}>
                {unresolved > 99 ? '99+' : unresolved}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User info + logout */}
      <div style={{ borderTop: '1px solid var(--border)', padding: '12px 12px 14px' }}>
        {/* User card */}
        <div style={{
          background: 'var(--surface-2)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: '9px 10px',
          marginBottom: 8,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
            <div style={{
              width: 26, height: 26, borderRadius: '50%',
              background: roleStyle.bg,
              border: `1px solid ${roleStyle.color}40`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <User size={12} color={roleStyle.color} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.username}
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--muted-2)', letterSpacing: '0.04em' }}>
                {user?.checkpoint ? `${user.checkpoint.toUpperCase()}` : ROLE_LABELS[user?.role]}
              </div>
            </div>
          </div>
          <span style={{
            display: 'inline-block',
            padding: '1px 6px',
            borderRadius: 3,
            fontFamily: 'var(--font-mono)',
            fontSize: 8,
            fontWeight: 600,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            background: roleStyle.bg,
            color: roleStyle.color,
          }}>
            {ROLE_LABELS[user?.role]}
          </span>
        </div>

        <button
          onClick={logout}
          style={{
            width: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            padding: '7px',
            background: 'transparent',
            border: '1px solid var(--border)',
            borderRadius: 7,
            color: 'var(--muted-2)',
            fontSize: 12,
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,51,85,0.08)'; e.currentTarget.style.color = 'var(--danger)'; e.currentTarget.style.borderColor = 'rgba(255,51,85,0.3)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--muted-2)'; e.currentTarget.style.borderColor = 'var(--border)' }}
        >
          <LogOut size={12} />
          Sign out
        </button>

        {/* System status */}
        <div style={{ marginTop: 10, padding: '7px 8px', borderRadius: 6, background: 'var(--bg)', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <div style={{
              width: 6, height: 6, borderRadius: '50%',
              background: error ? 'var(--danger)' : 'var(--success)',
              flexShrink: 0,
            }} className={!error ? 'live-dot-green' : ''} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: error ? 'var(--danger)' : 'var(--success)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              {error ? 'OFFLINE' : 'SYS ONLINE'}
            </span>
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--muted)', letterSpacing: '0.04em' }}>
            PSM 2025/2026 · UTEM · B032310853
          </div>
        </div>
      </div>
    </aside>
  )
}

function StaffLayout() {
  const fetchFn = useCallback(() => fetchAlerts(100), [])
  const { data: alertData, error } = usePolling(fetchFn, 3000)
  const unresolved = alertData?.unresolved ?? 0
  const { showToast } = useToast()
  const seenAlertIds = useRef(null)

  useEffect(() => {
    if (!alertData) return
    const alerts = alertData.alerts ?? []
    if (seenAlertIds.current === null) {
      seenAlertIds.current = new Set(alerts.map(a => a.id))
      return
    }
    const newOnes = alerts.filter(a => !a.resolved && !seenAlertIds.current.has(a.id))
    newOnes.forEach(a => showToast(
      `${a.type.replace('_', ' ')} — Tag ${a.tag_id} @ ${a.checkpoint ?? 'unknown'}`,
      'anomaly'
    ))
    seenAlertIds.current = new Set(alerts.map(a => a.id))
  }, [alertData, showToast])

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar unresolved={unresolved} error={error} />
      <main style={{ flex: 1, overflow: 'auto', background: 'var(--bg)' }}>
        <Routes>
          <Route path="/"        element={<LiveMap />}     />
          <Route path="/bags"    element={<BagTable />}    />
          <Route path="/alerts"  element={<AlertPanel />}  />
          <Route path="/stats"   element={
            <ProtectedRoute roles={['admin']}>
              <StatsView />
            </ProtectedRoute>
          } />
          <Route path="/flights" element={
            <ProtectedRoute roles={['admin']}>
              <FlightsView />
            </ProtectedRoute>
          } />
          <Route path="/users" element={
            <ProtectedRoute roles={['admin']}>
              <UsersView />
            </ProtectedRoute>
          } />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}

export default function App() {
  const { user, loading } = useAuth()

  // Wait for token validation before rendering anything
  if (loading) return null

  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={
        user ? <Navigate to={user.role === 'passenger' ? '/track' : '/'} replace /> : <LoginPage />
      } />

      {/* Public passenger tracking — no login required */}
      <Route path="/track" element={<PublicTrack />} />

      {/* Authenticated passenger view (legacy — kept for backward compat) */}
      <Route path="/my-bag" element={
        <ProtectedRoute roles={['passenger']}>
          <PassengerTrack />
        </ProtectedRoute>
      } />

      {/* Admin + Ground Staff — everything else */}
      <Route path="/*" element={
        <ProtectedRoute roles={['admin', 'ground_staff']}>
          <StaffLayout />
        </ProtectedRoute>
      } />
    </Routes>
  )
}
