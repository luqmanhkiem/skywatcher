const BADGE_STYLES = {
  STALL:           { bg: 'rgba(234,88,12,0.12)',   color: '#EA580C', border: 'rgba(234,88,12,0.25)'  },
  WRONG_ROUTE:     { bg: 'rgba(220,38,38,0.12)',   color: '#DC2626', border: 'rgba(220,38,38,0.25)'  },
  SECURITY_BYPASS: { bg: 'rgba(124,58,237,0.12)',  color: '#7C3AED', border: 'rgba(124,58,237,0.25)' },
  ANOMALY:         { bg: 'rgba(245,166,35,0.14)',  color: '#B45309', border: 'rgba(245,166,35,0.3)'  },
  in_transit:      { bg: 'rgba(245,166,35,0.12)',  color: '#B45309', border: 'rgba(245,166,35,0.25)' },
  arrived:         { bg: 'rgba(22,163,74,0.12)',   color: '#16A34A', border: 'rgba(22,163,74,0.25)'  },
  default:         { bg: 'var(--surface-3)',       color: 'var(--text-2)', border: 'var(--border)'   },
}

const DISPLAY_LABELS = {
  WRONG_ROUTE:     'WRONG ROUTE',
  SECURITY_BYPASS: 'SEC BYPASS',
  in_transit:      'IN TRANSIT',
}

export default function StatusBadge({ label }) {
  const style = BADGE_STYLES[label] ?? BADGE_STYLES.default
  const text  = DISPLAY_LABELS[label] ?? label
  return (
    <span style={{
      display: 'inline-block',
      padding: '3px 8px',
      borderRadius: 5,
      border: `1px solid ${style.border}`,
      fontFamily: 'var(--font-mono)',
      fontSize: 10,
      fontWeight: 600,
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      whiteSpace: 'nowrap',
      background: style.bg,
      color: style.color,
    }}>
      {text}
    </span>
  )
}
