export default function PageHeader({ title, subtitle, children }) {
  return (
    <div style={{
      padding: '18px 24px 16px',
      borderBottom: '1px solid var(--border)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 16,
      background: 'var(--surface)',
      position: 'sticky',
      top: 0,
      zIndex: 10,
    }}>
      <div style={{ minWidth: 0 }}>
        <h1 style={{
          fontFamily: 'var(--font-heading)',
          fontSize: 20,
          fontWeight: 700,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: 'var(--text)',
          lineHeight: 1.1,
        }}>
          {title}
        </h1>
        {subtitle && (
          <p style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--muted-2)',
            marginTop: 4,
            lineHeight: 1.4,
            letterSpacing: '0.04em',
          }}>
            {subtitle}
          </p>
        )}
      </div>
      {children && (
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          {children}
        </div>
      )}
    </div>
  )
}
