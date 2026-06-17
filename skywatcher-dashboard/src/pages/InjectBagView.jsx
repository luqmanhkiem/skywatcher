import { useState } from 'react'
import { Send, CheckCircle, AlertCircle, Zap } from 'lucide-react'

import { useToast }    from '../context/ToastContext'
import { injectBag }   from '../utils/api'
import { useIsMobile } from '../hooks/useIsMobile'
import PageHeader      from '../components/PageHeader'

const SCENARIOS = [
  { value: 'normal',      label: 'Normal',          desc: 'Bag clears all checkpoints in order'         },
  { value: 'stall',       label: 'Stall',           desc: 'Bag pauses > 20 min at one checkpoint'       },
  { value: 'wrong-route', label: 'Wrong Route',     desc: 'Bag skips sorting'                            },
  { value: 'bypass',      label: 'Security Bypass', desc: 'Bag skips security entirely'                  },
]

const SPEEDS = [
  { value: 0.3, label: '0.3x — Fast demo'   },
  { value: 1.0, label: '1x — Realistic'     },
  { value: 2.0, label: '2x — Slow walkthrough' },
]

function nextTagSuggestion() {
  // TAG-{timestamp suffix} so suggestions don't collide between injections
  const ts = Date.now().toString().slice(-4)
  return `TAG-${ts}`
}

const EMPTY_FORM = () => ({
  tag_id:    nextTagSuggestion(),
  passenger: '',
  flight_id: '',
  scenario:  'normal',
  speed:     0.3,
})

export default function InjectBagView() {
  const { showToast } = useToast()
  const isMobile = useIsMobile()
  const [form, setForm]       = useState(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]     = useState('')
  const [recent, setRecent]   = useState([])  // last 5 injections (this session)

  function update(field, value) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      const res = await injectBag(form)
      showToast(`Bag ${res.tag_id} injected — watch the live map`, 'success')

      setRecent(r => [
        {
          ...res,
          submittedAt: new Date().toISOString(),
        },
        ...r,
      ].slice(0, 5))

      // Reset form, but suggest a fresh tag id
      setForm(EMPTY_FORM())
    } catch (err) {
      const msg = err.response?.data?.error ?? 'Failed to inject bag'
      setError(msg)
      showToast(msg, 'anomaly')
    } finally {
      setSubmitting(false)
    }
  }

  const scenarioMeta = SCENARIOS.find(s => s.value === form.scenario)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <PageHeader
        title="Inject Bag"
        subtitle="Manually push a baggage tag into the live MQTT stream"
      />

      <div className="animate-fade-up" style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
        gap: isMobile ? 14 : 22,
        padding: isMobile ? '16px 14px 80px' : '28px 32px',
        maxWidth: 1100,
        margin: '0 auto',
      }}>

        {/* ── FORM CARD ──────────────────────────── */}
        <form
          onSubmit={handleSubmit}
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border-2)',
            borderTop: '2px solid var(--accent)',
            borderRadius: 12,
            padding: '24px 26px 22px',
            boxShadow: '0 0 30px rgba(245,166,35,0.04)',
          }}
        >
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 9, fontWeight: 600,
            color: 'var(--accent)',
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            marginBottom: 18,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <Zap size={11} /> OPERATOR INPUT
          </div>

          {error && (
            <div style={{
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)',
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

            <Field label="Scenario">
              <select
                value={form.scenario}
                onChange={e => update('scenario', e.target.value)}
                style={inputStyle}
              >
                {SCENARIOS.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
              {scenarioMeta && (
                <div style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10, color: 'var(--muted)',
                  marginTop: 6, letterSpacing: '0.04em',
                }}>
                  → {scenarioMeta.desc}
                </div>
              )}
            </Field>

            <Field label="Simulation Speed">
              <select
                value={form.speed}
                onChange={e => update('speed', parseFloat(e.target.value))}
                style={inputStyle}
              >
                {SPEEDS.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </Field>
          </div>

          <button
            type="submit"
            disabled={submitting}
            style={{
              ...btnPrimary,
              width: '100%',
              marginTop: 22,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              opacity: submitting ? 0.6 : 1,
            }}
          >
            <Send size={14} />
            {submitting ? 'Injecting…' : 'Inject Bag'}
          </button>
        </form>

        {/* ── RECENT INJECTIONS LIST ─────────────── */}
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border-2)',
            borderRadius: 12,
            padding: '24px 26px 22px',
          }}
        >
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 9, fontWeight: 600,
            color: 'var(--muted-2)',
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            marginBottom: 18,
          }}>
            RECENT INJECTIONS — THIS SESSION
          </div>

          {recent.length === 0 ? (
            <div style={{
              padding: '40px 16px',
              textAlign: 'center',
              color: 'var(--muted)',
              fontSize: 12,
              fontFamily: 'var(--font-mono)',
              letterSpacing: '0.06em',
            }}>
              No bags injected yet.<br/>
              <span style={{ opacity: 0.6 }}>Submit the form to start a simulation.</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {recent.map((r, idx) => (
                <RecentCard key={`${r.tag_id}-${idx}`} entry={r} />
              ))}
            </div>
          )}

          {recent.length > 0 && (
            <div style={{
              marginTop: 18,
              paddingTop: 14,
              borderTop: '1px solid var(--border)',
              fontSize: 11,
              color: 'var(--muted)',
              fontFamily: 'var(--font-mono)',
              letterSpacing: '0.04em',
            }}>
              → Open the Live Map to watch these bags move through checkpoints.
            </div>
          )}
        </div>

      </div>
    </div>
  )
}

function RecentCard({ entry }) {
  const time = new Date(entry.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const meta = SCENARIOS.find(s => s.value === entry.scenario)
  const isAnomaly = entry.scenario && entry.scenario !== 'normal'

  return (
    <div style={{
      background: 'var(--surface-2)',
      border: '1px solid var(--border)',
      borderRadius: 8,
      padding: '12px 14px',
      display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 13, fontWeight: 600,
          color: 'var(--accent)',
        }}>{entry.tag_id}</div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 5,
          fontSize: 10, color: 'var(--muted)',
          fontFamily: 'var(--font-mono)',
        }}>
          <CheckCircle size={11} color="var(--success)" /> {time}
        </div>
      </div>

      <div style={{ fontSize: 12, color: 'var(--text)' }}>
        {entry.passenger}
        <span style={{ color: 'var(--muted)' }}> · </span>
        <span style={{ fontFamily: 'var(--font-mono)' }}>{entry.flight_id}</span>
      </div>

      <div style={{
        display: 'inline-flex', alignSelf: 'flex-start',
        fontFamily: 'var(--font-mono)',
        fontSize: 9, fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '0.1em',
        padding: '2px 7px', borderRadius: 4,
        background: isAnomaly ? 'rgba(239,68,68,0.12)' : 'rgba(0,204,125,0.12)',
        color:      isAnomaly ? 'var(--danger)'        : 'var(--success)',
      }}>
        {meta?.label ?? entry.scenario}
      </div>
    </div>
  )
}

function Field({ label, hint, children }) {
  return (
    <div>
      <div style={{
        fontSize: 11, fontWeight: 600,
        color: 'var(--muted-2)',
        marginBottom: 6,
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
      }}>{label}</div>
      {children}
      {hint && (
        <div style={{
          fontSize: 10, color: 'var(--muted)',
          marginTop: 5, fontStyle: 'italic',
        }}>{hint}</div>
      )}
    </div>
  )
}

const inputStyle = {
  width: '100%', boxSizing: 'border-box',
  background: 'var(--surface-2)',
  border: '1px solid var(--border-2)',
  borderRadius: 8,
  padding: '9px 12px',
  fontSize: 13,
  color: 'var(--text)',
  outline: 'none',
}

const btnPrimary = {
  background: 'var(--accent)',
  color: '#000',
  border: 'none',
  borderRadius: 8,
  padding: '11px 20px',
  fontSize: 13,
  fontWeight: 700,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  cursor: 'pointer',
  transition: 'all 0.15s',
}
