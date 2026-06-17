import { Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom'
import { Activity, Luggage, Bell, BarChart2, Plane, Radio, LogOut, User, Users, MessageSquare, Menu, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { useIsMobile }  from './hooks/useIsMobile'

import { useAuth }       from './context/AuthContext'
import { useToast }      from './context/ToastContext'
import ProtectedRoute    from './components/ProtectedRoute'
import LoginPage         from './pages/LoginPage'
import LiveMap           from './pages/LiveMap'
import BagTable          from './pages/BagTable'
import AlertPanel        from './pages/AlertPanel'
import StatsView         from './pages/StatsView'
import FlightsView       from './pages/FlightsView'
import UsersView         from './pages/UsersView'
import InjectBagView     from './pages/InjectBagView'
import FeedbackInbox     from './pages/FeedbackInbox'
import PublicTrack       from './pages/PublicTrack'
import MarketingLanding  from './pages/MarketingLanding'
import FeedbackPage      from './pages/FeedbackPage'
import { usePolling }    from './hooks/usePolling'
import { fetchAlerts, fetchFeedback } from './utils/api'

// Nav items per role
const NAV_ADMIN = [
  { to: '/dashboard', icon: Activity,  label: 'Live Map'  },
  { to: '/bags',      icon: Luggage,   label: 'Bags'      },
  { to: '/alerts',    icon: Bell,      label: 'Alerts'    },
  { to: '/stats',     icon: BarChart2, label: 'Analytics' },
  { to: '/flights',   icon: Plane,     label: 'Flights'   },
  { to: '/inject',    icon: Radio,         label: 'Inject Bag' },
  { to: '/support',   icon: MessageSquare, label: 'Support'   },
  { to: '/users',     icon: Users,         label: 'Users'     },
]

const NAV_STAFF = [
  { to: '/dashboard', icon: Activity,      label: 'Live Map' },
  { to: '/bags',      icon: Luggage,       label: 'Bags'     },
  { to: '/alerts',    icon: Bell,          label: 'Alerts'   },
  { to: '/support',   icon: MessageSquare, label: 'Support'  },
]

const ROLE_BADGE_STYLE = {
  admin:        { bg: 'rgba(245,166,35,0.12)',  color: '#F5A623' },
  ground_staff: { bg: 'rgba(0,204,125,0.12)',   color: '#00CC7D' },
}

const ROLE_LABELS = {
  admin:        'Admin',
  ground_staff: 'Ground Staff',
}

const navBadge = {
  background: 'var(--danger)',
  color: '#fff',
  fontFamily: 'var(--font-mono)',
  fontSize: 9, fontWeight: 700,
  borderRadius: 10,
  padding: '1px 6px',
  minWidth: 18,
  textAlign: 'center',
  lineHeight: '16px',
}

function Sidebar({ unresolved, newFeedback, error, isMobile, drawerOpen, onClose }) {
  const { user, logout, isRole } = useAuth()
  const nav = isRole('admin') ? NAV_ADMIN : NAV_STAFF
  const roleStyle = ROLE_BADGE_STYLE[user?.role] ?? ROLE_BADGE_STYLE.admin

  // Mobile: fixed-position drawer that slides in from the left.
  // Desktop: regular flex item, always visible.
  const asideStyle = isMobile
    ? {
        position: 'fixed',
        top: 0, left: 0, bottom: 0,
        width: 260,
        background: 'var(--surface)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 200,
        transform: drawerOpen ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 0.22s ease',
        boxShadow: drawerOpen ? '0 0 30px rgba(0,0,0,0.18)' : 'none',
      }
    : {
        width: 220,
        background: 'var(--surface)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        position: 'relative',
      }

  return (
    <>
      {/* Backdrop overlay — only on mobile when drawer is open */}
      {isMobile && drawerOpen && (
        <div
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.4)',
            zIndex: 199,
            backdropFilter: 'blur(2px)',
          }}
        />
      )}

      <aside style={asideStyle}>
      {isMobile && (
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: 14, right: 14,
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            width: 32, height: 32,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--text-2)',
            cursor: 'pointer',
            zIndex: 1,
          }}
          aria-label="Close menu"
        >
          <X size={16} />
        </button>
      )}
      {/* Logo */}
      <div style={{ padding: '22px 18px 18px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          {/* S monogram */}
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'var(--text)',
            color: 'var(--bg)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 900, fontSize: 18,
            flexShrink: 0,
          }}>S</div>
          <div>
            <div style={{
              fontWeight: 700,
              fontSize: 16,
              letterSpacing: '-0.01em',
              color: 'var(--text)',
              lineHeight: 1.1,
            }}>
              SkyWatcher
            </div>
            <div style={{
              fontSize: 11,
              color: 'var(--muted)',
              marginTop: 2,
              fontWeight: 500,
            }}>
              Ops dashboard
            </div>
          </div>
        </div>
      </div>

      {/* Nav links */}
      <nav style={{ padding: '14px 10px', flex: 1 }}>
        <div style={{
          fontSize: 11, fontWeight: 600,
          color: 'var(--muted)',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          padding: '4px 10px 10px',
        }}>
          Navigation
        </div>
        {nav.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/dashboard'}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '9px 12px',
              borderRadius: 8,
              marginBottom: 2,
              fontSize: 14,
              fontWeight: isActive ? 600 : 500,
              color: isActive ? 'var(--text)' : 'var(--text-2)',
              background: isActive ? 'var(--surface-3)' : 'transparent',
              transition: 'all 0.15s ease',
              cursor: 'pointer',
              textDecoration: 'none',
            })}
            onMouseEnter={e => {
              if (!e.currentTarget.classList.contains('active')) {
                e.currentTarget.style.background = 'var(--surface-2)'
              }
            }}
            onMouseLeave={e => {
              if (!e.currentTarget.classList.contains('active')) {
                e.currentTarget.style.background = 'transparent'
              }
            }}
          >
            <Icon size={15} strokeWidth={1.75} />
            <span style={{ flex: 1 }}>{label}</span>
            {label === 'Alerts' && unresolved > 0 && (
              <span style={navBadge}>
                {unresolved > 99 ? '99+' : unresolved}
              </span>
            )}
            {label === 'Support' && newFeedback > 0 && (
              <span style={navBadge}>
                {newFeedback > 99 ? '99+' : newFeedback}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User info + logout */}
      <div style={{ borderTop: '1px solid var(--border)', padding: '14px 12px 14px' }}>
        {/* User card */}
        <div style={{
          background: 'var(--surface-2)',
          borderRadius: 10,
          padding: '11px 12px',
          marginBottom: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 30, height: 30, borderRadius: '50%',
              background: roleStyle.bg,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <User size={13} color={roleStyle.color} />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.username}
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>
                {ROLE_LABELS[user?.role]}
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={logout}
          style={{
            width: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            padding: '9px',
            background: 'transparent',
            border: '1px solid var(--border-2)',
            borderRadius: 8,
            color: 'var(--text-2)',
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'all 0.15s',
            fontFamily: 'var(--font-body)',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(220,38,38,0.06)'; e.currentTarget.style.color = 'var(--danger)'; e.currentTarget.style.borderColor = 'rgba(220,38,38,0.25)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-2)'; e.currentTarget.style.borderColor = 'var(--border-2)' }}
        >
          <LogOut size={13} />
          Sign out
        </button>

        {/* System status */}
        <div style={{ marginTop: 12, padding: '8px 10px', borderRadius: 8, background: 'var(--surface-2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <div style={{
              width: 7, height: 7, borderRadius: '50%',
              background: error ? 'var(--danger)' : 'var(--success)',
              flexShrink: 0,
            }} className={!error ? 'live-dot-green' : ''} />
            <span style={{ fontSize: 11, fontWeight: 600, color: error ? 'var(--danger)' : 'var(--success)' }}>
              {error ? 'Offline' : 'System online'}
            </span>
          </div>
          <div style={{ fontSize: 10, color: 'var(--muted)' }}>
            PSM 2025/2026 · B032310853
          </div>
        </div>
      </div>
    </aside>
    </>
  )
}

function StaffLayout() {
  const fetchFn = useCallback(() => fetchAlerts(100), [])
  const { data: alertData, error } = usePolling(fetchFn, 3000)
  const unresolved = alertData?.unresolved ?? 0

  const feedbackFn = useCallback(() => fetchFeedback(200), [])
  const { data: feedbackData } = usePolling(feedbackFn, 5000)
  const newFeedback = feedbackData?.counts?.new ?? 0

  const { showToast } = useToast()
  const seenAlertIds = useRef(null)

  const isMobile = useIsMobile()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const location = useLocation()

  // Close drawer whenever the user navigates (tapping a nav link)
  useEffect(() => {
    setDrawerOpen(false)
  }, [location.pathname])

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
      <Sidebar
        unresolved={unresolved}
        newFeedback={newFeedback}
        error={error}
        isMobile={isMobile}
        drawerOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
      <main style={{ flex: 1, overflow: 'auto', background: 'var(--bg)', position: 'relative' }}>
        {/* Mobile hamburger */}
        {isMobile && (
          <button
            onClick={() => setDrawerOpen(true)}
            style={{
              position: 'fixed',
              top: 12, left: 12,
              zIndex: 50,
              width: 38, height: 38,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--surface)',
              border: '1px solid var(--border-2)',
              borderRadius: 10,
              color: 'var(--text)',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            }}
            aria-label="Open menu"
          >
            <Menu size={18} />
            {unresolved > 0 && (
              <span style={{
                position: 'absolute',
                top: -4, right: -4,
                background: 'var(--danger)',
                color: '#fff',
                fontFamily: 'var(--font-mono)',
                fontSize: 9, fontWeight: 700,
                borderRadius: 10,
                padding: '1px 5px',
                minWidth: 16,
                textAlign: 'center',
                lineHeight: '14px',
              }}>
                {unresolved > 99 ? '99+' : unresolved}
              </span>
            )}
          </button>
        )}
        <Routes>
          <Route path="/dashboard" element={<LiveMap />}     />
          <Route path="/bags"      element={<BagTable />}    />
          <Route path="/alerts"    element={<AlertPanel />}  />
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
          <Route path="/inject" element={
            <ProtectedRoute roles={['admin']}>
              <InjectBagView />
            </ProtectedRoute>
          } />
          <Route path="/support" element={<FeedbackInbox />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
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
      {/* Public marketing landing — main page */}
      <Route path="/" element={<MarketingLanding />} />

      {/* Public passenger tracking — no login required */}
      <Route path="/track" element={<PublicTrack />} />

      {/* Public feedback / issue reporting — no login required */}
      <Route path="/feedback" element={<FeedbackPage />} />

      {/* Staff sign in */}
      <Route path="/login" element={
        user ? <Navigate to="/dashboard" replace /> : <LoginPage />
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
