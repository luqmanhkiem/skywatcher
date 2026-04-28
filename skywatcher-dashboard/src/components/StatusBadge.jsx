const BADGE_STYLES = {
  STALL:           { bg: 'rgba(255,122,47,0.12)',  color: '#FF7A2F', border: 'rgba(255,122,47,0.3)'   },
  WRONG_ROUTE:     { bg: 'rgba(255,51,85,0.12)',   color: '#FF3355', border: 'rgba(255,51,85,0.3)'    },
  SECURITY_BYPASS: { bg: 'rgba(167,139,250,0.12)', color: '#A78BFA', border: 'rgba(167,139,250,0.3)'  },
  ANOMALY:         { bg: 'rgba(245,166,35,0.12)',  color: '#F5A623', border: 'rgba(245,166,35,0.3)'   },
  in_transit:      { bg: 'rgba(245,166,35,0.10)',  color: '#F5A623', border: 'rgba(245,166,35,0.25)'  },
  arrived:         { bg: 'rgba(0,204,125,0.10)',   color: '#00CC7D', border: 'rgba(0,204,125,0.25)'   },
  default:         { bg: 'rgba(255,255,255,0.04)', color: '#4B84A0', border: 'rgba(255,255,255,0.08)' },
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
      padding: '2px 7px',
      borderRadius: 4,
      border: `1px solid ${style.border}`,
      fontFamily: 'var(--font-mono)',
      fontSize: 9,
      fontWeight: 600,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      whiteSpace: 'nowrap',
      background: style.bg,
      color: style.color,
    }}>
      {text}
    </span>
  )
}
