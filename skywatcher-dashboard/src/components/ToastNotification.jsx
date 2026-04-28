import { X, AlertTriangle, AlertCircle, Info, CheckCircle } from 'lucide-react'
import { useToast } from '../context/ToastContext'

const TYPE_META = {
  anomaly: { icon: AlertTriangle, color: '#FF3355', bg: 'rgba(255,51,85,0.12)',   border: 'rgba(255,51,85,0.35)',   label: 'ANOMALY DETECTED' },
  warning: { icon: AlertCircle,   color: '#FF7A2F', bg: 'rgba(255,122,47,0.12)', border: 'rgba(255,122,47,0.35)', label: 'WARNING' },
  success: { icon: CheckCircle,   color: '#00CC7D', bg: 'rgba(0,204,125,0.12)',  border: 'rgba(0,204,125,0.35)',  label: 'SUCCESS' },
  info:    { icon: Info,          color: '#F5A623', bg: 'rgba(245,166,35,0.12)', border: 'rgba(245,166,35,0.35)', label: 'INFO' },
}

function Toast({ toast, onDismiss }) {
  const meta = TYPE_META[toast.type] ?? TYPE_META.info
  const Icon = meta.icon

  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: 12,
      background: 'var(--surface)',
      border: `1px solid ${meta.border}`,
      borderTop: `2px solid ${meta.color}`,
      borderRadius: 10,
      padding: '12px 14px',
      boxShadow: `0 12px 40px rgba(0,0,0,0.6), 0 0 20px ${meta.color}20`,
      minWidth: 280,
      maxWidth: 360,
      opacity: toast.removing ? 0 : 1,
      transform: toast.removing ? 'translateX(20px)' : 'translateX(0)',
      transition: 'opacity 0.3s ease, transform 0.3s ease',
      pointerEvents: toast.removing ? 'none' : 'auto',
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
        background: meta.bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={15} color={meta.color} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, color: meta.color, marginBottom: 3, letterSpacing: '0.1em' }}>
          {meta.label}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.45, wordBreak: 'break-word' }}>
          {toast.message}
        </div>
      </div>

      <button
        onClick={() => onDismiss(toast.id)}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--muted)',
          padding: 2,
          flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <X size={13} />
      </button>
    </div>
  )
}

export function ToastContainer() {
  const { toasts, dismissToast } = useToast()

  if (toasts.length === 0) return null

  return (
    <div style={{
      position: 'fixed',
      top: 20,
      right: 20,
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
    }}>
      {toasts.map(toast => (
        <Toast key={toast.id} toast={toast} onDismiss={dismissToast} />
      ))}
    </div>
  )
}
