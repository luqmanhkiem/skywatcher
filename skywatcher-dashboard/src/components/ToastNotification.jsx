import { X, AlertTriangle, AlertCircle, Info, CheckCircle } from 'lucide-react'
import { useToast } from '../context/ToastContext'

const TYPE_META = {
  anomaly: { icon: AlertTriangle, color: '#DC2626', bg: 'rgba(220,38,38,0.10)',  border: 'rgba(220,38,38,0.30)', label: 'Anomaly detected' },
  warning: { icon: AlertCircle,   color: '#EA580C', bg: 'rgba(234,88,12,0.10)',  border: 'rgba(234,88,12,0.30)', label: 'Warning' },
  success: { icon: CheckCircle,   color: '#16A34A', bg: 'rgba(22,163,74,0.10)',  border: 'rgba(22,163,74,0.30)', label: 'Success' },
  info:    { icon: Info,          color: '#3D5AFE', bg: 'rgba(61,90,254,0.10)',  border: 'rgba(61,90,254,0.30)', label: 'Info' },
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
      boxShadow: `0 10px 32px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)`,
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
        <div style={{ fontSize: 11, fontWeight: 700, color: meta.color, marginBottom: 3, letterSpacing: '0.02em', textTransform: 'uppercase' }}>
          {meta.label}
        </div>
        <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.45, wordBreak: 'break-word' }}>
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
