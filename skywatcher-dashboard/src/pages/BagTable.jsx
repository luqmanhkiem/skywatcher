import { useCallback, useState } from 'react'
import { Search, ChevronRight, Inbox } from 'lucide-react'
import { usePolling }       from '../hooks/usePolling'
import { fetchBags }        from '../utils/api'
import PageHeader           from '../components/PageHeader'
import StatusBadge          from '../components/StatusBadge'
import BagHistoryModal      from '../components/BagHistoryModal'

const CP_LABELS = {
  check_in: 'Check-In',
  security: 'Security',
  sorting:  'Sorting',
  loading:  'Loading',
  arrival:  'Arrival',
}

const CP_COLORS = {
  check_in: '#38BDF8',
  security: '#F5A623',
  sorting:  '#A78BFA',
  loading:  '#F97316',
  arrival:  '#00CC7D',
}

function parseISO(iso) {
  if (!iso) return null
  return new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z')
}

function fmtTime(iso) {
  const d = parseISO(iso)
  return d ? d.toLocaleTimeString() : '—'
}

function timeAgo(iso) {
  const d = parseISO(iso)
  if (!d) return '—'
  const diff = Math.floor((Date.now() - d.getTime()) / 1000)
  if (diff < 60)   return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  return `${Math.floor(diff / 3600)}h ago`
}

const COLUMNS = [
  { key: 'tag_id',          label: 'Tag ID'          },
  { key: 'passenger',       label: 'Passenger'       },
  { key: 'flight_id',       label: 'Flight'          },
  { key: 'last_checkpoint', label: 'Last Checkpoint' },
  { key: 'status',          label: 'Status'          },
  { key: 'last_seen',       label: 'Last Seen'       },
  { key: '_action',         label: ''                },
]

function SkeletonRow() {
  return (
    <tr style={{ borderBottom: '1px solid var(--border)' }}>
      <td style={{ padding: '11px 14px' }}><div className="skeleton" style={{ height: 13, width: 90 }} /></td>
      <td style={{ padding: '11px 14px' }}><div className="skeleton" style={{ height: 13, width: 120 }} /></td>
      <td style={{ padding: '11px 14px' }}><div className="skeleton" style={{ height: 13, width: 60 }} /></td>
      <td style={{ padding: '11px 14px' }}><div className="skeleton" style={{ height: 13, width: 80 }} /></td>
      <td style={{ padding: '11px 14px' }}><div className="skeleton" style={{ height: 18, width: 72, borderRadius: 4 }} /></td>
      <td style={{ padding: '11px 14px' }}><div className="skeleton" style={{ height: 13, width: 55 }} /></td>
      <td style={{ padding: '11px 14px' }} />
    </tr>
  )
}

export default function BagTable() {
  const [query, setQuery]     = useState('')
  const [selected, setSelected] = useState(null)
  const fn = useCallback(() => fetchBags(), [])
  const { data, loading, error } = usePolling(fn, 3000)

  const q = query.toLowerCase()
  const bags = (data?.bags ?? []).filter(b =>
    b.tag_id.toLowerCase().includes(q) ||
    (b.passenger  || '').toLowerCase().includes(q) ||
    (b.flight_id  || '').toLowerCase().includes(q) ||
    (b.status     || '').toLowerCase().includes(q)
  )

  return (
    <div className="animate-fade-up">

      {/* ── Header ────────────────────────────────────────── */}
      <PageHeader
        title="All Bags"
        subtitle={`${data?.count ?? 0} bag${(data?.count ?? 0) !== 1 ? 's' : ''} in system`}
      >
        <div style={{ position: 'relative' }}>
          <Search
            size={13}
            style={{
              position: 'absolute', left: 10,
              top: '50%', transform: 'translateY(-50%)',
              color: 'var(--muted)', pointerEvents: 'none',
            }}
          />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search tag, passenger, flight…"
            style={{
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '7px 12px 7px 30px',
              color: 'var(--text)',
              fontSize: 13,
              width: 240,
              outline: 'none',
              transition: 'border-color 0.15s',
            }}
            onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent)' }}
            onBlur={e  => { e.currentTarget.style.borderColor = 'var(--border)'  }}
          />
        </div>
      </PageHeader>

      {/* ── Offline banner ─────────────────────────────── */}
      {error && !loading && (
        <div style={{
          margin: '0 24px',
          padding: '10px 16px',
          background: 'rgba(239,68,68,0.08)',
          border: '1px solid rgba(239,68,68,0.25)',
          borderRadius: 9,
          fontSize: 12,
          color: 'var(--danger)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span>⚠</span> Cannot reach backend — showing last known data
        </div>
      )}

      {/* ── Table ─────────────────────────────────────────── */}
      <div style={{ padding: '20px 24px' }}>
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          overflow: 'hidden',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {COLUMNS.map(c => (
                  <th
                    key={c.key}
                    style={{
                      padding: '10px 14px',
                      textAlign: 'left',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 9,
                      fontWeight: 600,
                      color: 'var(--muted)',
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                      background: 'var(--surface-2)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {loading && [1,2,3,4,5,6].map(i => <SkeletonRow key={i} />)}

              {!loading && bags.length === 0 && (
                <tr>
                  <td colSpan={COLUMNS.length} style={{ padding: '56px 0' }}>
                    <div style={{ textAlign: 'center', color: 'var(--muted)' }}>
                      <Inbox size={32} style={{ marginBottom: 12, opacity: 0.4 }} />
                      <p style={{ fontSize: 14 }}>
                        {query ? `No bags match "${query}"` : 'No bags yet — start the RFID simulator.'}
                      </p>
                      {query && (
                        <button
                          onClick={() => setQuery('')}
                          style={{
                            marginTop: 10, background: 'transparent', border: 'none',
                            color: 'var(--accent)', fontSize: 13, cursor: 'pointer',
                          }}
                        >
                          Clear search
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}

              {bags.map((bag, i) => {
                const cpColor = CP_COLORS[bag.last_checkpoint] ?? 'var(--muted)'
                return (
                  <tr
                    key={bag.tag_id}
                    onClick={() => setSelected(bag)}
                    style={{
                      borderBottom: '1px solid var(--border)',
                      background: i % 2 === 1 ? 'rgba(0,0,0,0.025)' : 'transparent',
                      cursor: 'pointer',
                      transition: 'background 0.12s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(245,166,35,0.05)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = i % 2 === 1 ? 'rgba(0,0,0,0.025)' : 'transparent' }}
                  >
                    <td style={{ padding: '11px 14px' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 11, color: 'var(--accent)', letterSpacing: '0.04em' }}>
                        {bag.tag_id}
                      </span>
                    </td>
                    <td style={{ padding: '11px 14px', color: 'var(--text-2)', fontSize: 13 }}>
                      {bag.passenger || <span style={{ color: 'var(--muted)' }}>—</span>}
                    </td>
                    <td style={{ padding: '11px 14px' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--success)', fontWeight: 600, fontSize: 11, letterSpacing: '0.04em' }}>
                        {bag.flight_id}
                      </span>
                    </td>
                    <td style={{ padding: '11px 14px' }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        fontSize: 12, color: cpColor,
                      }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: cpColor, flexShrink: 0 }} />
                        {CP_LABELS[bag.last_checkpoint] ?? bag.last_checkpoint ?? '—'}
                      </span>
                    </td>
                    <td style={{ padding: '11px 14px' }}>
                      <StatusBadge label={bag.status} />
                    </td>
                    <td style={{ padding: '11px 14px', color: 'var(--muted-2)', fontSize: 12 }}>
                      <span title={fmtTime(bag.last_seen)}>{timeAgo(bag.last_seen)}</span>
                    </td>
                    <td style={{ padding: '11px 14px', textAlign: 'right' }}>
                      <ChevronRight size={14} color="var(--muted)" />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Row count */}
        {!loading && bags.length > 0 && (
          <div style={{ marginTop: 8, fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--muted)', textAlign: 'right', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            {bags.length}/{data?.count ?? bags.length} records shown
            {query && <span> · FILTER: "{query}"</span>}
          </div>
        )}
      </div>

      {/* ── Bag History Modal ─────────────────────────────── */}
      {selected && (
        <BagHistoryModal
          tagId={selected.tag_id}
          passenger={selected.passenger}
          flightId={selected.flight_id}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}
