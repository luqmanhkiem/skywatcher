import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Inbox, Mail, Plane, Tag, Clock, CheckCircle2, Loader, User, ExternalLink,
} from 'lucide-react'
import { usePolling }   from '../hooks/usePolling'
import { fetchFeedback, updateFeedback } from '../utils/api'
import { useToast }     from '../context/ToastContext'
import { useIsMobile }  from '../hooks/useIsMobile'
import PageHeader       from '../components/PageHeader'

const CATEGORY_META = {
  lost_bag:    { label: 'Lost bag',    color: '#FF3355' },
  damaged_bag: { label: 'Damaged bag', color: '#FF7A2F' },
  delayed_bag: { label: 'Delayed bag', color: '#F5A623' },
  complaint:   { label: 'Complaint',   color: '#A78BFA' },
  suggestion:  { label: 'Suggestion',  color: '#38BDF8' },
  other:       { label: 'Other',       color: '#94A3B8' },
}

const STATUS_META = {
  new:       { label: 'New',       color: '#FF3355', dim: 'rgba(255,51,85,0.12)' },
  in_review: { label: 'In Review', color: '#F5A623', dim: 'rgba(245,166,35,0.12)' },
  resolved:  { label: 'Resolved',  color: '#00CC7D', dim: 'rgba(0,204,125,0.12)' },
}

const FILTERS = ['All', 'new', 'in_review', 'resolved']

function parseISO(iso) {
  if (!iso) return null
  return new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z')
}

function timeAgo(iso) {
  const d = parseISO(iso)
  if (!d) return '—'
  const diff = Math.floor((Date.now() - d.getTime()) / 1000)
  if (diff < 60)    return `${diff}s ago`
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

export default function FeedbackInbox() {
  const { showToast } = useToast()
  const isMobile = useIsMobile()
  const fn = useCallback(() => fetchFeedback(200), [])
  const { data, loading, refresh } = usePolling(fn, 5000)

  const tickets = data?.feedback ?? []
  const counts  = data?.counts   ?? { new: 0, in_review: 0, resolved: 0 }

  const [filter, setFilter]       = useState('All')
  const [selectedId, setSelected] = useState(null)
  const [notes, setNotes]         = useState('')
  const [savingNotes, setSaving]  = useState(false)

  const filtered = tickets.filter(t => filter === 'All' || t.status === filter)
  const selected = tickets.find(t => t.id === selectedId) ?? null

  // Keep the notes textarea in sync when switching tickets
  useEffect(() => {
    setNotes(selected?.staff_notes ?? '')
  }, [selectedId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function setStatus(ticket, status) {
    try {
      await updateFeedback(ticket.id, { status })
      showToast(`Ticket #${ticket.id} → ${STATUS_META[status].label}`, 'success')
      await refresh()
    } catch (err) {
      showToast(err.response?.data?.error ?? 'Failed to update ticket', 'anomaly')
    }
  }

  async function saveNotes(ticket) {
    setSaving(true)
    try {
      await updateFeedback(ticket.id, { staff_notes: notes })
      showToast('Notes saved', 'success')
      await refresh()
    } catch (err) {
      showToast(err.response?.data?.error ?? 'Failed to save notes', 'anomaly')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Customer Support"
        subtitle="Passenger feedback and issue reports"
      >
        <div style={{ display: 'flex', gap: 8 }}>
          <Stat label="New"       value={counts.new}       color={STATUS_META.new.color} />
          <Stat label="In review" value={counts.in_review} color={STATUS_META.in_review.color} />
          <Stat label="Resolved"  value={counts.resolved}  color={STATUS_META.resolved.color} />
        </div>
      </PageHeader>

      <div style={{ padding: isMobile ? '14px 14px 80px' : 24 }}>
        {/* Filters */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {FILTERS.map(f => {
            const active = filter === f
            const label = f === 'All' ? 'All' : STATUS_META[f].label
            return (
              <button key={f} onClick={() => setFilter(f)} style={{
                padding: '6px 14px', borderRadius: 999,
                border: active ? '1px solid var(--accent)' : '1px solid var(--border-2)',
                background: active ? 'var(--surface-3)' : 'transparent',
                color: active ? 'var(--text)' : 'var(--text-2)',
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
                fontFamily: 'var(--font-body)',
              }}>{label}</button>
            )
          })}
        </div>

        {loading && tickets.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{
            padding: '60px 20px', textAlign: 'center', color: 'var(--muted)',
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 13,
          }}>
            <Inbox size={32} style={{ opacity: 0.4, marginBottom: 10 }} />
            <div style={{ fontSize: 14 }}>No tickets {filter !== 'All' ? `in “${STATUS_META[filter].label}”` : 'yet'}.</div>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : '380px 1fr',
            gap: 16,
            alignItems: 'start',
          }}>
            {/* Ticket list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filtered.map(t => {
                const cat = CATEGORY_META[t.category] ?? CATEGORY_META.other
                const st  = STATUS_META[t.status]     ?? STATUS_META.new
                const isSel = t.id === selectedId
                return (
                  <button key={t.id} onClick={() => setSelected(t.id)} style={{
                    textAlign: 'left',
                    background: isSel ? 'var(--surface-3)' : 'var(--surface)',
                    border: `1px solid ${isSel ? 'var(--accent)' : 'var(--border)'}`,
                    borderLeft: `3px solid ${cat.color}`,
                    borderRadius: 10,
                    padding: '12px 14px',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-body)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 5 }}>
                      <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>{t.name}</span>
                      <StatusChip status={t.status} />
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 6, lineHeight: 1.4,
                      display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {t.message}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--muted)' }}>
                      <span style={{ color: cat.color, fontWeight: 600 }}>{cat.label}</span>
                      <span>·</span>
                      <span>{timeAgo(t.created_at)}</span>
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Detail panel */}
            {selected ? (
              <TicketDetail
                ticket={selected}
                notes={notes}
                setNotes={setNotes}
                savingNotes={savingNotes}
                onSaveNotes={() => saveNotes(selected)}
                onSetStatus={status => setStatus(selected, status)}
                onReply={() => { if (selected.status === 'new') setStatus(selected, 'in_review') }}
                isMobile={isMobile}
              />
            ) : !isMobile && (
              <div style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 13, padding: '60px 20px', textAlign: 'center', color: 'var(--muted)',
              }}>
                <Mail size={28} style={{ opacity: 0.4, marginBottom: 10 }} />
                <div style={{ fontSize: 14 }}>Select a ticket to view details and take action.</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function TicketDetail({ ticket, notes, setNotes, savingNotes, onSaveNotes, onSetStatus, onReply, isMobile }) {
  const cat = CATEGORY_META[ticket.category] ?? CATEGORY_META.other

  // Pre-filled reply template - opens the OS mail app (Mail.app on macOS) via mailto:
  const mailSubject = `Re: Your SkyWatcher report #${ticket.id} — ${cat.label}`
  const mailBody = [
    `Dear ${ticket.name},`,
    ``,
    `Thank you for contacting SkyWatcher support regarding your ${cat.label.toLowerCase()}.`,
    ticket.flight_id ? `Flight: ${ticket.flight_id}` : null,
    ticket.tag_id    ? `Bag tag: ${ticket.tag_id}` : null,
    `Reference: Ticket #${ticket.id}`,
    ``,
    `We have reviewed your report and `,
    ``,
    `If you have any further questions, simply reply to this email.`,
    ``,
    `Best regards,`,
    `SkyWatcher Ground Team`,
  ].filter(v => v !== null).join('\n')
  const mailtoUrl = `mailto:${ticket.email}?subject=${encodeURIComponent(mailSubject)}&body=${encodeURIComponent(mailBody)}`

  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 13, padding: isMobile ? 16 : 24,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 18 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>{ticket.name}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)' }}>#{ticket.id}</span>
          </div>
          <span style={{
            display: 'inline-block', padding: '3px 10px', borderRadius: 999,
            background: `${cat.color}1A`, color: cat.color, fontSize: 12, fontWeight: 600,
          }}>{cat.label}</span>
        </div>
        <StatusChip status={ticket.status} />
      </div>

      {/* Contact + references */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 18 }}>
        {ticket.email     && <MetaRow Icon={Mail}  text={ticket.email} />}
        {ticket.flight_id && <MetaRow Icon={Plane} text={ticket.flight_id} mono />}
        {ticket.tag_id    && (
          <Link to={`/bags?tag=${encodeURIComponent(ticket.tag_id)}`} style={{ textDecoration: 'none' }}>
            <MetaRow Icon={Tag} text={ticket.tag_id} mono link />
          </Link>
        )}
        <MetaRow Icon={Clock} text={timeAgo(ticket.created_at)} />
      </div>

      {/* Message */}
      <div style={{
        background: 'var(--surface-2)', border: '1px solid var(--border)',
        borderRadius: 10, padding: '14px 16px', marginBottom: 20,
        fontSize: 14, color: 'var(--text)', lineHeight: 1.55, whiteSpace: 'pre-wrap',
      }}>
        {ticket.message}
      </div>

      {/* Reply by email */}
      <div style={{ marginBottom: 20 }}>
        <Label>Respond to passenger</Label>
        {ticket.email ? (
          <a
            href={mailtoUrl}
            onClick={onReply}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              background: 'var(--accent)', color: '#000',
              borderRadius: 8, padding: '9px 16px',
              fontSize: 13, fontWeight: 600, textDecoration: 'none',
              fontFamily: 'var(--font-body)',
            }}
          >
            <Mail size={14} /> Reply by email
          </a>
        ) : (
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>
            No email was provided — this passenger can't be emailed back.
          </div>
        )}
      </div>

      {/* Status workflow */}
      <div style={{ marginBottom: 20 }}>
        <Label>Update status</Label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {['new', 'in_review', 'resolved'].map(s => {
            const meta = STATUS_META[s]
            const active = ticket.status === s
            const Icon = s === 'resolved' ? CheckCircle2 : s === 'in_review' ? Loader : Inbox
            return (
              <button key={s} onClick={() => onSetStatus(s)} disabled={active} style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '8px 14px', borderRadius: 8,
                border: `1px solid ${active ? meta.color : 'var(--border-2)'}`,
                background: active ? meta.dim : 'transparent',
                color: active ? meta.color : 'var(--text-2)',
                fontSize: 13, fontWeight: 600,
                cursor: active ? 'default' : 'pointer',
                fontFamily: 'var(--font-body)',
              }}>
                <Icon size={13} /> {meta.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Staff notes */}
      <div>
        <Label>Internal notes</Label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Record the action taken — e.g. contacted passenger, bag located at sorting, refund issued…"
          rows={4}
          style={{
            width: '100%', boxSizing: 'border-box',
            background: 'var(--surface-2)', border: '1px solid var(--border)',
            borderRadius: 10, padding: '11px 14px',
            fontSize: 14, color: 'var(--text)', outline: 'none',
            fontFamily: 'var(--font-body)', resize: 'vertical', lineHeight: 1.5,
          }}
        />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, gap: 12 }}>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>
            {ticket.resolved_by && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <User size={12} /> Resolved by {ticket.resolved_by}
              </span>
            )}
          </div>
          <button onClick={onSaveNotes} disabled={savingNotes} style={{
            background: 'var(--accent)', color: '#000', border: 'none',
            borderRadius: 8, padding: '9px 18px',
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
            fontFamily: 'var(--font-body)', opacity: savingNotes ? 0.6 : 1,
          }}>
            {savingNotes ? 'Saving…' : 'Save notes'}
          </button>
        </div>
      </div>
    </div>
  )
}

function StatusChip({ status }) {
  const s = STATUS_META[status] ?? STATUS_META.new
  return (
    <span style={{
      fontFamily: 'var(--font-mono)', padding: '3px 9px', borderRadius: 5,
      fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
      background: s.dim, color: s.color, whiteSpace: 'nowrap',
    }}>{s.label}</span>
  )
}

function MetaRow({ Icon, text, mono, link }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      fontSize: 13, color: link ? 'var(--accent)' : 'var(--text-2)',
      fontFamily: mono ? 'var(--font-mono)' : 'var(--font-body)',
    }}>
      <Icon size={13} /> {text}
      {link && <ExternalLink size={11} />}
    </div>
  )
}

function Label({ children }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 600, color: 'var(--muted)',
      letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 9,
    }}>{children}</div>
  )
}

function Stat({ label, value, color }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 7,
      background: 'var(--surface-2)', border: '1px solid var(--border)',
      borderRadius: 8, padding: '5px 12px',
    }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: color }} />
      <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500 }}>{label}</span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{value}</span>
    </div>
  )
}
