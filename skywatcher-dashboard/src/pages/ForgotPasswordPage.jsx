import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react'
import { forgotPassword } from '../utils/api'

export default function ForgotPasswordPage() {
  const [email,    setEmail]    = useState('')
  const [busy,     setBusy]     = useState(false)
  const [sent,     setSent]     = useState(false)
  const [error,    setError]    = useState('')

  async function submit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await forgotPassword(email.trim())
      setSent(true)
    } catch (err) {
      setError(err.response?.data?.error ?? 'Something went wrong. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px 16px',
    }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        {/* Back link */}
        <Link to="/login" style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          fontSize: 13, color: 'var(--muted)', textDecoration: 'none',
          marginBottom: 24,
        }}>
          <ArrowLeft size={14} /> Back to sign in
        </Link>

        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border-2)',
          borderTop: '2px solid var(--accent)',
          borderRadius: 14,
          padding: '32px 28px',
        }}>
          {sent ? (
            <div style={{ textAlign: 'center' }}>
              <CheckCircle size={40} color="var(--success)" style={{ marginBottom: 16 }} />
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
                Check your email
              </div>
              <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
                If <strong>{email}</strong> is registered, you'll receive a password reset link within a minute.
              </div>
              <Link to="/login" style={{
                display: 'inline-block', marginTop: 24,
                fontSize: 13, color: 'var(--accent)', textDecoration: 'none', fontWeight: 600,
              }}>
                Return to sign in →
              </Link>
            </div>
          ) : (
            <>
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
                  Forgot password
                </div>
                <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                  Enter your account email and we'll send a reset link.
                </div>
              </div>

              {error && (
                <div style={{
                  background: 'var(--danger-dim)', border: '1px solid rgba(220,38,38,0.3)',
                  borderRadius: 8, padding: '10px 14px', marginBottom: 16,
                  fontSize: 12, color: 'var(--danger)',
                }}>
                  {error}
                </div>
              )}

              <form onSubmit={submit}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--muted-2)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
                  Email
                </label>
                <div style={{ position: 'relative', marginBottom: 20 }}>
                  <Mail size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      paddingLeft: 38, paddingRight: 14, paddingTop: 10, paddingBottom: 10,
                      background: 'var(--surface-2)', border: '1px solid var(--border-2)',
                      borderRadius: 8, fontSize: 13, color: 'var(--text)', outline: 'none',
                    }}
                  />
                </div>

                <button type="submit" disabled={busy || !email} style={{
                  width: '100%', padding: '11px',
                  background: email ? 'var(--accent)' : 'var(--surface-3)',
                  color: email ? '#000' : 'var(--muted)',
                  border: 'none', borderRadius: 8,
                  fontSize: 13, fontWeight: 700, letterSpacing: '0.04em',
                  textTransform: 'uppercase', cursor: email && !busy ? 'pointer' : 'default',
                  opacity: busy ? 0.7 : 1,
                }}>
                  {busy ? 'Sending…' : 'Send Reset Link'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
