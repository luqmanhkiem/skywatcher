import { useState, useEffect, useRef, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowRight, ArrowLeft, Clock, CheckCircle, AlertTriangle, RotateCcw, Bell, Info } from 'lucide-react'
import { trackByBookingRef, subscribeArrival } from '../utils/api'

const CHECKPOINTS = ['check_in', 'security', 'sorting', 'loading', 'arrival']

const CP_META = {
  check_in: { label: 'Check-In', color: '#38BDF8' },
  security: { label: 'Security', color: '#F5A623' },
  sorting: { label: 'Sorting', color: '#A78BFA' },
  loading: { label: 'Loading', color: '#F97316' },
  arrival: { label: 'Arrival', color: '#00CC7D' },
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
  const initialRef       = params.get('ref') ?? ''
  const initialFlight    = params.get('flight') ?? ''
  const initialPassenger = params.get('passenger') ?? ''

  const [bookingRef, setBookingRef] = useState(initialRef)
  const [flightId,   setFlightId]   = useState(initialFlight)
  const [passenger,  setPassenger]  = useState(initialPassenger)

  const [submitted, setSubmitted] = useState(false)
  const [results, setResults]     = useState(null)   // array of {bag,events,status,...}
  const [notFound, setNotFound]   = useState(false)
  const [loading,  setLoading]    = useState(false)
  const [error,    setError]      = useState('')
  const [notifyEmail, setNotifyEmail] = useState('')
  const notifyRef = useRef(null)
  const [notifyMsg,   setNotifyMsg]   = useState(null)
  const [activeIdx, setActiveIdx] = useState(0)   // which bag is shown when multi-bag
  const intervalRef = useRef(null)

  const doFetch = useCallback(async (ref) => {
    try {
      const data = await trackByBookingRef(ref)
      setResults(data.bags)
      setNotFound(false)
      setError('')
    } catch (err) {
      const msg = err.response?.data?.error ?? 'Unable to reach server'
      if (err.response?.status === 404) {
        setNotFound(true)
        setResults(null)
      } else {
        setError(msg)
      }
    }
  }, [])

  const canSearch = !!bookingRef.trim()

  function handleSearch(e) {
    if (e) e.preventDefault()
    const ref = bookingRef.trim().toUpperCase()
    if (!ref) return
    setSubmitted(true)
    setLoading(true)
    setNotFound(false)
    setError('')
    setResults(null)
    setActiveIdx(0)
    setParams({ ref })
    doFetch(ref).finally(() => setLoading(false))
  }

  useEffect(() => {
    if (initialRef && !submitted) {
      handleSearch()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!submitted) return
    const ref = bookingRef.trim().toUpperCase()
    intervalRef.current = setInterval(() => doFetch(ref), 5000)
    return () => clearInterval(intervalRef.current)
  }, [submitted, bookingRef, doFetch])

  function reset() {
    setSubmitted(false)
    setResults(null)
    setNotFound(false)
    setError('')
    setNotifyEmail('')
    setNotifyMsg(null)
    setActiveIdx(0)
    clearInterval(intervalRef.current)
    setParams({})
  }

  async function submitNotify(e) {
    if (e) e.preventDefault()
    const tag = activeResult?.bag?.tag_id
    // Browser autofill sets the DOM value without firing onChange, so React
    // state can be empty while the field visibly holds an address. Trust the
    // input itself and fall back to state.
    const email = (notifyRef.current?.value ?? notifyEmail).trim()
    if (!tag) return
    if (!email) {
      setNotifyMsg({ kind: 'err', text: 'Please enter your email address.' })
      return
    }
    try {
      await subscribeArrival(tag, email)
      setNotifyMsg({ kind: 'ok', text: "You're set. We'll email you when your bag arrives." })
      setNotifyEmail('')
      if (notifyRef.current) notifyRef.current.value = ''
    } catch (err) {
      setNotifyMsg({ kind: 'err', text: err.response?.data?.error || 'Could not subscribe. Try again.' })
    }
  }

  // active result (when passenger has multiple bags, user can tab between them)
  const activeResult = results?.[activeIdx] ?? null
  const bag        = activeResult?.bag ?? null
  const events     = activeResult?.events ?? []
  const currentIdx = bag ? CHECKPOINTS.indexOf(bag.last_checkpoint) : -1
  const isArrived  = bag?.last_checkpoint === 'arrival'
  const eta        = activeResult?.eta ?? null
  const messages   = activeResult?.messages ?? []
  const advisories = activeResult?.advisories ?? []
  const carousel   = activeResult?.carousel ?? null

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
          <span style={{ fontWeight: 700, fontSize: 18, letterSpacing: '-0.01em' }}><span style={{ color: 'var(--brand-sky)' }}>Sky</span>Watcher</span>
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
        <form onSubmit={handleSearch} style={{ marginBottom: 8 }}>
          <div style={{
            background: 'var(--lt-card)',
            border: '1px solid var(--lt-border)',
            borderRadius: 18,
            padding: 8,
            display: 'flex',
            gap: 8,
            flexWrap: 'wrap',
          }}>
            <SearchField
              label="Booking Reference"
              value={bookingRef}
              onChange={v => setBookingRef(v.toUpperCase().slice(0, 6))}
              placeholder="AB3X7Q"
              mono
            />
            <button
              type="submit"
              disabled={loading || !canSearch}
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
                opacity: (loading || !canSearch) ? 0.45 : 1,
                display: 'inline-flex', alignItems: 'center', gap: 6,
                whiteSpace: 'nowrap',
              }}
            >
              {loading ? 'Searching…' : <>Track <ArrowRight size={15} strokeWidth={2.5} /></>}
            </button>
          </div>
          <p style={{ margin: '8px 4px 24px', fontSize: 12, color: 'var(--lt-text-2)' }}>
            Enter your 6-character booking reference from your ticket or confirmation email.
          </p>
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
              {bookingRef.trim()
                ? 'Check your booking reference — it\'s the 6-character code on your bag tag receipt.'
                : 'Make sure the flight number and name match what\'s on your boarding pass.'}
              {' '}The system retries every 5 seconds — your bag may appear shortly.
            </div>
          </div>
        )}

        {/* ──── MULTI-BAG STACKED OVERVIEW ──── */}
        {results && results.length > 1 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--lt-text-2)', marginBottom: 12, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              {results.length} bags on this booking
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {results.map((r, i) => {
                const b = r.bag ?? {}
                const cpIdx = CHECKPOINTS.indexOf(b.last_checkpoint)
                const pct = cpIdx < 0 ? 0 : Math.round(((cpIdx + 1) / CHECKPOINTS.length) * 100)
                const cpMeta = CP_META[b.last_checkpoint] ?? { label: b.last_checkpoint ?? '—', color: 'var(--lt-text-2)' }
                const isActive = activeIdx === i
                return (
                  <button
                    key={b.tag_id ?? i}
                    onClick={() => setActiveIdx(i)}
                    style={{
                      width: '100%', textAlign: 'left', cursor: 'pointer',
                      background: 'var(--lt-card)',
                      border: `2px solid ${isActive ? 'var(--lt-text)' : 'var(--lt-border)'}`,
                      borderRadius: 16, padding: '16px 20px',
                      fontFamily: 'var(--lt-font)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <div>
                        <span style={{ fontWeight: 700, fontSize: 15 }}>Bag {i + 1}</span>
                        <span style={{ color: 'var(--lt-text-2)', fontSize: 13, marginLeft: 8, fontFamily: 'var(--font-mono)' }}>{b.tag_id}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: cpMeta.color }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: cpMeta.color, display: 'inline-block' }} />
                        {cpMeta.label}
                        <span style={{ color: 'var(--lt-text-2)', fontWeight: 400 }}>{pct}%</span>
                      </div>
                    </div>
                    <div style={{ height: 4, borderRadius: 99, background: 'var(--lt-border)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, borderRadius: 99, background: cpMeta.color, transition: 'width 0.4s' }} />
                    </div>
                    {isActive && (
                      <div style={{ marginTop: 8, fontSize: 12, color: 'var(--lt-text-2)' }}>▼ Showing full details below</div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* ──── RESULT ──── */}
        {bag && (
          <>
            {results && results.length > 1 && (
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--lt-text-2)', marginBottom: 12, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                Bag {activeIdx + 1} — full details
              </div>
            )}
            {/* ──── CAROUSEL BANNER ──── */}
            {carousel && isArrived && (
              <div style={{
                background: 'linear-gradient(135deg, #15803D 0%, #16a34a 100%)',
                borderRadius: 18,
                padding: '28px 32px',
                marginBottom: 16,
                display: 'flex', alignItems: 'center', gap: 20,
                boxShadow: '0 4px 24px rgba(21,128,61,0.25)',
              }}>
                <div style={{
                  width: 64, height: 64, borderRadius: 16,
                  background: 'rgba(255,255,255,0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <span style={{ fontSize: 32 }}>🛄</span>
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.75)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>
                    Your bag has arrived
                  </div>
                  <div style={{ fontSize: 36, fontWeight: 900, color: '#fff', lineHeight: 1.1, letterSpacing: '-0.02em' }}>
                    Head to Belt {carousel}
                  </div>
                  <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', marginTop: 6 }}>
                    Collect at the baggage carousel now ✓
                  </div>
                </div>
              </div>
            )}
            {/* ──── EXPECTED BELT (in-transit) ──── */}
            {carousel && !isArrived && (
              <div style={{
                background: 'var(--lt-card)',
                border: '1px solid var(--lt-border)',
                borderRadius: 14,
                padding: '14px 18px',
                marginBottom: 16,
                display: 'flex', alignItems: 'center', gap: 14,
              }}>
                <span style={{ fontSize: 24 }}>🛄</span>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--lt-text-2)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 2 }}>
                    Expected baggage belt
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--lt-text)', letterSpacing: '-0.01em' }}>
                    Belt {carousel}
                  </div>
                </div>
              </div>
            )}

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
              <Meta label="Flight" value={bag.flight_id} mono />
              <Meta label="Passenger" value={bag.passenger} />
              {bag.booking_ref && <Meta label="Booking Ref" value={bag.booking_ref} mono />}
              <Meta label="Bag tag" value={bag.tag_id} mono />
            </div>

            {/* ──── ADVISORY / ANOMALY BANNERS ──── */}
            {advisories.map((a, i) => (
              <Banner key={`adv-${i}`} level={a.level === 'down' ? 'critical' : 'warning'}>
                There may be some delay — we're currently experiencing an issue at{' '}
                <strong>{a.checkpoint_label}</strong>.{a.message ? ` ${a.message}` : ''}
              </Banner>
            ))}
            {messages.map((m, i) => (
              <Banner key={`msg-${i}`} level={m.level}>{m.message}</Banner>
            ))}

            {/* ──── ETA CARD ──── */}
            {eta && (
              <div style={{
                background: eta.at_carousel ? '#DCFCE7' : (eta.delayed ? '#FEF3C7' : 'var(--lt-card)'),
                border: `1px solid ${eta.at_carousel ? '#86EFAC' : (eta.delayed ? '#FCD34D' : 'var(--lt-border)')}`,
                borderRadius: 18,
                padding: '22px 28px',
                marginBottom: 16,
                display: 'flex', alignItems: 'center', gap: 18,
              }}>
                <Clock size={26} color={eta.at_carousel ? '#15803D' : (eta.delayed ? '#92400E' : 'var(--lt-cta)')} />
                {eta.at_carousel ? (
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#15803D' }}>
                    Your bag is at the carousel now{carousel ? ` — Belt ${carousel}` : ''}
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--lt-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>
                      Estimated at carousel
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--lt-text)', lineHeight: 1.1 }}>
                      ~{eta.remaining_mins} min
                      {eta.eta_iso && (
                        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--lt-muted)' }}>
                          {'  ·  around '}
                          {new Date(eta.eta_iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                    {eta.delayed && (
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#92400E', marginTop: 4 }}>
                        Delayed — recalculating
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

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
                  const isDone = idx <= currentIdx
                  const isCurrent = idx === currentIdx
                  const isLast = idx === CHECKPOINTS.length - 1
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

            {/* ──── NOTIFY ME ──── */}
            {!isArrived && (
              <form onSubmit={submitNotify} style={{
                background: 'var(--lt-card)',
                border: '1px solid var(--lt-border)',
                borderRadius: 18,
                padding: '22px 28px',
                marginBottom: 16,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <Bell size={17} color="var(--lt-cta)" />
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--lt-text)' }}>
                    Get an email when your bag arrives
                  </div>
                </div>
                <div style={{ fontSize: 13, color: 'var(--lt-muted)', marginBottom: 14 }}>
                  We'll notify you the moment it reaches the baggage carousel.
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <input
                    type="email"
                    ref={notifyRef}
                    value={notifyEmail}
                    onChange={e => setNotifyEmail(e.target.value)}
                    placeholder="you@email.com"
                    style={{
                      flex: 1, minWidth: 200,
                      border: '1px solid var(--lt-border)',
                      borderRadius: 12,
                      padding: '11px 16px',
                      fontSize: 14,
                      fontFamily: 'var(--lt-font)',
                      color: 'var(--lt-text)',
                      outline: 'none',
                    }}
                  />
                  <button
                    type="submit"
                    style={{
                      background: 'var(--lt-cta)', color: 'var(--lt-cta-fg)',
                      border: 'none', borderRadius: 12, padding: '0 22px',
                      fontFamily: 'var(--lt-font)', fontWeight: 600, fontSize: 14,
                      cursor: 'pointer', whiteSpace: 'nowrap',
                    }}
                  >
                    Notify me
                  </button>
                </div>
                {notifyMsg && (
                  <div style={{
                    marginTop: 10, fontSize: 13, fontWeight: 600,
                    color: notifyMsg.kind === 'ok' ? '#15803D' : '#991B1B',
                  }}>
                    {notifyMsg.text}
                  </div>
                )}
              </form>
            )}

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

function SearchField({ label, value, onChange, placeholder, mono = false }) {
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
          fontFamily: mono ? 'var(--font-mono)' : 'var(--lt-font)',
          letterSpacing: mono ? '0.15em' : undefined,
          padding: 0,
          width: '100%',
        }}
      />
    </label>
  )
}

const BANNER_STYLES = {
  warning: { bg: '#FEF3C7', border: '#FCD34D', color: '#92400E', Icon: AlertTriangle },
  info: { bg: 'var(--lt-cta-soft)', border: 'var(--lt-cta)', color: 'var(--lt-cta)', Icon: Info },
  critical: { bg: '#FEE2E2', border: '#FCA5A5', color: '#991B1B', Icon: AlertTriangle },
}

function Banner({ level, children }) {
  const s = BANNER_STYLES[level] ?? BANNER_STYLES.warning
  const { Icon } = s
  return (
    <div style={{
      background: s.bg,
      border: `1px solid ${s.border}`,
      color: s.color,
      borderRadius: 14,
      padding: '14px 18px',
      marginBottom: 12,
      display: 'flex', alignItems: 'flex-start', gap: 10,
      fontSize: 14, fontWeight: 500, lineHeight: 1.45,
    }}>
      <Icon size={18} style={{ flexShrink: 0, marginTop: 1 }} />
      <div>{children}</div>
    </div>
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
