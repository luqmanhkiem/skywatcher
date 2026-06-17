import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle, AlertTriangle, Send } from 'lucide-react'
import { submitFeedback } from '../utils/api'

const CATEGORIES = [
  { value: 'lost_bag',     label: 'Lost bag' },
  { value: 'damaged_bag',  label: 'Damaged bag' },
  { value: 'delayed_bag',  label: 'Delayed bag' },
  { value: 'complaint',    label: 'Complaint' },
  { value: 'suggestion',   label: 'Suggestion' },
  { value: 'other',        label: 'Other' },
]

const MAX_MESSAGE = 2000

export default function FeedbackPage() {
  const [params] = useSearchParams()

  const [form, setForm] = useState({
    name:      params.get('passenger') ?? '',
    email:     '',
    flight_id: params.get('flight') ?? '',
    tag_id:    params.get('tag') ?? '',
    category:  'lost_bag',
    message:   '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]           = useState('')
  const [done, setDone]             = useState(false)

  function update(field, value) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!form.name.trim())    { setError('Please enter your name.');   return }
    if (!form.message.trim()) { setError('Please describe the issue.'); return }
    setSubmitting(true)
    try {
      await submitFeedback(form)
      setDone(true)
    } catch (err) {
      setError(err.response?.data?.error ?? 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--lt-bg)',
      color: 'var(--lt-text)',
      fontFamily: 'var(--lt-font)',
    }}>
      {/* Header */}
      <header style={{
        maxWidth: 1200, margin: '0 auto', padding: '24px 32px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: 'inherit' }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'var(--lt-text)', color: 'var(--lt-bg)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 900, fontSize: 18,
          }}>S</div>
          <span style={{ fontWeight: 700, fontSize: 18, letterSpacing: '-0.01em' }}>SkyWatcher</span>
        </Link>
        <Link to="/" style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: 'var(--lt-cta)', color: 'var(--lt-cta-fg)',
          padding: '9px 18px', borderRadius: 999,
          fontWeight: 600, fontSize: 14, textDecoration: 'none',
        }}>Track a bag</Link>
      </header>

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '24px 32px 80px' }}>
        <Link to="/" style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          color: 'var(--lt-text-2)', fontSize: 14, fontWeight: 500,
          textDecoration: 'none', marginBottom: 20,
        }}>
          <ArrowLeft size={15} /> Back home
        </Link>

        {done ? (
          <div style={{
            background: 'var(--lt-card)',
            border: '1px solid var(--lt-border)',
            borderRadius: 18,
            padding: '48px 40px',
            textAlign: 'center',
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: '#DCFCE7', margin: '0 auto 18px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <CheckCircle size={28} color="#15803D" />
            </div>
            <h2 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 10 }}>
              Thanks for contacting support
            </h2>
            <p style={{ fontSize: 15, color: 'var(--lt-text-2)', lineHeight: 1.5, marginBottom: 24 }}>
              Thank you, {form.name.trim() || 'traveller'}. Your report has been received and our
              team has been notified — an administrator will contact you shortly
              {form.email ? ` at ${form.email}` : ''}.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link to="/track" style={ctaBtn}>Track your bag</Link>
              <button
                onClick={() => { setDone(false); setForm(f => ({ ...f, message: '' })) }}
                style={ghostBtn}
              >
                Submit another
              </button>
            </div>
          </div>
        ) : (
          <>
            <h1 style={{
              fontSize: 'clamp(32px, 5vw, 48px)', fontWeight: 900,
              letterSpacing: '-0.03em', lineHeight: 1.0, marginBottom: 12,
            }}>
              Contact us
            </h1>
            <p style={{ fontSize: 16, color: 'var(--lt-text-2)', marginBottom: 28, lineHeight: 1.5 }}>
              Lost, delayed, or damaged bag? Have a question or suggestion?
              Tell us what happened and our team will get back to you.
            </p>

            {error && (
              <div style={errorCard}>
                <AlertTriangle size={18} /> {error}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{
              background: 'var(--lt-card)',
              border: '1px solid var(--lt-border)',
              borderRadius: 18,
              padding: '28px',
              display: 'flex', flexDirection: 'column', gap: 18,
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <FormField label="Your name *">
                  <input value={form.name} onChange={e => update('name', e.target.value)}
                    placeholder="Aisyah Rahman" style={inputStyle} />
                </FormField>
                <FormField label="Email (optional)">
                  <input value={form.email} onChange={e => update('email', e.target.value)}
                    placeholder="you@email.com" type="email" style={inputStyle} />
                </FormField>
                <FormField label="Flight (optional)">
                  <input value={form.flight_id} onChange={e => update('flight_id', e.target.value)}
                    placeholder="MH370" style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }} />
                </FormField>
                <FormField label="Bag tag (optional)">
                  <input value={form.tag_id} onChange={e => update('tag_id', e.target.value)}
                    placeholder="TAG-1001" style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }} />
                </FormField>
              </div>

              <FormField label="What is this about? *">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {CATEGORIES.map(c => {
                    const active = form.category === c.value
                    return (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => update('category', c.value)}
                        style={{
                          padding: '8px 14px',
                          borderRadius: 999,
                          border: active ? '1px solid var(--lt-cta)' : '1px solid var(--lt-border)',
                          background: active ? 'var(--lt-cta-soft)' : 'transparent',
                          color: active ? 'var(--lt-cta)' : 'var(--lt-text-2)',
                          fontFamily: 'var(--lt-font)',
                          fontSize: 13, fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        {c.label}
                      </button>
                    )
                  })}
                </div>
              </FormField>

              <FormField label="Describe the issue *">
                <textarea
                  value={form.message}
                  onChange={e => update('message', e.target.value.slice(0, MAX_MESSAGE))}
                  placeholder="Tell us what happened, including when and where…"
                  rows={5}
                  style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
                />
                <div style={{ fontSize: 11, color: 'var(--lt-muted)', textAlign: 'right', marginTop: 4 }}>
                  {form.message.length} / {MAX_MESSAGE}
                </div>
              </FormField>

              <button
                type="submit"
                disabled={submitting}
                style={{
                  ...ctaBtn,
                  border: 'none',
                  justifyContent: 'center',
                  opacity: submitting ? 0.55 : 1,
                  cursor: submitting ? 'default' : 'pointer',
                }}
              >
                {submitting ? 'Sending…' : <>Send report <Send size={15} /></>}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

function FormField({ label, children }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      <span style={{
        fontSize: 11, fontWeight: 600,
        letterSpacing: '0.06em', textTransform: 'uppercase',
        color: 'var(--lt-muted)',
      }}>{label}</span>
      {children}
    </label>
  )
}

const inputStyle = {
  width: '100%', boxSizing: 'border-box',
  background: 'var(--lt-bg-soft)',
  border: '1px solid var(--lt-border)',
  borderRadius: 10,
  padding: '11px 14px',
  fontSize: 15,
  color: 'var(--lt-text)',
  outline: 'none',
  fontFamily: 'var(--lt-font)',
}

const ctaBtn = {
  display: 'inline-flex', alignItems: 'center', gap: 8,
  background: 'var(--lt-cta)', color: 'var(--lt-cta-fg)',
  padding: '13px 22px', borderRadius: 12,
  fontFamily: 'var(--lt-font)', fontWeight: 700, fontSize: 15,
  textDecoration: 'none',
}

const ghostBtn = {
  display: 'inline-flex', alignItems: 'center', gap: 8,
  background: 'transparent', color: 'var(--lt-text-2)',
  border: '1px solid var(--lt-border)',
  padding: '13px 22px', borderRadius: 12,
  fontFamily: 'var(--lt-font)', fontWeight: 600, fontSize: 15,
  cursor: 'pointer',
}

const errorCard = {
  background: '#FEE2E2',
  border: '1px solid #FCA5A5',
  color: '#991B1B',
  borderRadius: 12,
  padding: '12px 16px',
  fontSize: 14, fontWeight: 500,
  marginBottom: 20,
  display: 'flex', alignItems: 'center', gap: 8,
}
