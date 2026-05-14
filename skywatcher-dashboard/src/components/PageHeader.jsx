export default function PageHeader({ title, subtitle, children }) {
  return (
    <div style={{
      padding: '22px 28px 20px',
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
          fontSize: 24,
          fontWeight: 700,
          letterSpacing: '-0.02em',
          color: 'var(--text)',
          lineHeight: 1.1,
        }}>
          {title}
        </h1>
        {subtitle && (
          <p style={{
            fontSize: 13,
            color: 'var(--muted)',
            marginTop: 4,
            lineHeight: 1.4,
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
