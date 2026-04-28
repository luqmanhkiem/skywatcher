import { useCallback, useState } from 'react'
import { AlertTriangle, CheckCircle2, MapPin, ShieldOff, CheckCheck, Bell } from 'lucide-react'
import { usePolling }              from '../hooks/usePolling'
import { fetchAlerts, resolveAlert } from '../utils/api'
import { useToast }                from '../context/ToastContext'
import PageHeader                  from '../components/PageHeader'
import StatusBadge                 from '../components/StatusBadge'

const ANOMALY_META = {
  STALL:           { Icon: AlertTriangle, color: '#FF7A2F', dimColor: 'rgba(255,122,47,0.1)'  },
  WRONG_ROUTE:     { Icon: MapPin,        color: '#FF3355', dimColor: 'rgba(255,51,85,0.1)'   },
  SECURITY_BYPASS: { Icon: ShieldOff,     color: '#A78BFA', dimColor: 'rgba(167,139,250,0.1)' },
  ANOMALY:         { Icon: AlertTriangle, color: '#F5A623', dimColor: 'rgba(245,166,35,0.1)'  },
}

function parseISO(iso) {
  if (!iso) return null
  return new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z')
}

function fmt(iso) {
  const d = parseISO(iso)
  if (!d) return '—'
  const now = Date.now()
  const diff = Math.floor((now - d.getTime()) / 1000)
  if (diff < 60)   return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

const FILTER_OPTIONS = ['All', 'Unresolved', 'STALL', 'WRONG_ROUTE', 'SECURITY_BYPASS']

export default function AlertPanel() {
  const [resolving, setResolving] = useState(new Set())
  const [filter, setFilter]       = useState('All')
  const { showToast }             = useToast()
  const fn = useCallback(() => fetchAlerts(200), [])
  const { data, loading, error, refresh } = usePolling(fn, 3000)

  const allAlerts  = data?.alerts    ?? []
  const unresolved = data?.unresolved ?? 0

  const alerts = allAlerts.filter(a => {
    if (filter === 'Unresolved') return !a.resolved
    if (filter === 'All')        return true
    return a.type === filter
  })

  // Type counts for summary badges
  const typeCounts = ['STALL', 'WRONG_ROUTE', 'SECURITY_BYPASS'].reduce((acc, t) => {
    acc[t] = allAlerts.filter(a => a.type === t && !a.resolved).length
    return acc
  }, {})

  async function handleResolve(id) {
    setResolving(prev => new Set([...prev, id]))
    try {
      await resolveAlert(id)
      await refresh()
    } catch (err) {
      showToast(err.response?.data?.error ?? 'Failed to resolve alert', 'anomaly')
    } finally {
      setResolving(prev => { const s = new Set(prev); s.delete(id); return s })
    }
  }

  return (
    <div className="animate-fade-up">

      {/* ── Header ────────────────────────────────────────── */}
      <PageHeader
        title="Anomaly Alerts"
        subtitle={`${unresolved} unresolved · ${allAlerts.length} total`}
      >
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {FILTER_OPTIONS.map(f => {
            const isActive = filter === f
            const meta  = ANOMALY_META[f]
            const count = f === 'Unresolved' ? unresolved : (typeCounts[f] ?? null)
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  padding: '5px 11px',
                  borderRadius: 7,
                  border: isActive ? 'none' : '1px solid var(--border)',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: isActive ? 600 : 400,
                  background: isActive ? (meta?.color ?? 'var(--accent)') : 'transparent',
                  color: isActive ? '#fff' : 'var(--muted-2)',
                  transition: 'all 0.15s',
                  display: 'flex', alignItems: 'center', gap: 5,
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
              >
                {f}
                {count != null && count > 0 && (
                  <span style={{
                    background: isActive ? 'rgba(255,255,255,0.25)' : 'var(--danger)',
                    color: '#fff',
                    fontSize: 10, fontWeight: 700,
                    borderRadius: 8, padding: '1px 5px',
                  }}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </PageHeader>

      {/* ── Offline banner ─────────────────────────────── */}
      {error && !loading && (
        <div style={{
          margin: '0 24px',
          padding: '10px 16px',
          background: 'rgba(239,68,68,0.08)',
          border: '1px solid rgba(239,68,68,0.25)',
          borderRadius: 9,
          fontSize: 12,
          color: 'var(--danger)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span>⚠</span> Cannot reach backend — showing last known data
        </div>
      )}

      {/* ── Type summary strip ────────────────────────────── */}
      {!loading && allAlerts.length > 0 && (
        <div style={{ padding: '14px 24px 0', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {['STALL', 'WRONG_ROUTE', 'SECURITY_BYPASS'].map(type => {
            const { Icon, color, dimColor } = ANOMALY_META[type]
            const total     = allAlerts.filter(a => a.type === type).length
            const unresolvedN = allAlerts.filter(a => a.type === type && !a.resolved).length
            if (total === 0) return null
            return (
              <div key={type} style={{
                background: dimColor,
                border: `1px solid ${color}30`,
                borderRadius: 9,
                padding: '10px 16px',
                display: 'flex', alignItems: 'center', gap: 10,
                minWidth: 160,
                cursor: 'pointer',
              }}
              onClick={() => setFilter(type)}
              >
                <Icon size={16} color={color} />
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color }}>
                    {type.replace('_', ' ')}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted-2)' }}>
                    {unresolvedN} unresolved of {total}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Alert list ────────────────────────────────────── */}
      <div style={{ padding: '16px 24px 28px', display: 'flex', flexDirection: 'column', gap: 8 }}>

        {loading && (
          [1,2,3].map(i => (
            <div key={i} style={{ height: 86, background: 'var(--surface)', borderRadius: 11 }} className="skeleton" />
          ))
        )}

        {!loading && alerts.length === 0 && (
          <div style={{ textAlign: 'center', padding: '72px 0', color: 'var(--muted)' }}>
            <CheckCircle2 size={36} style={{ marginBottom: 14, color: 'var(--success)', opacity: 0.7 }} />
            <p style={{ fontFamily: 'var(--font-heading)', fontSize: 18, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6, color: 'var(--text-2)' }}>
              {filter === 'All' ? 'All Clear' : `No ${filter.replace('_', ' ')} alerts`}
            </p>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)', letterSpacing: '0.06em' }}>
              {filter === 'All' ? 'NO ANOMALIES DETECTED — SYSTEM NOMINAL' : 'Try another filter.'}
            </p>
          </div>
        )}

        {alerts.map(alert => {
          const meta = ANOMALY_META[alert.type] ?? ANOMALY_META.ANOMALY
          const { Icon, color, dimColor } = meta
          return (
            <div
              key={alert.id}
              className={alert.resolved ? '' : 'animate-fade-up'}
              style={{
                background: 'var(--surface)',
                border: `1px solid ${alert.resolved ? 'var(--border)' : color + '35'}`,
                borderLeft: `3px solid ${alert.resolved ? 'var(--border)' : color}`,
                borderRadius: 11,
                padding: '14px 18px',
                display: 'flex',
                gap: 14,
                alignItems: 'flex-start',
                opacity: alert.resolved ? 0.48 : 1,
                transition: 'opacity 0.2s, border-color 0.2s',
              }}
            >
              {/* Icon */}
              <div style={{
                marginTop: 1, flexShrink: 0,
                width: 32, height: 32, borderRadius: 8,
                background: alert.resolved ? 'var(--surface-2)' : dimColor,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon size={16} color={alert.resolved ? 'var(--muted)' : color} />
              </div>

              {/* Body */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, flexWrap: 'wrap' }}>
                  <StatusBadge label={alert.type} />
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600, color: 'var(--accent)', letterSpacing: '0.04em' }}>
                    {alert.tag_id}
                  </span>
                  {alert.checkpoint && (
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--muted-2)', background: 'var(--surface-2)', borderRadius: 4, padding: '2px 6px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                      {alert.checkpoint}
                    </span>
                  )}
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted)', marginLeft: 'auto', letterSpacing: '0.04em' }}>
                    {fmt(alert.created_at)}
                  </span>
                </div>

                <p style={{ fontSize: 13, color: 'var(--muted-2)', lineHeight: 1.55 }}>
                  {alert.description}
                </p>

                {/* Confidence bar */}
                {alert.score != null && (
                  <div style={{ marginTop: 9, display: 'flex', alignItems: 'center', gap: 9 }}>
                    <span style={{ fontSize: 10, color: 'var(--muted)', flexShrink: 0, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                      Confidence
                    </span>
                    <div style={{
                      flex: 1, maxWidth: 130,
                      height: 4, background: 'var(--border)',
                      borderRadius: 2, overflow: 'hidden',
                    }}>
                      <div style={{
                        width: `${Math.round(alert.score * 100)}%`,
                        height: '100%',
                        background: alert.score > 0.7 ? 'var(--danger)' : color,
                        borderRadius: 2,
                        transition: 'width 0.4s ease',
                      }} />
                    </div>
                    <span style={{ fontSize: 11, color, fontWeight: 600, flexShrink: 0 }}>
                      {Math.round(alert.score * 100)}%
                    </span>
                  </div>
                )}
              </div>

              {/* Action */}
              {!alert.resolved ? (
                <button
                  onClick={() => handleResolve(alert.id)}
                  disabled={resolving.has(alert.id)}
                  style={{
                    flexShrink: 0,
                    padding: '6px 13px',
                    background: 'transparent',
                    border: '1px solid var(--border-2)',
                    borderRadius: 7,
                    color: 'var(--muted-2)',
                    fontSize: 12,
                    cursor: resolving.has(alert.id) ? 'not-allowed' : 'pointer',
                    transition: 'all 0.15s',
                    display: 'flex', alignItems: 'center', gap: 5,
                    opacity: resolving.has(alert.id) ? 0.6 : 1,
                  }}
                  onMouseEnter={e => { if (!resolving.has(alert.id)) { e.currentTarget.style.borderColor = 'var(--success)'; e.currentTarget.style.color = 'var(--success)' } }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-2)'; e.currentTarget.style.color = 'var(--muted-2)' }}
                >
                  {resolving.has(alert.id)
                    ? <><span className="animate-spin" style={{ display: 'inline-block', width: 10, height: 10, border: '1.5px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%' }} /> Resolving</>
                    : <><CheckCheck size={13} /> Resolve</>
                  }
                </button>
              ) : (
                <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--success)' }}>
                  <CheckCircle2 size={15} />
                  <span>Resolved</span>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
