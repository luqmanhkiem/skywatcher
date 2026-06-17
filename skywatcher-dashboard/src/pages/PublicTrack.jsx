import { useState, useEffect, useRef, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowRight, ArrowLeft, Clock, CheckCircle, AlertTriangle, RotateCcw } from 'lucide-react'
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
  const [params, setParams] = useSearchParams()
  const initialFlight    = params.get('flight')    ?? ''
  const initialPassenger = params.get('passenger') ?? ''

  const [flightId,  setFlightId]  = useState(initialFlight)
  const [passenger, setPassenger] = useState(initialPassenger)
  const [submitted, setSubmitted] = useState(false)
  const [result,    setResult]    = useState(null)
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
    if (e) e.preventDefault()
    if (!flightId.trim() || !passenger.trim()) return
    setSubmitted(true)
    setLoading(true)
    setNotFound(false)
    setError('')
    setResult(null)
    setParams({ flight: flightId.trim(), passenger: passenger.trim() })
    doFetch(flightId.trim(), passenger.trim()).finally(() => setLoading(false))
  }

  // Auto-search if URL params were provided on first load
  useEffect(() => {
    if (initialFlight && initialPassenger && !submitted) {
      handleSearch()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
    setParams({})
  }

  const bag        = result?.bag ?? null
  const events     = result?.events ?? []
  const currentIdx = bag ? CHECKPOINTS.indexOf(bag.last_checkpoint) : -1
  const isArrived  = bag?.last_checkpoint === 'arrival'

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--lt-bg)',
      color: 'var(--lt-text)',
      fontFamily: 'var(--lt-font)',
    }}>
      {/* ──── HEADER ──── */}
      <header style={{
        maxWidth: 1200,
        margin: '0 auto',
        padding: '24px 32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: 'inherit' }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'var(--lt-text)',
            color: 'var(--lt-bg)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 900, fontSize: 18,
          }}>S</div>
          <span style={{ fontWeight: 700, fontSize: 18, letterSpacing: '-0.01em' }}>SkyWatcher</span>
        </Link>

        <Link to="/login" style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: 'var(--lt-cta)',
          color: 'var(--lt-cta-fg)',
          padding: '9px 18px',
          borderRadius: 999,
          fontWeight: 600,
          fontSize: 14,
          textDecoration: 'none',
        }}>Staff sign in</Link>
      </header>

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '24px 32px 80px' }}>

        {/* ──── BACK + TITLE ──── */}
        <Link to="/" style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          color: 'var(--lt-text-2)',
          fontSize: 14, fontWeight: 500,
          textDecoration: 'none',
          marginBottom: 20,
        }}>
          <ArrowLeft size={15} /> Back home
        </Link>

        <h1 style={{
          fontSize: 'clamp(36px, 6vw, 56px)',
          fontWeight: 900,
          letterSpacing: '-0.03em',
          lineHeight: 1.0,
          marginBottom: 32,
        }}>Track your bag.</h1>

        {/* ──── SEARCH FORM ──── */}
        <form onSubmit={handleSearch} style={{
          background: 'var(--lt-card)',
          border: '1px solid var(--lt-border)',
          borderRadius: 18,
          padding: 8,
          display: 'flex',
          gap: 8,
          marginBottom: 32,
        }}>
          <SearchField label="Flight"    value={flightId}  onChange={setFlightId}  placeholder="MH370" />
          <div style={{ width: 1, background: 'var(--lt-border)', margin: '8px 0' }} />
          <SearchField label="Passenger" value={passenger} onChange={setPassenger} placeholder="Tan" />
          <button
            type="submit"
            disabled={loading || !flightId.trim() || !passenger.trim()}
            style={{
              background: 'var(--lt-cta)',
              color: 'var(--lt-cta-fg)',
              border: 'none',
              borderRadius: 12,
              padding: '0 22px',
              fontFamily: 'var(--lt-font)',
              fontWeight: 600,
              fontSize: 14,
              cursor: 'pointer',
              opacity: (loading || !flightId.trim() || !passenger.trim()) ? 0.45 : 1,
              display: 'inline-flex', alignItems: 'center', gap: 6,
              whiteSpace: 'nowrap',
            }}
          >
            {loading ? 'Searching…' : <>Track <ArrowRight size={15} strokeWidth={2.5} /></>}
          </button>
        </form>

        {/* ──── ERROR ──── */}
        {error && (
          <div style={errorCard}>
            <AlertTriangle size={18} /> {error}
          </div>
        )}

        {/* ──── NOT FOUND ──── */}
        {notFound && (
          <div style={{
            background: 'var(--lt-card)',
            border: '1px solid var(--lt-border)',
            borderRadius: 16,
            padding: 40,
            textAlign: 'center',
            color: 'var(--lt-text-2)',
          }}>
            <div style={{ fontWeight: 700, fontSize: 20, color: 'var(--lt-text)', marginBottom: 8 }}>
              No bag found.
            </div>
            <div style={{ fontSize: 15 }}>
              Make sure the flight number and passenger name match what's on your boarding pass.
              The system also automatically retries every 5 seconds — your bag may appear shortly.
            </div>
          </div>
        )}

        {/* ──── RESULT ──── */}
        {bag && (
          <>
            {/* Bag meta */}
            <div style={{
              background: 'var(--lt-card)',
              border: '1px solid var(--lt-border)',
              borderRadius: 18,
              padding: '24px 28px',
              marginBottom: 16,
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: 16,
            }}>
              <Meta label="Flight"    value={bag.flight_id} mono />
              <Meta label="Passenger" value={bag.passenger} />
              <Meta label="Bag tag"   value={bag.tag_id}    mono />
            </div>

            {/* Journey stepper */}
            <div style={{
              background: 'var(--lt-card)',
              border: '1px solid var(--lt-border)',
              borderRadius: 18,
              padding: '28px',
              marginBottom: 16,
            }}>
              <div style={{
                fontSize: 12, fontWeight: 600,
                color: 'var(--lt-muted)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                marginBottom: 24,
              }}>
                Baggage Journey
              </div>

              <div style={{ display: 'flex', alignItems: 'center' }}>
                {CHECKPOINTS.map((cp, idx) => {
                  const { label, color } = CP_META[cp]
                  const isDone    = idx <= currentIdx
                  const isCurrent = idx === currentIdx
                  const isLast    = idx === CHECKPOINTS.length - 1
                  return (
                    <div key={cp} style={{ display: 'flex', alignItems: 'center', flex: isLast ? 0 : 1 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: '50%',
                          background: isDone ? color : 'var(--lt-bg-soft)',
                          border: isDone ? `2px solid ${color}` : '2px solid var(--lt-border)',
                          boxShadow: isCurrent ? `0 0 0 4px ${color}30` : 'none',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'all 0.3s',
                        }}>
                          {isDone
                            ? <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#FFF' }} />
                            : <span style={{ fontSize: 12, color: 'var(--lt-muted)', fontWeight: 600 }}>{idx + 1}</span>}
                        </div>
                        <div style={{
                          fontSize: 11, fontWeight: isCurrent ? 700 : 500,
                          color: isDone ? 'var(--lt-text)' : 'var(--lt-muted)',
                          whiteSpace: 'nowrap',
                          letterSpacing: '0.04em',
                          textTransform: 'uppercase',
                        }}>{label}</div>
                      </div>
                      {!isLast && (
                        <div style={{
                          flex: 1, height: 2, margin: '0 6px', marginBottom: 24,
                          background: idx < currentIdx
                            ? `linear-gradient(90deg, ${CP_META[cp].color} 0%, ${CP_META[CHECKPOINTS[idx + 1]].color} 100%)`
                            : 'var(--lt-border)',
                          transition: 'background 0.4s',
                        }} />
                      )}
                    </div>
                  )
                })}
              </div>

              <div style={{
                marginTop: 24, padding: '14px 18px',
                background: isArrived ? '#DCFCE7' : 'var(--lt-cta-soft)',
                borderRadius: 12,
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                {isArrived ? <CheckCircle size={17} color="#15803D" /> : <Clock size={17} color="var(--lt-cta)" />}
                <div>
                  <div style={{
                    fontSize: 14, fontWeight: 600,
                    color: isArrived ? '#15803D' : 'var(--lt-cta)',
                  }}>
                    {isArrived
                      ? 'Your bag has arrived at baggage claim.'
                      : `Currently at ${CP_META[bag.last_checkpoint]?.label ?? bag.last_checkpoint}`}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--lt-muted)', marginTop: 2 }}>
                    Last updated {timeAgo(bag.last_seen)} · auto-refreshing every 5 seconds
                  </div>
                </div>
              </div>
            </div>

            {/* Event history */}
            <div style={{
              background: 'var(--lt-card)',
              border: '1px solid var(--lt-border)',
              borderRadius: 18,
              padding: '28px',
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: 18,
              }}>
                <div style={{
                  fontSize: 12, fontWeight: 600,
                  color: 'var(--lt-muted)',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                }}>
                  Scan History · {events.length} {events.length === 1 ? 'scan' : 'scans'}
                </div>
                <button
                  onClick={reset}
                  style={{
                    background: 'transparent',
                    border: '1px solid var(--lt-border)',
                    borderRadius: 999,
                    padding: '6px 14px',
                    fontFamily: 'var(--lt-font)',
                    fontSize: 12,
                    fontWeight: 500,
                    color: 'var(--lt-text-2)',
                    cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                  }}
                >
                  <RotateCcw size={12} /> New search
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {events.map((ev, idx) => {
                  const meta = CP_META[ev.checkpoint]
                  const isLastRow = idx === events.length - 1
                  return (
                    <div key={ev.id ?? idx} style={{
                      display: 'flex',
                      gap: 16,
                      padding: '14px 0',
                      borderBottom: isLastRow ? 'none' : '1px solid var(--lt-border)',
                    }}>
                      <div style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: meta?.color ?? 'var(--lt-muted)',
                        marginTop: 8,
                        flexShrink: 0,
                      }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 15 }}>
                          {meta?.label ?? ev.checkpoint}
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--lt-muted)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>
                          {ev.duration_mins} min · {ev.flight_id}
                        </div>
                      </div>
                      <div style={{
                        fontSize: 12,
                        color: 'var(--lt-muted)',
                        fontFamily: 'var(--font-mono)',
                        whiteSpace: 'nowrap',
                      }}>
                        {fmt(ev.timestamp)}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Report an issue */}
            <div style={{
              marginTop: 16,
              background: 'var(--lt-card)',
              border: '1px solid var(--lt-border)',
              borderRadius: 16,
              padding: '18px 24px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              gap: 16, flexWrap: 'wrap',
            }}>
              <div style={{ fontSize: 14, color: 'var(--lt-text-2)' }}>
                Problem with this bag — lost, delayed, or damaged?
              </div>
              <Link
                to={`/feedback?flight=${encodeURIComponent(bag.flight_id ?? '')}&passenger=${encodeURIComponent(bag.passenger ?? '')}&tag=${encodeURIComponent(bag.tag_id ?? '')}`}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  background: 'var(--lt-cta)', color: 'var(--lt-cta-fg)',
                  padding: '10px 18px', borderRadius: 999,
                  fontWeight: 600, fontSize: 14, textDecoration: 'none', whiteSpace: 'nowrap',
                }}
              >
                Report an issue <ArrowRight size={15} strokeWidth={2.5} />
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function SearchField({ label, value, onChange, placeholder }) {
  return (
    <label style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      gap: 3,
      padding: '10px 16px',
      cursor: 'text',
    }}>
      <span style={{
        fontSize: 10, fontWeight: 600,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: 'var(--lt-muted)',
      }}>{label}</span>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          border: 'none',
          background: 'transparent',
          outline: 'none',
          fontSize: 15,
          fontWeight: 500,
          color: 'var(--lt-text)',
          fontFamily: 'var(--lt-font)',
          padding: 0,
          width: '100%',
        }}
      />
    </label>
  )
}

function Meta({ label, value, mono }) {
  return (
    <div>
      <div style={{
        fontSize: 11, fontWeight: 600,
        color: 'var(--lt-muted)',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        marginBottom: 4,
      }}>{label}</div>
      <div style={{
        fontSize: 18,
        fontWeight: 700,
        color: 'var(--lt-text)',
        fontFamily: mono ? 'var(--font-mono)' : 'var(--lt-font)',
      }}>{value || '—'}</div>
    </div>
  )
}

const errorCard = {
  background: '#FEE2E2',
  border: '1px solid #FCA5A5',
  color: '#991B1B',
  borderRadius: 12,
  padding: '12px 16px',
  fontSize: 14,
  fontWeight: 500,
  marginBottom: 20,
  display: 'flex', alignItems: 'center', gap: 8,
}
