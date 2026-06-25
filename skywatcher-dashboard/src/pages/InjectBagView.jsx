import { useState } from 'react'
import { Send, CheckCircle, AlertCircle, Zap, Navigation, RefreshCw } from 'lucide-react'

import { useToast }    from '../context/ToastContext'
import { injectBag, genBookingRef }   from '../utils/api'
import { useIsMobile } from '../hooks/useIsMobile'
import PageHeader      from '../components/PageHeader'

const _BOOKING_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
function newBookingRef() {
  return Array.from({ length: 6 }, () => _BOOKING_CHARS[Math.floor(Math.random() * _BOOKING_CHARS.length)]).join('')
}

function nextTagSuggestion() {
  const ts = Date.now().toString().slice(-4)
  return `TAG-${ts}`
}

const EMPTY_FORM = () => ({
  tag_id:      nextTagSuggestion(),
  passenger:   '',
  flight_id:   '',
  booking_ref: newBookingRef(),
})

export default function InjectBagView() {
  const { showToast } = useToast()
  const isMobile = useIsMobile()
  const [form, setForm]           = useState(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]         = useState('')
  const [recent, setRecent]       = useState([])

  function update(field, value) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const res = await injectBag(form)
      showToast(`Bag ${res.tag_id} registered — Ref: ${res.booking_ref} · Belt ${res.belt}`, 'success')
      setRecent(r => [{ ...res, submittedAt: new Date().toISOString() }, ...r].slice(0, 5))
      setForm(EMPTY_FORM())
    } catch (err) {
      const msg = err.response?.data?.error ?? 'Failed to inject bag'
      setError(msg)
      showToast(msg, 'anomaly')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <PageHeader
        title="Inject Bag"
        subtitle="Register a bag at Check-In — operators then scan it through each checkpoint"
      />

      <div className="animate-fade-up" style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
        gap: isMobile ? 14 : 22,
        padding: isMobile ? '16px 14px 80px' : '28px 32px',
        maxWidth: 1100,
        margin: '0 auto',
      }}>

        {/* ── FORM ─────────────────────────────────────── */}
        <form onSubmit={handleSubmit} style={{
          background: 'var(--surface)',
          border: '1px solid var(--border-2)',
          borderTop: '2px solid var(--accent)',
          borderRadius: 12,
          padding: '24px 26px 22px',
        }}>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 600,
            color: 'var(--accent)', letterSpacing: '0.16em',
            textTransform: 'uppercase', marginBottom: 18,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <Zap size={11} /> OPERATOR INPUT
          </div>

          {error && (
            <div style={{
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 8, padding: '10px 14px', marginBottom: 16,
              fontSize: 12, color: 'var(--danger)',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <AlertCircle size={14} /> {error}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Field label="Tag ID" hint="RFID tag identifier — must be unique">
              <input
                value={form.tag_id}
                onChange={e => update('tag_id', e.target.value)}
                placeholder="e.g. TAG-5001"
                style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }}
                required
              />
            </Field>

            <Field label="Passenger Name">
              <input
                value={form.passenger}
                onChange={e => update('passenger', e.target.value)}
                placeholder="e.g. Aisyah Rahman"
                style={inputStyle}
                required
              />
            </Field>

            <Field label="Flight ID">
              <input
                value={form.flight_id}
                onChange={e => update('flight_id', e.target.value)}
                placeholder="e.g. MH188"
                style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }}
                required
              />
            </Field>

            <Field label="Booking Reference" hint="6-char code shared with passenger for self-tracking — same ref for multiple bags">
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  value={form.booking_ref}
                  onChange={e => update('booking_ref', e.target.value.toUpperCase().slice(0, 6))}
                  placeholder="e.g. AB3X7Q"
                  maxLength={6}
                  style={{ ...inputStyle, fontFamily: 'var(--font-mono)', flex: 1, letterSpacing: '0.18em' }}
                  required
                />
                <button
                  type="button"
                  title="Generate new code"
                  onClick={() => update('booking_ref', newBookingRef())}
                  style={{
                    padding: '0 12px', borderRadius: 8, border: '1px solid var(--border-2)',
                    background: 'var(--surface-2)', color: 'var(--muted)', cursor: 'pointer',
                    display: 'flex', alignItems: 'center',
                  }}
                >
                  <RefreshCw size={13} />
                </button>
              </div>
            </Field>
          </div>

          {/* Belt hint */}
          <div style={{
            marginTop: 16, padding: '10px 14px',
            background: 'var(--surface-2)', borderRadius: 8,
            border: '1px solid var(--border)',
            fontSize: 11, color: 'var(--muted)',
            fontFamily: 'var(--font-mono)', letterSpacing: '0.04em',
          }}>
            <Navigation size={11} style={{ marginRight: 6, verticalAlign: 'middle' }} />
            Belt auto-assigned 1–5 round-robin per flight
          </div>

          <button type="submit" disabled={submitting} style={{
            ...btnPrimary, width: '100%', marginTop: 18,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            opacity: submitting ? 0.6 : 1,
          }}>
            <Send size={14} />
            {submitting ? 'Registering…' : 'Register Bag at Check-In'}
          </button>
        </form>

        {/* ── RECENT INJECTIONS ─────────────────────────── */}
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border-2)',
          borderRadius: 12,
          padding: '24px 26px 22px',
        }}>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 600,
            color: 'var(--muted-2)', letterSpacing: '0.16em',
            textTransform: 'uppercase', marginBottom: 18,
          }}>
            REGISTERED THIS SESSION
          </div>

          {recent.length === 0 ? (
            <div style={{
              padding: '40px 16px', textAlign: 'center',
              color: 'var(--muted)', fontSize: 12,
              fontFamily: 'var(--font-mono)', letterSpacing: '0.06em',
            }}>
              No bags registered yet.<br />
              <span style={{ opacity: 0.6 }}>Submit the form to add a bag.</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {recent.map((r, idx) => <RecentCard key={`${r.tag_id}-${idx}`} entry={r} />)}
            </div>
          )}

          {recent.length > 0 && (
            <div style={{
              marginTop: 18, paddingTop: 14,
              borderTop: '1px solid var(--border)',
              fontSize: 11, color: 'var(--muted)',
              fontFamily: 'var(--font-mono)', letterSpacing: '0.04em',
            }}>
              → Open Bags and scan through each checkpoint to advance the bag.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function RecentCard({ entry }) {
  const time = new Date(entry.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  return (
    <div style={{
      background: 'var(--surface-2)', border: '1px solid var(--border)',
      borderRadius: 8, padding: '12px 14px',
      display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>
          {entry.tag_id}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
          <CheckCircle size={11} color="var(--success)" /> {time}
        </div>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text)' }}>
        {entry.passenger}
        <span style={{ color: 'var(--muted)' }}> · </span>
        <span style={{ fontFamily: 'var(--font-mono)' }}>{entry.flight_id}</span>
        {entry.booking_ref && (
          <>
            <span style={{ color: 'var(--muted)' }}> · </span>
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)', fontWeight: 600 }}>
              {entry.booking_ref}
            </span>
          </>
        )}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '0.1em',
          padding: '2px 7px', borderRadius: 4,
          background: 'rgba(0,204,125,0.12)', color: 'var(--success)',
        }}>
          Check-In ✓
        </div>
        {entry.belt && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.1em',
            padding: '2px 7px', borderRadius: 4,
            background: 'rgba(56,189,248,0.12)', color: '#38BDF8',
          }}>
            <Navigation size={9} /> Belt {entry.belt}
          </div>
        )}
      </div>
    </div>
  )
}

function Field({ label, hint, children }) {
  return (
    <div>
      <div style={{
        fontSize: 11, fontWeight: 600, color: 'var(--muted-2)',
        marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px',
      }}>{label}</div>
      {children}
      {hint && <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 5, fontStyle: 'italic' }}>{hint}</div>}
    </div>
  )
}

const inputStyle = {
  width: '100%', boxSizing: 'border-box',
  background: 'var(--surface-2)', border: '1px solid var(--border-2)',
  borderRadius: 8, padding: '9px 12px',
  fontSize: 13, color: 'var(--text)', outline: 'none',
}

const btnPrimary = {
  background: 'var(--accent)', color: '#000',
  border: 'none', borderRadius: 8, padding: '11px 20px',
  fontSize: 13, fontWeight: 700, letterSpacing: '0.04em',
  textTransform: 'uppercase', cursor: 'pointer',
}
