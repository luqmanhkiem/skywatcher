import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Luggage, Eye, EyeOff, AlertCircle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const ROLE_DEFAULT_ROUTE = {
  admin:        '/',
  ground_staff: '/alerts',
  passenger:    '/track',
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
      navigate(ROLE_DEFAULT_ROUTE[user.role] ?? '/', { replace: true })
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
      background: 'var(--bg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    }}>
      {/* Ambient radar glow */}
      <div style={{
        position: 'fixed',
        top: '15%', left: '50%',
        transform: 'translateX(-50%)',
        width: 700, height: 700,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(245,166,35,0.05) 0%, transparent 65%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'fixed',
        bottom: '10%', left: '20%',
        width: 400, height: 400,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(0,204,125,0.04) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div className="animate-scale-in" style={{
        width: '100%',
        maxWidth: 400,
        background: 'var(--surface)',
        border: '1px solid var(--border-2)',
        borderTop: '2px solid var(--accent)',
        borderRadius: 12,
        padding: '36px 32px 30px',
        boxShadow: '0 32px 80px rgba(0,0,0,0.6), 0 0 40px rgba(245,166,35,0.06)',
        position: 'relative',
      }}>
        {/* Amber corner accent */}
        <div style={{
          position: 'absolute',
          top: 10, right: 14,
          fontFamily: 'var(--font-mono)',
          fontSize: 8,
          color: 'var(--accent)',
          opacity: 0.5,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
        }}>
          SECURE // v2.0
        </div>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 30 }}>
          <div style={{
            width: 52, height: 52,
            borderRadius: 12,
            background: 'var(--surface-2)',
            border: '1px solid var(--accent)',
            boxShadow: '0 0 24px var(--accent-glow)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 18,
          }}>
            <Luggage size={24} color="var(--accent)" />
          </div>
          <h1 style={{
            fontFamily: 'var(--font-heading)',
            fontSize: 26,
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'var(--text)',
            lineHeight: 1,
            marginBottom: 6,
          }}>
            SkyWatcher
          </h1>
          <p style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            color: 'var(--muted-2)',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}>
            Airport Baggage Operations
          </p>
        </div>

        {/* Divider */}
        <div style={{ borderTop: '1px solid var(--border)', marginBottom: 22 }} />

        {/* Error */}
        {error && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 9,
            background: 'var(--danger-dim)',
            border: '1px solid rgba(255,51,85,0.3)',
            borderRadius: 8,
            padding: '10px 14px',
            marginBottom: 18,
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--danger)',
            letterSpacing: '0.02em',
          }}>
            <AlertCircle size={14} style={{ flexShrink: 0 }} />
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Username */}
          <div>
            <label style={{
              display: 'block',
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              fontWeight: 600,
              color: 'var(--muted-2)',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              marginBottom: 7,
            }}>
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoComplete="username"
              autoFocus
              placeholder="Enter your username"
              className="sky-input"
            />
          </div>

          {/* Password */}
          <div>
            <label style={{
              display: 'block',
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              fontWeight: 600,
              color: 'var(--muted-2)',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              marginBottom: 7,
            }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="Enter your password"
                className="sky-input"
                style={{ paddingRight: 40 }}
              />
              <button
                type="button"
                onClick={() => setShowPw(p => !p)}
                style={{
                  position: 'absolute',
                  right: 11, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none',
                  cursor: 'pointer',
                  color: 'var(--muted)',
                  display: 'flex', alignItems: 'center',
                  padding: 2,
                  transition: 'color 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent)' }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--muted)' }}
              >
                {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="sky-btn sky-btn-primary"
            style={{
              marginTop: 4,
              width: '100%',
              padding: '12px',
              fontSize: 13,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              opacity: loading ? 0.6 : 1,
              cursor: loading ? 'not-allowed' : 'pointer',
              background: loading ? 'var(--surface-3)' : 'var(--accent)',
              color: loading ? 'var(--muted-2)' : '#000',
            }}
          >
            {loading ? 'Authenticating…' : 'Access System'}
          </button>
        </form>

        {/* Demo credentials */}
        <div style={{
          marginTop: 22,
          padding: '12px 14px',
          background: 'var(--bg)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          lineHeight: 1.8,
        }}>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 9,
            fontWeight: 600,
            color: 'var(--muted)',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            marginBottom: 6,
          }}>Demo Access</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted-2)' }}>
            <div><span style={{ color: 'var(--accent)' }}>admin</span> / admin123 — Full access</div>
            <div><span style={{ color: 'var(--success)' }}>staff_security</span> / staff123 — Ground staff</div>
            <div><span style={{ color: 'var(--purple)' }}>passenger_test</span> / pass123 — Passenger</div>
          </div>
        </div>

        <p style={{
          textAlign: 'center',
          fontFamily: 'var(--font-mono)',
          fontSize: 9,
          color: 'var(--muted)',
          marginTop: 18,
          letterSpacing: '0.06em',
        }}>
          PSM 2025/2026 · UTeM FTMK · B032310853
        </p>
      </div>
    </div>
  )
}
