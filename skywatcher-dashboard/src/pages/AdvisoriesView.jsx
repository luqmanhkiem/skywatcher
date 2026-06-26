import { useCallback, useEffect, useState } from 'react'
import { Megaphone, Check, Clock, CheckCircle2, XCircle, Save } from 'lucide-react'
import { usePolling } from '../hooks/usePolling'
import {
  fetchAdvisories, setAdvisory, requestAdvisory,
  fetchAdvisoryRequests, approveAdvisoryRequest, rejectAdvisoryRequest,
} from '../utils/api'
import { useToast } from '../context/ToastContext'
import { useAuth  } from '../context/AuthContext'
import PageHeader   from '../components/PageHeader'

const CHECKPOINTS = ['check_in', 'security', 'sorting', 'loading', 'arrival']

const CP_LABELS = {
  check_in: 'Check-In', security: 'Security', sorting: 'Sorting',
  loading: 'Loading',   arrival: 'Arrival',
}

const LEVEL_META = {
  operational: { label: 'Operational', color: 'var(--success)'  },
  degraded:    { label: 'Degraded',    color: 'var(--warning)'  },
  down:        { label: 'Down',        color: 'var(--danger)'   },
}

const STATUS_META = {
  pending:  { label: 'Pending',  color: 'var(--accent)',  Icon: Clock        },
  approved: { label: 'Approved', color: 'var(--success)', Icon: CheckCircle2 },
  rejected: { label: 'Rejected', color: 'var(--danger)',  Icon: XCircle      },
}

function timeAgo(iso) {
  if (!iso) return ''
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60)   return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  return `${Math.floor(diff / 3600)}h ago`
}

function RequestForm({ onSubmitted }) {
  const { showToast } = useToast()
  const [cp,      setCp]      = useState('')
  const [level,   setLevel]   = useState('degraded')
  const [message, setMessage] = useState('')
  const [saving,  setSaving]  = useState(false)

  async function submit(e) {
    e.preventDefault()
    if (!cp) return
    setSaving(true)
    try {
      await requestAdvisory({ checkpoint: cp, level, message: message || undefined })
      showToast('Advisory request submitted — awaiting admin approval', 'success')
      setCp(''); setLevel('degraded'); setMessage('')
      onSubmitted()
    } catch (err) {
      showToast(err.response?.data?.error ?? 'Failed to submit request', 'anomaly')
    } finally { setSaving(false) }
  }

  const sel = {
    padding: '9px 10px', borderRadius: 8,
    border: '1px solid var(--border-2)', background: 'var(--surface-2)',
    color: 'var(--text)', fontSize: 13, cursor: 'pointer',
  }

  return (
    <form onSubmit={submit} style={{
      background: 'var(--surface)', border: '1px solid var(--border-2)',
      borderTop: '2px solid var(--accent)',
      borderRadius: 10, padding: '20px 22px',
    }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 600, color: 'var(--accent)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 14 }}>
        Request advisory change
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        <select value={cp} onChange={e => setCp(e.target.value)} style={sel} required>
          <option value="">Select checkpoint…</option>
          {CHECKPOINTS.map(c => <option key={c} value={c}>{CP_LABELS[c]}</option>)}
        </select>
        <select value={level} onChange={e => setLevel(e.target.value)} style={sel}>
          {Object.entries(LEVEL_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <input
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder="Optional message for passengers"
          style={{ flex: 1, minWidth: 200, ...sel, cursor: 'text' }}
        />
      </div>
      <button type="submit" disabled={saving || !cp} style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        background: cp ? 'var(--accent)' : 'var(--surface-3)',
        border: `1px solid ${cp ? 'var(--accent)' : 'var(--border-2)'}`,
        borderRadius: 8, padding: '9px 18px',
        fontSize: 13, fontWeight: 600,
        color: cp ? '#fff' : 'var(--muted)',
        cursor: cp && !saving ? 'pointer' : 'default',
      }}>
        <Megaphone size={13} />
        {saving ? 'Submitting…' : 'Submit request'}
      </button>
      <div style={{ marginTop: 10, fontSize: 11, color: 'var(--muted)' }}>
        Your request will be reviewed by an admin before taking effect.
      </div>
    </form>
  )
}

function CurrentStatus({ data }) {
  const rows = data?.advisories ?? []
  const byCp = Object.fromEntries(rows.map(r => [r.checkpoint, r]))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {CHECKPOINTS.map(cp => {
        const row   = byCp[cp]
        const level = row?.level ?? 'operational'
        const meta  = LEVEL_META[level]
        return (
          <div key={cp} style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderLeft: `3px solid ${meta.color}`,
            borderRadius: 10, padding: '12px 16px',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <Megaphone size={14} color={meta.color} />
            <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', flex: 1 }}>{CP_LABELS[cp]}</span>
            {row?.message && <span style={{ fontSize: 12, color: 'var(--muted)', flex: 2 }}>{row.message}</span>}
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: meta.color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {meta.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function RequestCard({ r, busy, onApprove, onReject }) {
  const levelMeta  = LEVEL_META[r.level]   ?? LEVEL_META.operational
  const statusMeta = STATUS_META[r.status] ?? STATUS_META.pending
  const { Icon }   = statusMeta
  const isPending  = r.status === 'pending'

  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderLeft: `3px solid ${levelMeta.color}`,
      borderRadius: 10, padding: '14px 18px',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: isPending ? 12 : 0 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{CP_LABELS[r.checkpoint]}</span>
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700,
              color: levelMeta.color, textTransform: 'uppercase', letterSpacing: '0.06em',
              background: `${levelMeta.color}22`, borderRadius: 4, padding: '2px 6px',
            }}>{levelMeta.label}</span>
          </div>
          {r.message && <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>{r.message}</div>}
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>
            By <strong>{r.requested_by}</strong> · {timeAgo(r.created_at)}
            {r.reviewed_by && ` · Reviewed by ${r.reviewed_by}`}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          <Icon size={13} color={statusMeta.color} />
          <span style={{ fontSize: 11, fontWeight: 600, color: statusMeta.color }}>{statusMeta.label}</span>
        </div>
      </div>
      {isPending && (
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onApprove} disabled={!!busy} style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            background: 'var(--success)', color: '#fff', border: 'none',
            borderRadius: 7, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            opacity: busy ? 0.6 : 1,
          }}>
            <Check size={13} /> {busy === `${r.id}-approve` ? 'Applying…' : 'Approve'}
          </button>
          <button onClick={onReject} disabled={!!busy} style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            background: 'var(--surface-2)', color: 'var(--danger)',
            border: '1px solid var(--danger)', borderRadius: 7,
            padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            opacity: busy ? 0.6 : 1,
          }}>
            <XCircle size={13} /> {busy === `${r.id}-reject` ? 'Rejecting…' : 'Reject'}
          </button>
        </div>
      )}
    </div>
  )
}

function ApprovalQueue({ requests, onAction }) {
  const { showToast } = useToast()
  const [busy, setBusy] = useState(null)

  async function act(id, action) {
    setBusy(`${id}-${action}`)
    try {
      if (action === 'approve') await approveAdvisoryRequest(id)
      else                       await rejectAdvisoryRequest(id)
      showToast(action === 'approve' ? 'Advisory approved and applied' : 'Request rejected', 'success')
      onAction()
    } catch (err) {
      showToast(err.response?.data?.error ?? 'Action failed', 'anomaly')
    } finally { setBusy(null) }
  }

  const pending = requests.filter(r => r.status === 'pending')
  const past    = requests.filter(r => r.status !== 'pending').slice(0, 10)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 600, color: 'var(--accent)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 4 }}>
        Pending ({pending.length})
      </div>
      {pending.length === 0
        ? <div style={{ fontSize: 13, color: 'var(--muted)', padding: '8px 0' }}>No pending requests.</div>
        : pending.map(r => <RequestCard key={r.id} r={r} busy={busy} onApprove={() => act(r.id, 'approve')} onReject={() => act(r.id, 'reject')} />)
      }
      {past.length > 0 && (
        <>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.14em', textTransform: 'uppercase', marginTop: 10 }}>
            Recent ({past.length})
          </div>
          {past.map(r => <RequestCard key={r.id} r={r} busy={null} />)}
        </>
      )}
    </div>
  )
}

// ── Admin: direct per-checkpoint editor ─────────────────────────────────────

const sel = {
  padding: '7px 10px', borderRadius: 7,
  border: '1px solid var(--border-2)', background: 'var(--surface-2)',
  color: 'var(--text)', fontSize: 12, cursor: 'pointer',
}

function AdminDirectEditRow({ cp, current, onSaved }) {
  const { showToast } = useToast()
  const [level,   setLevel]   = useState(current?.level   ?? 'operational')
  const [message, setMessage] = useState(current?.message ?? '')
  const [saving,  setSaving]  = useState(false)

  // Sync state if 'current' prop updates externally
  useEffect(() => {
    setLevel(current?.level ?? 'operational')
    setMessage(current?.message ?? '')
  }, [current])

  async function save() {
    setSaving(true)
    try {
      await setAdvisory(cp, { level, message: message || undefined })
      showToast(`${CP_LABELS[cp]} set to ${level}`, 'success')
      onSaved()
    } catch (err) {
      showToast(err.response?.data?.error ?? 'Save failed', 'anomaly')
    } finally { setSaving(false) }
  }

  const meta = LEVEL_META[level]
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderLeft: `3px solid ${meta.color}`,
      borderRadius: 10, padding: '12px 16px',
      display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
    }}>
      <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', minWidth: 80 }}>{CP_LABELS[cp]}</span>
      <select value={level} onChange={e => setLevel(e.target.value)} style={sel}>
        {Object.entries(LEVEL_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
      </select>
      <input
        value={message}
        onChange={e => setMessage(e.target.value)}
        placeholder="Optional message for passengers"
        style={{ flex: 1, minWidth: 160, ...sel, cursor: 'text' }}
      />
      <button onClick={save} disabled={saving} style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        background: 'var(--accent)', color: '#000', border: 'none',
        borderRadius: 7, padding: '7px 14px', fontSize: 12, fontWeight: 600,
        cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.6 : 1,
      }}>
        <Save size={12} /> {saving ? 'Saving…' : 'Save'}
      </button>
    </div>
  )
}

function AdminDirectEdit({ advisoryData, onSaved }) {
  const rows  = advisoryData?.advisories ?? []
  const byCp  = Object.fromEntries(rows.map(r => [r.checkpoint, r]))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {CHECKPOINTS.map(cp => <AdminDirectEditRow key={cp} cp={cp} current={byCp[cp]} onSaved={onSaved} />)}
    </div>
  )
}

export default function AdvisoriesView() {
  const { user } = useAuth()
  const isAdmin  = user?.role === 'admin'

  const advisoriesFn = useCallback(() => fetchAdvisories(true), [])
  const { data: advisoryData, refresh: refreshAdvisories } = usePolling(advisoriesFn, 5000)

  const [requests, setRequests] = useState([])
  const loadRequests = useCallback(async () => {
    try {
      const d = await fetchAdvisoryRequests()
      setRequests(d.requests ?? [])
    } catch (_) {}
  }, [])

  useEffect(() => { loadRequests() }, [loadRequests])

  function onAction() { loadRequests(); refreshAdvisories() }

  return (
    <div>
      <PageHeader
        title="Checkpoint status"
        subtitle={
          isAdmin
            ? 'Edit checkpoint advisories directly and review staff requests.'
            : 'View checkpoint status and request advisory changes.'
        }
      />
      <div style={{ padding: '20px 28px', display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 860 }}>

        {/* ── Admin: direct edit ── */}
        {isAdmin && (
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 600, color: 'var(--accent)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 12 }}>
              Edit checkpoint status
            </div>
            <AdminDirectEdit advisoryData={advisoryData} onSaved={onAction} />
          </div>
        )}

        {/* ── Staff: request form ── */}
        {!isAdmin && <RequestForm onSubmitted={onAction} />}

        {/* ── Staff: current status read-only ── */}
        {!isAdmin && (
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 12 }}>
              Current status
            </div>
            <CurrentStatus data={advisoryData} />
          </div>
        )}

        {/* ── Admin: approval queue ── */}
        {isAdmin && (
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 12 }}>
              Staff advisory requests
            </div>
            <ApprovalQueue requests={requests} onAction={onAction} />
          </div>
        )}
      </div>
    </div>
  )
}
