import { useIsMobile } from '../hooks/useIsMobile'

export default function PageHeader({ title, subtitle, children }) {
  const isMobile = useIsMobile()
  return (
    <div style={{
      // Mobile: leave ~58px left padding so the fixed hamburger button doesn't overlap the title
      padding: isMobile ? '16px 16px 14px 58px' : '22px 28px 20px',
      borderBottom: '1px solid var(--border)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      background: 'var(--surface)',
      position: 'sticky',
      top: 0,
      zIndex: 10,
      flexWrap: 'wrap',
    }}>
      <div style={{ minWidth: 0, flex: 1 }}>
        <h1 style={{
          fontFamily: 'var(--font-heading)',
          fontSize: isMobile ? 19 : 24,
          fontWeight: 700,
          letterSpacing: '-0.02em',
          color: 'var(--text)',
          lineHeight: 1.1,
        }}>
          {title}
        </h1>
        {subtitle && !isMobile && (
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
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {children}
        </div>
      )}
    </div>
  )
}
