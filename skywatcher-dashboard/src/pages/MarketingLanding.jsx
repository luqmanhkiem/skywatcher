import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Radar, Bell, Plane } from 'lucide-react'

const SAMPLE_BUBBLES = [
  "Where's my bag from MH370?",
  "Did my luggage make the connection?",
  "Has my bag cleared security yet?",
  "Will my bag beat me to the carousel?",
  "Is my bag still in Kuala Lumpur?",
  "Did my suitcase get scanned at sorting?",
]

const TYPE_SPEED  = 45   // ms per character (typing)
const ERASE_SPEED = 22   // ms per character (erasing)
const HOLD_TIME   = 1800 // ms to hold full text before erasing

function useTypewriter(strings) {
  const [index, setIndex] = useState(0)
  const [text,  setText]  = useState('')
  const [phase, setPhase] = useState('typing') // 'typing' | 'erasing'

  useEffect(() => {
    const current = strings[index]
    let timeout

    if (phase === 'typing') {
      if (text.length < current.length) {
        timeout = setTimeout(() => setText(current.slice(0, text.length + 1)), TYPE_SPEED)
      } else {
        timeout = setTimeout(() => setPhase('erasing'), HOLD_TIME)
      }
    } else {
      if (text.length > 0) {
        timeout = setTimeout(() => setText(current.slice(0, text.length - 1)), ERASE_SPEED)
      } else {
        setIndex(i => (i + 1) % strings.length)
        setPhase('typing')
      }
    }
    return () => clearTimeout(timeout)
  }, [text, phase, index, strings])

  return text
}

export default function MarketingLanding() {
  const navigate = useNavigate()
  const [flight,   setFlight]   = useState('')
  const [passenger, setPassenger] = useState('')
  const bubble = useTypewriter(SAMPLE_BUBBLES)

  function handleTrack(e) {
    e.preventDefault()
    if (!flight.trim() || !passenger.trim()) return
    const q = new URLSearchParams({ flight: flight.trim(), passenger: passenger.trim() }).toString()
    navigate(`/track?${q}`)
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--lt-bg)',
      color: 'var(--lt-text)',
      fontFamily: 'var(--lt-font)',
    }}>
      {/* ──── NAV ──── */}
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
            fontWeight: 900, fontSize: 18, fontFamily: 'var(--lt-font)',
          }}>S</div>
          <span style={{ fontWeight: 700, fontSize: 18, letterSpacing: '-0.01em' }}>SkyWatcher</span>
        </Link>

        <nav style={{ display: 'flex', alignItems: 'center', gap: 36 }}>
          <a href="#track"       style={navLink}>Track</a>
          <a href="#how-it-works" style={navLink}>How it works</a>
          <a href="#for-airlines" style={navLink}>For airlines</a>
        </nav>

        <Link to="/login" style={ctaPill}>Staff sign in</Link>
      </header>

      {/* ──── HERO ──── */}
      <section style={{
        maxWidth: 1100,
        margin: '0 auto',
        padding: '64px 32px 96px',
        textAlign: 'center',
      }}>
        {/* Speech bubble — typewriter effect */}
        <div style={{
          minHeight: 48,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 40,
        }}>
          <div style={{
            position: 'relative',
            display: 'inline-flex',
            alignItems: 'center',
            background: 'var(--lt-pill)',
            color: 'var(--lt-text-2)',
            fontSize: 15,
            padding: '12px 22px',
            borderRadius: 18,
            fontWeight: 500,
            minWidth: 60,
            transition: 'min-width 0.1s',
          }}>
            <span>{bubble || ' '}</span>
            <span style={{
              display: 'inline-block',
              width: 2,
              height: 18,
              marginLeft: 3,
              background: 'var(--lt-text-2)',
              animation: 'blink 0.9s ease-in-out infinite',
              verticalAlign: 'middle',
            }} />
            {/* Tail pointing down */}
            <div style={{
              position: 'absolute',
              bottom: -6,
              left: '50%',
              transform: 'translateX(-50%) rotate(45deg)',
              width: 14,
              height: 14,
              background: 'var(--lt-pill)',
              borderBottomRightRadius: 3,
            }} />
          </div>
        </div>

        {/* Headline */}
        <h1 style={{
          fontSize: 'clamp(48px, 8vw, 112px)',
          fontWeight: 900,
          letterSpacing: '-0.04em',
          lineHeight: 0.95,
          margin: 0,
          marginBottom: 28,
        }}>
          Find your bag<br/>before you land.
        </h1>

        <p style={{
          fontSize: 19,
          color: 'var(--lt-text-2)',
          maxWidth: 640,
          margin: '0 auto 44px',
          lineHeight: 1.45,
          fontWeight: 400,
        }}>
          Real-time baggage tracking for every flight you take.<br/>
          No app, no account — just your flight and a name.
        </p>

        {/* Inline tracking form */}
        <form
          id="track"
          onSubmit={handleTrack}
          style={{
            background: 'var(--lt-card)',
            border: '1px solid var(--lt-border)',
            borderRadius: 20,
            padding: 10,
            display: 'flex',
            alignItems: 'stretch',
            gap: 10,
            maxWidth: 720,
            margin: '0 auto',
            boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
          }}
        >
          <FormField label="Flight" value={flight} onChange={setFlight} placeholder="MH370" />
          <div style={{ width: 1, background: 'var(--lt-border)', margin: '6px 0' }} />
          <FormField label="Passenger" value={passenger} onChange={setPassenger} placeholder="Tan" />

          <button
            type="submit"
            disabled={!flight.trim() || !passenger.trim()}
            style={{
              ...ctaButton,
              opacity: (!flight.trim() || !passenger.trim()) ? 0.45 : 1,
            }}
          >
            Track bag <ArrowRight size={18} strokeWidth={2.5} />
          </button>
        </form>
      </section>

      {/* ──── HOW IT WORKS ──── */}
      <section id="how-it-works" style={{
        maxWidth: 1100,
        margin: '0 auto',
        padding: '96px 32px',
        borderTop: '1px solid var(--lt-border)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 64 }}>
          <div style={pillLabel}>How it works</div>
          <h2 style={sectionHeading}>
            Every bag, every checkpoint,<br/>real-time updates.
          </h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 32 }}>
          <Feature
            num="01"
            icon={Radar}
            title="RFID tags scan automatically"
            body="Each bag is tagged at check-in. As it moves through security, sorting, loading and arrival, every scan publishes a live event."
          />
          <Feature
            num="02"
            icon={Bell}
            title="Anomalies caught instantly"
            body="Machine learning flags stalls, wrong routes and security bypasses the moment they happen — before bags go missing."
          />
          <Feature
            num="03"
            icon={Plane}
            title="You always know"
            body="Type your flight and name. See the full journey of your bag — from the carousel back to check-in. No account needed."
          />
        </div>
      </section>

      {/* ──── FOR AIRLINES ──── */}
      <section id="for-airlines" style={{
        maxWidth: 1100,
        margin: '0 auto',
        padding: '0 32px 96px',
      }}>
        <div style={{
          background: 'var(--lt-text)',
          color: 'var(--lt-bg)',
          borderRadius: 24,
          padding: '72px 64px',
          textAlign: 'center',
        }}>
          <div style={{
            display: 'inline-block',
            background: 'rgba(255,255,255,0.1)',
            color: 'var(--lt-bg)',
            fontSize: 12,
            padding: '6px 14px',
            borderRadius: 999,
            marginBottom: 24,
            fontWeight: 500,
            letterSpacing: '0.02em',
          }}>
            FOR AIRLINES
          </div>
          <h2 style={{
            fontSize: 'clamp(36px, 5vw, 64px)',
            fontWeight: 900,
            letterSpacing: '-0.03em',
            lineHeight: 1.0,
            margin: 0,
            marginBottom: 20,
          }}>
            Mishandled bags<br/>cost the industry $5B a year.
          </h2>
          <p style={{
            fontSize: 18,
            color: 'rgba(255,255,255,0.7)',
            maxWidth: 560,
            margin: '0 auto 32px',
            lineHeight: 1.5,
          }}>
            SkyWatcher gives ops teams a live map of every bag in the system,
            instant alerts on anomalies, and complete audit trails per flight.
          </p>
          <Link to="/login" style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            background: 'var(--lt-bg)',
            color: 'var(--lt-text)',
            padding: '13px 26px',
            borderRadius: 999,
            fontWeight: 600,
            fontSize: 15,
            textDecoration: 'none',
            transition: 'transform 0.15s',
          }}>
            Staff sign in <ArrowRight size={16} strokeWidth={2.5} />
          </Link>
        </div>
      </section>

      {/* ──── FOOTER ──── */}
      <footer style={{
        maxWidth: 1200,
        margin: '0 auto',
        padding: '40px 32px',
        borderTop: '1px solid var(--lt-border)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: 13,
        color: 'var(--lt-muted)',
      }}>
        <div>SkyWatcher — Real-time baggage tracking</div>
        <div>PSM 2025/2026 · UTeM FTMK · B032310853</div>
      </footer>
    </div>
  )
}

/* ─── Sub-components ──────────────────────────────────────────────────── */

function FormField({ label, value, onChange, placeholder }) {
  return (
    <label style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
      padding: '12px 18px',
      cursor: 'text',
    }}>
      <span style={{
        fontSize: 11,
        fontWeight: 600,
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
          fontSize: 18,
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

function Feature({ num, icon: Icon, title, body }) {
  return (
    <div style={{
      background: 'var(--lt-card)',
      border: '1px solid var(--lt-border)',
      borderRadius: 16,
      padding: 32,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12,
          background: 'var(--lt-text)',
          color: 'var(--lt-bg)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={20} strokeWidth={2} />
        </div>
        <div style={{
          fontSize: 13, fontWeight: 500,
          color: 'var(--lt-muted-2)',
          fontVariantNumeric: 'tabular-nums',
        }}>{num}</div>
      </div>
      <h3 style={{
        fontSize: 20,
        fontWeight: 700,
        letterSpacing: '-0.01em',
        marginBottom: 10,
      }}>{title}</h3>
      <p style={{ fontSize: 14, color: 'var(--lt-text-2)', lineHeight: 1.5 }}>{body}</p>
    </div>
  )
}

/* ─── Styles ──────────────────────────────────────────────────────────── */

const navLink = {
  fontSize: 15,
  fontWeight: 500,
  color: 'var(--lt-text)',
  textDecoration: 'none',
}

const ctaPill = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  background: 'var(--lt-cta)',
  color: 'var(--lt-cta-fg)',
  padding: '10px 20px',
  borderRadius: 999,
  fontWeight: 600,
  fontSize: 14,
  textDecoration: 'none',
  transition: 'background 0.15s',
}

const ctaButton = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  background: 'var(--lt-cta)',
  color: 'var(--lt-cta-fg)',
  border: 'none',
  borderRadius: 14,
  padding: '0 24px',
  fontFamily: 'var(--lt-font)',
  fontSize: 15,
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'all 0.15s',
  whiteSpace: 'nowrap',
}

const pillLabel = {
  display: 'inline-block',
  background: 'var(--lt-pill)',
  color: 'var(--lt-text-2)',
  fontSize: 12,
  padding: '6px 14px',
  borderRadius: 999,
  marginBottom: 20,
  fontWeight: 500,
  letterSpacing: '0.02em',
}

const sectionHeading = {
  fontSize: 'clamp(32px, 5vw, 56px)',
  fontWeight: 900,
  letterSpacing: '-0.03em',
  lineHeight: 1.0,
  margin: 0,
}
