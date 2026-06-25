import { useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Lock, Eye, EyeOff, CheckCircle } from 'lucide-react'
import { resetPassword } from '../utils/api'

export default function ResetPasswordPage() {
  const [params]     = useSearchParams()
  const navigate     = useNavigate()
  const token        = params.get('token') ?? ''

  const [password,   setPassword]   = useState('')
  const [confirm,    setConfirm]    = useState('')
  const [showPw,     setShowPw]     = useState(false)
  const [busy,       setBusy]       = useState(false)
  const [done,       setDone]       = useState(false)
  const [error,      setError]      = useState('')

  async function submit(e) {
    e.preventDefault()
    if (password !== confirm) { setError('Passwords do not match'); return }
    if (password.length < 6)  { setError('Password must be at least 6 characters'); return }
    setError('')
    setBusy(true)
    try {
      await resetPassword(token, password)
      setDone(true)
      setTimeout(() => navigate('/login'), 2500)
    } catch (err) {
      setError(err.response?.data?.error ?? 'Reset failed. The link may have expired.')
    } finally {
      setBusy(false)
    }
  }

  if (!token) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 14 }}>
          Invalid reset link. <a href="/forgot-password" style={{ color: 'var(--accent)' }}>Request a new one.</a>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px 16px',
    }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border-2)',
          borderTop: '2px solid var(--accent)',
          borderRadius: 14,
          padding: '32px 28px',
        }}>
          {done ? (
            <div style={{ textAlign: 'center' }}>
              <CheckCircle size={40} color="var(--success)" style={{ marginBottom: 16 }} />
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
                Password updated!
              </div>
              <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                Redirecting you to sign in…
              </div>
            </div>
          ) : (
            <>
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
                  Set new password
                </div>
                <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                  Choose a strong password for your account.
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
                {[
                  { label: 'New password',      val: password, set: setPassword },
                  { label: 'Confirm password',  val: confirm,  set: setConfirm  },
                ].map(({ label, val, set }) => (
                  <div key={label} style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--muted-2)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
                      {label}
                    </label>
                    <div style={{ position: 'relative' }}>
                      <Lock size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
                      <input
                        type={showPw ? 'text' : 'password'}
                        value={val}
                        onChange={e => set(e.target.value)}
                        required
                        style={{
                          width: '100%', boxSizing: 'border-box',
                          paddingLeft: 38, paddingRight: 42, paddingTop: 10, paddingBottom: 10,
                          background: 'var(--surface-2)', border: '1px solid var(--border-2)',
                          borderRadius: 8, fontSize: 13, color: 'var(--text)', outline: 'none',
                        }}
                      />
                      <button type="button" onClick={() => setShowPw(v => !v)} style={{
                        position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                        background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 0,
                      }}>
                        {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>
                ))}

                <button type="submit" disabled={busy || !password || !confirm} style={{
                  width: '100%', padding: '11px', marginTop: 4,
                  background: password && confirm ? 'var(--accent)' : 'var(--surface-3)',
                  color: password && confirm ? '#000' : 'var(--muted)',
                  border: 'none', borderRadius: 8,
                  fontSize: 13, fontWeight: 700, letterSpacing: '0.04em',
                  textTransform: 'uppercase', cursor: password && confirm && !busy ? 'pointer' : 'default',
                  opacity: busy ? 0.7 : 1,
                }}>
                  {busy ? 'Updating…' : 'Update Password'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
