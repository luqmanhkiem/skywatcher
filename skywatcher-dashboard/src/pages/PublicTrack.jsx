import { useState, useEffect, useRef, useCallback } from 'react'
import { Luggage, Search, Clock, CheckCircle, AlertTriangle, Plane } from 'lucide-react'
import { trackBag } from '../utils/api'

const CHECKPOINTS = ['check_in', 'security', 'sorting', 'loading', 'arrival']

const CP_META = {
  check_in: { label: 'Check-In', color: '#38BDF8' },
  security: { label: 'Security', color: '#F5A623' },
  sorting:  { label: 'Sorting',  color: '#A78BFA' },
  loading:  { label: 'Loading',  color: '#F97316' },
  arrival:  { label: 'Arrival',  color: '#00CC7D' },
}

function parseISO(iso) {
  if (!iso) return null
  return new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z')
}

function timeAgo(iso) {
  const d = parseISO(iso)
  if (!d) return '—'
  const diff = Math.floor((Date.now() - d.getTime()) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  return `${Math.floor(diff / 3600)}h ago`
}

function fmt(iso) {
  const d = parseISO(iso)
  return d ? d.toLocaleString() : '—'
}

export default function PublicTrack() {
  const [flightId,  setFlightId]  = useState('')
  const [passenger, setPassenger] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [result,    setResult]    = useState(null)   // { bag, events } | null
  const [notFound,  setNotFound]  = useState(false)
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')
  const intervalRef = useRef(null)

  const doFetch = useCallback(async (fid, pax) => {
    try {
      const data = await trackBag(fid, pax)
      setResult(data)
      setNotFound(false)
      setError('')
    } catch (err) {
      const msg = err.response?.data?.error ?? 'Unable to reach server'
      if (err.response?.status === 404) {
        setNotFound(true)
        setResult(null)
      } else {
        setError(msg)
      }
    }
  }, [])

  function handleSearch(e) {
    e.preventDefault()
    if (!flightId.trim() || !passenger.trim()) return
    setSubmitted(true)
    setLoading(true)
    setNotFound(false)
    setError('')
    setResult(null)
    doFetch(flightId.trim(), passenger.trim()).finally(() => setLoading(false))
  }

  // Poll every 5s once submitted
  useEffect(() => {
    if (!submitted) return
    intervalRef.current = setInterval(() => doFetch(flightId.trim(), passenger.trim()), 5000)
    return () => clearInterval(intervalRef.current)
  }, [submitted, flightId, passenger, doFetch])

  function reset() {
    setSubmitted(false)
    setResult(null)
    setNotFound(false)
    setError('')
    clearInterval(intervalRef.current)
  }

  const bag = result?.bag ?? null
  const events = result?.events ?? []
  const currentIdx = bag ? CHECKPOINTS.indexOf(bag.last_checkpoint) : -1
  const isArrived = bag?.status === 'arrived'

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>

      {/* Header */}
      <header style={{
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface)',
        padding: '14px 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'var(--surface-2)',
            border: '1px solid var(--accent)',
            boxShadow: '0 0 10px var(--accent-glow)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Luggage size={15} color="var(--accent)" />
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 15, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text)' }}>SkyWatcher</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--accent)', letterSpacing: '0.1em', textTransform: 'uppercase', opacity: 0.8 }}>BAG TRACK</div>
          </div>
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--muted)', letterSpacing: '0.06em' }}>PSM 2025/2026 · UTeM FTMK</div>
      </header>

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '40px 24px' }}>

        {/* Search form */}
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          padding: '28px 28px 24px',
          marginBottom: 24,
        }}>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 24, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text)', marginBottom: 6 }}>
            Track Your Baggage
          </h1>
          <p style={{ fontSize: 13, color: 'var(--muted-2)', marginBottom: 24, lineHeight: 1.6 }}>
            Enter your flight number and name to see your bag's real-time location.
            No account needed.
          </p>

          <form onSubmit={handleSearch} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={labelStyle}>Flight Number</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--surface-2)', border: '1px solid var(--border-2)', borderRadius: 10, padding: '0 12px' }}>
                <Plane size={14} color="var(--muted)" />
                <input
                  value={flightId}
                  onChange={e => setFlightId(e.target.value.toUpperCase())}
                  placeholder="e.g. MH370"
                  style={{ ...fieldStyle, padding: '11px 0' }}
                />
              </div>
            </div>

            <div>
              <label style={labelStyle}>Passenger Name</label>
              <input
                value={passenger}
                onChange={e => setPassenger(e.target.value)}
                placeholder="Enter your name as it appears on the ticket"
                style={{ ...fieldStyle, background: 'var(--surface-2)', border: '1px solid var(--border-2)', borderRadius: 10, padding: '11px 12px', width: '100%', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button type="submit" disabled={loading || !flightId.trim() || !passenger.trim()} style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                background: 'var(--accent)', color: '#000', border: 'none', borderRadius: 10,
                padding: '12px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                fontFamily: 'var(--font-body)',
                letterSpacing: '0.04em',
                transition: 'all 0.15s',
                opacity: (!flightId.trim() || !passenger.trim()) ? 0.4 : 1,
                boxShadow: (!flightId.trim() || !passenger.trim()) ? 'none' : '0 0 16px var(--accent-glow)',
              }}>
                <Search size={14} />
                {loading ? 'Searching…' : 'Track Bag'}
              </button>
              {submitted && (
                <button type="button" onClick={reset} style={{
                  background: 'var(--surface-2)', color: 'var(--muted-2)',
                  border: '1px solid var(--border)', borderRadius: 10,
                  padding: '12px 16px', fontSize: 13, cursor: 'pointer',
                }}>
                  Clear
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Not found */}
        {notFound && !loading && (
          <div style={{
            background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)',
            borderRadius: 12, padding: '20px 24px', marginBottom: 20, textAlign: 'center',
          }}>
            <Clock size={28} color="var(--warning)" style={{ marginBottom: 10 }} />
            <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--warning)', marginBottom: 6 }}>No bag found</p>
            <p style={{ fontSize: 12, color: 'var(--muted-2)', lineHeight: 1.6 }}>
              No bag matched <strong>{flightId}</strong> / <strong>{passenger}</strong>.<br />
              Check your details, or wait until your bag is scanned at check-in.
            </p>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div style={{
            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
            borderRadius: 12, padding: '16px 20px', marginBottom: 20,
            fontSize: 13, color: 'var(--danger)',
          }}>
            <AlertTriangle size={14} style={{ marginRight: 8, verticalAlign: 'middle' }} />
            {error}
          </div>
        )}

        {/* Progress stepper */}
        {bag && !loading && (
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 14, padding: '24px', marginBottom: 20,
          }}>
            {/* Flight info */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--muted-2)', marginBottom: 2 }}>Flight</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>{bag.flight_id}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: 'var(--muted-2)', marginBottom: 2 }}>Passenger</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{bag.passenger}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: 'var(--muted-2)', marginBottom: 2 }}>Bag Tag</div>
                <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>{bag.tag_id}</div>
              </div>
            </div>

            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)', marginBottom: 20 }}>Baggage Journey</div>

            {/* Stepper */}
            <div style={{ display: 'flex', alignItems: 'center' }}>
              {CHECKPOINTS.map((cp, idx) => {
                const { label, color, icon } = CP_META[cp]
                const isDone    = idx <= currentIdx
                const isCurrent = idx === currentIdx
                const isLast    = idx === CHECKPOINTS.length - 1
                return (
                  <div key={cp} style={{ display: 'flex', alignItems: 'center', flex: isLast ? 0 : 1 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                      <div style={{
                        width: 38, height: 38, borderRadius: '50%',
                        background: isDone ? `${color}20` : 'var(--surface-3)',
                        border: isDone ? `2px solid ${color}` : '2px solid var(--border)',
                        boxShadow: isCurrent ? `0 0 0 4px ${color}25, 0 0 12px ${color}40` : 'none',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.3s',
                      }}>
                        {isDone
                          ? <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, boxShadow: `0 0 8px ${color}` }} />
                          : <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>{idx + 1}</span>}
                      </div>
                      <div style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 8, fontWeight: isCurrent ? 700 : 500,
                        color: isDone ? color : 'var(--muted)',
                        whiteSpace: 'nowrap',
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                      }}>{label}</div>
                    </div>
                    {!isLast && (
                      <div style={{
                        flex: 1, height: 2, margin: '0 4px', marginBottom: 24,
                        background: idx < currentIdx ? CP_META[CHECKPOINTS[idx + 1]].color : 'var(--border)',
                        transition: 'background 0.4s',
                      }} />
                    )}
                  </div>
                )
              })}
            </div>

            {/* Status */}
            <div style={{
              marginTop: 24, padding: '12px 16px',
              background: isArrived ? 'var(--success-dim)' : 'var(--accent-dim)',
              border: `1px solid ${isArrived ? 'rgba(0,204,125,0.25)' : 'rgba(245,166,35,0.25)'}`,
              borderRadius: 9, display: 'flex', alignItems: 'center', gap: 10,
            }}>
              {isArrived ? <CheckCircle size={15} color="var(--success)" /> : <Clock size={15} color="var(--accent)" />}
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: isArrived ? 'var(--success)' : 'var(--accent)' }}>
                  {isArrived
                    ? 'Your bag has arrived at baggage claim!'
                    : `Currently at ${CP_META[bag.last_checkpoint]?.label ?? bag.last_checkpoint}`}
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted-2)', marginTop: 3, letterSpacing: '0.04em' }}>
                  Last updated {timeAgo(bag.last_seen)}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Scan history */}
        {events.length > 0 && !loading && (
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 14, padding: '20px 24px',
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)', marginBottom: 16 }}>Scan History</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {events.map((ev, i) => {
                const meta = CP_META[ev.checkpoint]
                return (
                  <div key={ev.id ?? i} style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0',
                    borderBottom: i < events.length - 1 ? '1px solid var(--border)' : 'none',
                  }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: meta?.color ?? 'var(--muted)', flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-2)' }}>
                        {meta?.label ?? ev.checkpoint}
                      </div>
                      {ev.duration_mins > 0 && (
                        <div style={{ fontSize: 11, color: 'var(--muted-2)', marginTop: 1 }}>
                          {ev.duration_mins} min at checkpoint
                        </div>
                      )}
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

        <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--muted)', marginTop: 32, lineHeight: 1.7 }}>
          {submitted && !loading && result ? 'Live — updates every 5 seconds' : 'No account required · UTeM FTMK PSM 2025/2026'}
        </p>
      </div>
    </div>
  )
}

const labelStyle = {
  display: 'block',
  fontFamily: 'var(--font-mono)',
  fontSize: 9, fontWeight: 600,
  color: 'var(--muted-2)', textTransform: 'uppercase',
  letterSpacing: '0.1em', marginBottom: 7,
}
const fieldStyle = {
  background: 'transparent', border: 'none', outline: 'none',
  fontSize: 14, color: 'var(--text)', width: '100%',
}
