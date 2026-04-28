import { useCallback } from 'react'
import { LogOut, Luggage, AlertTriangle, CheckCircle, Clock, Plane } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { usePolling } from '../hooks/usePolling'
import { fetchMyBag, fetchMyBagHistory } from '../utils/api'

const CHECKPOINTS = ['check_in', 'security', 'sorting', 'loading', 'arrival']

const CP_META = {
  check_in: { label: 'Check-In',  color: '#3b82f6', icon: '🧳' },
  security: { label: 'Security',  color: '#8b5cf6', icon: '🛡️' },
  sorting:  { label: 'Sorting',   color: '#f59e0b', icon: '📦' },
  loading:  { label: 'Loading',   color: '#ef4444', icon: '✈️' },
  arrival:  { label: 'Arrival',   color: '#22c55e', icon: '✅' },
}

function parseISO(iso) {
  if (!iso) return null
  return new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z')
}

function timeAgo(iso) {
  const d = parseISO(iso)
  if (!d) return '—'
  const diff = Math.floor((Date.now() - d.getTime()) / 1000)
  if (diff < 60)   return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  return `${Math.floor(diff / 3600)}h ago`
}

function fmt(iso) {
  const d = parseISO(iso)
  return d ? d.toLocaleString() : '—'
}

export default function PassengerTrack() {
  const { user, logout } = useAuth()

  const bagFn     = useCallback(() => fetchMyBag(), [])
  const historyFn = useCallback(() => fetchMyBagHistory(), [])

  const { data: bagData,     loading: bagLoading,     error: bagError }     = usePolling(bagFn,     5000)
  const { data: historyData, loading: historyLoading }                       = usePolling(historyFn, 5000)

  const bag     = bagData?.bag ?? null
  const history = historyData?.events ?? []

  const currentIdx = bag ? CHECKPOINTS.indexOf(bag.last_checkpoint) : -1
  const isArrived  = bag?.status === 'arrived'

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>

      {/* ── Top bar ─────────────────────────────────────────── */}
      <header style={{
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface)',
        padding: '14px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 9,
            background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(59,130,246,0.3)',
          }}>
            <Luggage size={16} color="#fff" />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>SkyWatcher</div>
            <div style={{ fontSize: 10, color: 'var(--muted-2)' }}>Baggage Tracker</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{user?.username}</div>
            <div style={{ fontSize: 11, color: 'var(--muted-2)' }}>Passenger · {user?.flight_id ?? '—'}</div>
          </div>
          <button
            onClick={logout}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '7px 12px',
              color: 'var(--muted-2)',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            <LogOut size={13} />
            Sign out
          </button>
        </div>
      </header>

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '32px 24px' }}>

        {/* ── Flight info card ──────────────────────────────── */}
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 14,
          padding: '20px 24px',
          marginBottom: 20,
          display: 'flex',
          alignItems: 'center',
          gap: 16,
        }}>
          <div style={{
            width: 44, height: 44,
            borderRadius: 12,
            background: 'rgba(59,130,246,0.12)',
            border: '1px solid rgba(59,130,246,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Plane size={20} color="var(--accent)" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, color: 'var(--muted-2)', marginBottom: 2 }}>Your flight</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.3px' }}>
              {user?.flight_id ?? '—'}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: 'var(--muted-2)', marginBottom: 2 }}>Bag tag</div>
            <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>
              {user?.tag_id ?? '—'}
            </div>
          </div>
        </div>

        {/* ── Loading / error ───────────────────────────────── */}
        {bagLoading && (
          <div style={{ height: 160, background: 'var(--surface)', borderRadius: 14, marginBottom: 20 }} className="skeleton" />
        )}

        {bagError && !bagLoading && (
          <div style={{
            background: 'var(--warning-dim)',
            border: '1px solid rgba(245,158,11,0.25)',
            borderRadius: 12,
            padding: '20px 24px',
            marginBottom: 20,
            textAlign: 'center',
            color: 'var(--warning)',
          }}>
            <Clock size={28} style={{ marginBottom: 10, opacity: 0.7 }} />
            <p style={{ fontSize: 14, fontWeight: 500 }}>Bag not yet scanned</p>
            <p style={{ fontSize: 12, color: 'var(--muted-2)', marginTop: 6 }}>
              Your bag will appear here once it reaches Check-In. Refreshing every 5s.
            </p>
          </div>
        )}

        {/* ── Progress stepper ──────────────────────────────── */}
        {bag && !bagLoading && (
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 14,
            padding: '24px',
            marginBottom: 20,
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)', marginBottom: 24 }}>
              Baggage Journey
            </div>

            <div style={{ display: 'flex', alignItems: 'center' }}>
              {CHECKPOINTS.map((cp, idx) => {
                const { label, color, icon } = CP_META[cp]
                const isDone    = idx <= currentIdx
                const isCurrent = idx === currentIdx
                const isLast    = idx === CHECKPOINTS.length - 1

                return (
                  <div key={cp} style={{ display: 'flex', alignItems: 'center', flex: isLast ? 0 : 1 }}>
                    {/* Step circle */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                      <div style={{
                        width: 40, height: 40,
                        borderRadius: '50%',
                        background: isDone ? color : 'var(--surface-3)',
                        border: isCurrent ? `2px solid ${color}` : isDone ? 'none' : '2px solid var(--border)',
                        boxShadow: isCurrent ? `0 0 0 4px ${color}25` : 'none',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 18,
                        transition: 'all 0.3s',
                      }}>
                        {isDone ? (isArrived && idx === currentIdx ? '✅' : <span style={{ fontSize: 16 }}>{icon}</span>) : (
                          <span style={{ fontSize: 14, color: 'var(--muted)' }}>{idx + 1}</span>
                        )}
                      </div>
                      <div style={{
                        fontSize: 10,
                        fontWeight: isCurrent ? 700 : 500,
                        color: isDone ? color : 'var(--muted)',
                        whiteSpace: 'nowrap',
                        letterSpacing: '0.2px',
                      }}>
                        {label}
                      </div>
                    </div>

                    {/* Connector line */}
                    {!isLast && (
                      <div style={{
                        flex: 1,
                        height: 2,
                        margin: '0 4px',
                        marginBottom: 24,
                        background: idx < currentIdx ? CP_META[CHECKPOINTS[idx + 1]].color : 'var(--border)',
                        transition: 'background 0.4s',
                      }} />
                    )}
                  </div>
                )
              })}
            </div>

            {/* Status message */}
            <div style={{
              marginTop: 24,
              padding: '12px 16px',
              background: isArrived ? 'var(--success-dim)' : 'var(--accent-dim)',
              border: `1px solid ${isArrived ? 'rgba(34,197,94,0.2)' : 'rgba(59,130,246,0.2)'}`,
              borderRadius: 9,
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              {isArrived
                ? <CheckCircle size={16} color="var(--success)" />
                : <Clock size={16} color="var(--accent)" />}
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: isArrived ? 'var(--success)' : 'var(--accent)' }}>
                  {isArrived
                    ? 'Your bag has arrived at baggage claim!'
                    : `Currently at ${CP_META[bag.last_checkpoint]?.label ?? bag.last_checkpoint}`}
                </div>
                <div style={{ fontSize: 11, color: 'var(--muted-2)', marginTop: 2 }}>
                  Last updated {timeAgo(bag.last_seen)}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Checkpoint history ────────────────────────────── */}
        {!historyLoading && history.length > 0 && (
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 14,
            padding: '20px 24px',
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)', marginBottom: 16 }}>
              Scan History
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {history.map((ev, i) => {
                const meta = CP_META[ev.checkpoint]
                return (
                  <div key={ev.id ?? i} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '10px 0',
                    borderBottom: i < history.length - 1 ? '1px solid var(--border)' : 'none',
                  }}>
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: meta?.color ?? 'var(--muted)',
                      flexShrink: 0,
                    }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-2)' }}>
                        {meta?.label ?? ev.checkpoint}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--muted-2)', marginTop: 1 }}>
                        {ev.duration_mins ? `${ev.duration_mins} min at checkpoint` : ''}
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'right' }}>
                      {fmt(ev.timestamp)}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--muted)', marginTop: 32 }}>
          Updates every 5 seconds · PSM 2025/2026 · UTeM FTMK
        </p>
      </div>
    </div>
  )
}
