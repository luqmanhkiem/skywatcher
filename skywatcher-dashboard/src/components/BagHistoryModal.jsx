import { useCallback, useEffect, useRef } from 'react'
import { X, CheckCircle2, Clock, Tag, Plane, Printer } from 'lucide-react'
import { QRCodeSVG }       from 'qrcode.react'
import { usePolling }      from '../hooks/usePolling'
import { fetchBagHistory } from '../utils/api'

const CHECKPOINTS = ['check_in', 'security', 'sorting', 'loading', 'arrival']

const CP_LABELS = {
  check_in: 'Check-In',
  security: 'Security',
  sorting:  'Sorting',
  loading:  'Loading',
  arrival:  'Arrival',
}

const CP_COLORS = {
  check_in: '#38BDF8',
  security: '#F5A623',
  sorting:  '#A78BFA',
  loading:  '#F97316',
  arrival:  '#00CC7D',
}

function parseISO(iso) {
  if (!iso) return null
  return new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z')
}

function fmtTime(iso) {
  const d = parseISO(iso)
  return d ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'
}

function fmtDate(iso) {
  const d = parseISO(iso)
  if (!d) return '—'
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function BagHistoryModal({ tagId, passenger, flightId, onClose }) {
  const fn = useCallback(() => fetchBagHistory(tagId), [tagId])
  const { data, loading } = usePolling(fn, 5000)
  const events = data?.events ?? []
  const visited = new Set(events.map(e => e.checkpoint))
  const lastEvent = events[events.length - 1]
  const qrRef = useRef(null)

  // Public tracking URL encoded in the QR — PublicTrack reads `flight` + `passenger`
  const trackUrl = `${window.location.origin}/track?flight=${encodeURIComponent(flightId ?? '')}&passenger=${encodeURIComponent(passenger ?? '')}`

  // Print a physical bag tag: pop a minimal window with the QR + bag details
  function printTag() {
    const qrSvg = qrRef.current?.innerHTML ?? ''
    const win = window.open('', '_blank', 'width=420,height=560')
    if (!win) return
    win.document.write(`
      <html>
        <head><title>SkyWatcher bag tag — ${tagId}</title>
        <style>
          body { font-family: system-ui, sans-serif; text-align: center; padding: 32px; color: #111; }
          .tag { font-family: monospace; font-size: 22px; font-weight: 700; letter-spacing: 0.08em; margin-bottom: 4px; }
          .meta { font-size: 14px; color: #444; margin-bottom: 20px; }
          .brand { font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase; color: #888; margin-top: 18px; }
          svg { width: 220px; height: 220px; }
        </style></head>
        <body>
          <div class="tag">${tagId}</div>
          <div class="meta">${passenger ?? ''}${flightId ? ' &middot; ' + flightId : ''}</div>
          ${qrSvg}
          <div class="meta" style="margin-top:18px">Scan to track this bag</div>
          <div class="brand">SkyWatcher</div>
        </body>
      </html>`)
    win.document.close()
    win.focus()
    win.print()
  }

  // Close on Escape key
  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(15, 15, 15, 0.45)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="animate-scale-in"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border-2)',
          borderTop: '2px solid var(--accent)',
          borderRadius: 12,
          width: '100%',
          maxWidth: 580,
          maxHeight: '82vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 24px 60px rgba(0,0,0,0.12), 0 4px 16px rgba(0,0,0,0.06)',
        }}
      >
        {/* ── Header ──────────────────────────────────────── */}
        <div style={{
          padding: '18px 22px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 14,
        }}>
          <div style={{
            width: 38, height: 38, borderRadius: 9,
            background: 'var(--accent-dim)',
            border: '1px solid rgba(245,166,35,0.3)',
            boxShadow: '0 0 10px var(--accent-glow)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Tag size={17} color="var(--accent)" />
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontWeight: 600, fontSize: 15,
              letterSpacing: '0.06em',
              color: 'var(--accent)',
            }}>
              {tagId}
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted-2)', marginTop: 3, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>{passenger || 'Unknown Passenger'}</span>
              {flightId && (
                <>
                  <span style={{ color: 'var(--border-2)' }}>·</span>
                  <span style={{ fontFamily: 'var(--font-mono)', display: 'flex', alignItems: 'center', gap: 4, color: 'var(--success)', fontSize: 11, letterSpacing: '0.04em' }}>
                    <Plane size={11} />
                    {flightId}
                  </span>
                </>
              )}
              {lastEvent && (
                <>
                  <span style={{ color: 'var(--border-2)' }}>·</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: 'var(--muted-2)' }}>
                    <Clock size={11} />
                    {fmtDate(lastEvent.timestamp)}
                  </span>
                </>
              )}
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: 7,
              cursor: 'pointer',
              color: 'var(--muted-2)',
              padding: 5,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.15s',
              flexShrink: 0,
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-2)'; e.currentTarget.style.color = 'var(--text)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--muted-2)' }}
          >
            <X size={15} />
          </button>
        </div>

        {/* ── Pipeline progress ────────────────────────────── */}
        <div style={{
          padding: '18px 22px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface-2)',
        }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>
            Checkpoint Progress
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start' }}>
            {CHECKPOINTS.map((cp, i) => {
              const isVisited = visited.has(cp)
              const isLast    = i === CHECKPOINTS.length - 1
              const color     = CP_COLORS[cp]
              return (
                <div key={cp} style={{ flex: 1, display: 'flex', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                    <div style={{
                      width: 30, height: 30, borderRadius: '50%',
                      background: isVisited ? color : 'var(--surface-3)',
                      border: `2px solid ${isVisited ? color : 'var(--border-2)'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 0.25s',
                      boxShadow: isVisited ? `0 0 10px ${color}40` : 'none',
                    }}>
                      {isVisited
                        ? <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff', boxShadow: `0 0 6px ${color}` }} />
                        : <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--border-2)' }} />
                      }
                    </div>
                    <div style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 8, fontWeight: isVisited ? 600 : 400,
                      color: isVisited ? color : 'var(--muted)',
                      textAlign: 'center', lineHeight: 1.3,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                    }}>
                      {CP_LABELS[cp]}
                    </div>
                  </div>
                  {!isLast && (
                    <div style={{
                      height: 2,
                      flex: 1,
                      marginTop: 14,
                      background: visited.has(CHECKPOINTS[i + 1])
                        ? 'linear-gradient(90deg, ' + color + ', ' + CP_COLORS[CHECKPOINTS[i + 1]] + ')'
                        : 'var(--border)',
                      transition: 'background 0.3s',
                      flexShrink: 0,
                    }} />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* ── QR bag tag ───────────────────────────────────── */}
        <div style={{
          padding: '16px 22px',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 16,
        }}>
          <div ref={qrRef} style={{
            background: '#fff',
            padding: 8,
            borderRadius: 8,
            border: '1px solid var(--border)',
            display: 'flex',
            flexShrink: 0,
          }}>
            <QRCodeSVG value={trackUrl} size={72} level="M" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
              Passenger bag tag
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted-2)', lineHeight: 1.4 }}>
              Scan to open live tracking for this bag — no login needed.
            </div>
          </div>
          <button
            onClick={printTag}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: 'transparent',
              border: '1px solid var(--border-2)',
              borderRadius: 8,
              padding: '8px 14px',
              fontSize: 12, fontWeight: 600,
              color: 'var(--text-2)',
              cursor: 'pointer',
              fontFamily: 'var(--font-body)',
              flexShrink: 0,
            }}
          >
            <Printer size={13} /> Print tag
          </button>
        </div>

        {/* ── Event timeline ───────────────────────────────── */}
        <div style={{ overflow: 'auto', padding: '16px 22px 20px', flex: 1 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>
            Event History · {events.length} scan{events.length !== 1 ? 's' : ''}
          </div>

          {loading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[1, 2, 3].map(i => (
                <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div className="skeleton" style={{ width: 20, height: 20, borderRadius: '50%', flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div className="skeleton" style={{ height: 14, width: '40%', marginBottom: 6 }} />
                    <div className="skeleton" style={{ height: 11, width: '25%' }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && events.length === 0 && (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--muted)' }}>
              <Clock size={28} style={{ marginBottom: 10, opacity: 0.4 }} />
              <p style={{ fontSize: 13 }}>No checkpoint history yet.</p>
            </div>
          )}

          {events.map((event, i) => {
            const color   = CP_COLORS[event.checkpoint] ?? '#6b7280'
            const isFirst = i === 0
            const isLast  = i === events.length - 1
            return (
              <div key={event.id ?? i} style={{ display: 'flex', gap: 14, position: 'relative' }}>
                {/* Vertical timeline line */}
                {!isLast && (
                  <div style={{
                    position: 'absolute',
                    left: 9,
                    top: 22,
                    bottom: -4,
                    width: 1,
                    background: 'var(--border)',
                  }} />
                )}

                {/* Circle */}
                <div style={{
                  flexShrink: 0,
                  width: 20, height: 20, borderRadius: '50%',
                  background: color,
                  border: '3px solid var(--surface)',
                  zIndex: 1,
                  marginTop: 2,
                  boxShadow: isLast ? `0 0 8px ${color}60` : 'none',
                }} />

                {/* Content */}
                <div style={{ flex: 1, paddingBottom: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, fontSize: 13, color: isLast ? color : 'var(--text)' }}>
                      {CP_LABELS[event.checkpoint] ?? event.checkpoint}
                    </span>
                    {isLast && (
                      <span style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 8, fontWeight: 700,
                        background: color + '20',
                        color, borderRadius: 4, padding: '2px 6px',
                        letterSpacing: '0.08em',
                      }}>
                        CURRENT
                      </span>
                    )}
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted-2)', marginLeft: 'auto', letterSpacing: '0.04em' }}>
                      {fmtTime(event.timestamp)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    {event.duration_mins != null && (
                      <span style={{
                        fontSize: 11, color: 'var(--muted-2)',
                        background: 'var(--surface-3)',
                        border: '1px solid var(--border)',
                        borderRadius: 5, padding: '2px 8px',
                        display: 'flex', alignItems: 'center', gap: 4,
                      }}>
                        <Clock size={10} />
                        {event.duration_mins.toFixed(1)} min
                      </span>
                    )}
                    {event.flight_id && (
                      <span style={{
                        fontSize: 11, color: 'var(--accent)',
                        background: 'var(--accent-dim)',
                        borderRadius: 5, padding: '2px 8px',
                        display: 'flex', alignItems: 'center', gap: 4,
                      }}>
                        <Plane size={10} />
                        {event.flight_id}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
