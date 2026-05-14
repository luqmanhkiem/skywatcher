import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Eye, EyeOff, AlertCircle, ArrowRight, ArrowLeft } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const ROLE_DEFAULT_ROUTE = {
  admin:        '/dashboard',
  ground_staff: '/alerts',
}

export default function LoginPage() {
  const { login }               = useAuth()
  const navigate                = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPw,   setShowPw]   = useState(false)
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!username.trim() || !password) {
      setError('Please enter your username and password.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const user = await login(username.trim(), password)
      navigate(ROLE_DEFAULT_ROUTE[user.role] ?? '/dashboard', { replace: true })
    } catch (err) {
      const msg = err.response?.data?.error ?? 'Login failed. Please try again.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--lt-bg)',
      color: 'var(--lt-text)',
      fontFamily: 'var(--lt-font)',
      display: 'flex',
      flexDirection: 'column',
    }}>

      {/* ──── Header (small) ──── */}
      <header style={{
        maxWidth: 1200,
        width: '100%',
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

        <Link to="/" style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          color: 'var(--lt-text-2)',
          fontSize: 14, fontWeight: 500,
          textDecoration: 'none',
        }}>
          <ArrowLeft size={15} /> Back home
        </Link>
      </header>

      {/* ──── Sign-in card ──── */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 32px 48px',
      }}>
        <div style={{
          width: '100%',
          maxWidth: 420,
        }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <h1 style={{
              fontSize: 44,
              fontWeight: 900,
              letterSpacing: '-0.03em',
              lineHeight: 1.0,
              marginBottom: 12,
            }}>Staff sign in</h1>
            <p style={{ fontSize: 15, color: 'var(--lt-text-2)', lineHeight: 1.5 }}>
              For airport operations staff only.<br/>
              Looking for your bag? <Link to="/" style={{ color: 'var(--lt-cta)', fontWeight: 600 }}>Track without an account</Link>
            </p>
          </div>

          <form onSubmit={handleSubmit} style={{
            background: 'var(--lt-card)',
            border: '1px solid var(--lt-border)',
            borderRadius: 20,
            padding: '32px 28px',
          }}>

            {error && (
              <div style={{
                background: '#FEE2E2',
                border: '1px solid #FCA5A5',
                color: '#991B1B',
                borderRadius: 12,
                padding: '10px 14px',
                fontSize: 13,
                fontWeight: 500,
                marginBottom: 20,
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <AlertCircle size={15} /> {error}
              </div>
            )}

            <Field label="Username">
              <input
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="admin"
                style={inputStyle}
                autoFocus
              />
            </Field>

            <div style={{ height: 16 }} />

            <Field label="Password">
              <div style={{ position: 'relative' }}>
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{ ...inputStyle, paddingRight: 44 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(s => !s)}
                  style={{
                    position: 'absolute',
                    right: 14, top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none', border: 'none',
                    color: 'var(--lt-muted)',
                    cursor: 'pointer',
                    padding: 4,
                    display: 'flex',
                  }}
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                >
                  {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </Field>

            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: 22,
                width: '100%',
                background: 'var(--lt-cta)',
                color: 'var(--lt-cta-fg)',
                border: 'none',
                borderRadius: 12,
                padding: '14px 20px',
                fontFamily: 'var(--lt-font)',
                fontSize: 15,
                fontWeight: 600,
                cursor: loading ? 'wait' : 'pointer',
                opacity: loading ? 0.6 : 1,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              {loading ? 'Signing in…' : <>Sign in <ArrowRight size={17} strokeWidth={2.5} /></>}
            </button>
          </form>

          {/* Demo credentials */}
          <div style={{
            marginTop: 24,
            padding: '20px 24px',
            background: 'var(--lt-pill)',
            borderRadius: 14,
            fontSize: 13,
          }}>
            <div style={{
              fontSize: 11, fontWeight: 600,
              color: 'var(--lt-muted)',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              marginBottom: 10,
            }}>
              Demo access
            </div>
            <div style={{ display: 'grid', gap: 6, fontFamily: 'var(--font-mono)' }}>
              <div>
                <span style={{ fontWeight: 600, color: 'var(--lt-text)' }}>admin</span>
                <span style={{ color: 'var(--lt-muted)' }}> / admin123 — Full access</span>
              </div>
              <div>
                <span style={{ fontWeight: 600, color: 'var(--lt-text)' }}>staff_security</span>
                <span style={{ color: 'var(--lt-muted)' }}> / staff123 — Ground staff</span>
              </div>
            </div>
          </div>

          <p style={{
            textAlign: 'center',
            fontSize: 12,
            color: 'var(--lt-muted)',
            marginTop: 24,
          }}>
            PSM 2025/2026 · UTeM FTMK · B032310853
          </p>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <label style={{ display: 'block' }}>
      <span style={{
        display: 'block',
        fontSize: 12,
        fontWeight: 600,
        color: 'var(--lt-muted)',
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        marginBottom: 8,
      }}>{label}</span>
      {children}
    </label>
  )
}

const inputStyle = {
  width: '100%',
  boxSizing: 'border-box',
  background: 'var(--lt-bg-soft)',
  border: '1px solid var(--lt-border)',
  borderRadius: 12,
  padding: '13px 16px',
  fontFamily: 'var(--lt-font)',
  fontSize: 15,
  fontWeight: 500,
  color: 'var(--lt-text)',
  outline: 'none',
  transition: 'border-color 0.15s, background 0.15s',
}
