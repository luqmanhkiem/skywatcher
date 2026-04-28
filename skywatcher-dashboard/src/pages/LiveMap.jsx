import { useCallback, useState } from 'react'
import { ArrowRight, WifiOff, Activity } from 'lucide-react'
import { usePolling }  from '../hooks/usePolling'
import { fetchBags }   from '../utils/api'
import PageHeader      from '../components/PageHeader'
import StatusBadge     from '../components/StatusBadge'

const CHECKPOINTS = ['check_in', 'security', 'sorting', 'loading', 'arrival']

const CP_META = {
  check_in: { label: 'Check-In',  color: '#38BDF8' },
  security: { label: 'Security',  color: '#F5A623' },
  sorting:  { label: 'Sorting',   color: '#A78BFA' },
  loading:  { label: 'Loading',   color: '#F97316' },
  arrival:  { label: 'Arrival',   color: '#00CC7D' },
}

function parseISO(iso) {
  if (!iso) return null
  return new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z')
}

function timeAgo(iso) {
  const d = parseISO(iso)
  if (!d) return '—'
  const diff = Math.floor((Date.now() - d.getTime()) / 1000)
  if (diff < 60)   return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  return `${Math.floor(diff / 3600)}h ago`
}

function Dot({ bag, color, isActive, onEnter, onLeave }) {
  const isAnomaly = bag.status !== 'arrived' && bag.status !== 'in_transit'
  return (
    <div
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      role="button"
      tabIndex={0}
      aria-label={`${bag.tag_id} — ${bag.passenger}`}
      title={`${bag.tag_id} · ${bag.passenger || 'Unknown'}`}
      style={{
        width: 28, height: 28,
        borderRadius: '50%',
        background: bag.status === 'arrived' ? '#22c55e' : color,
        border: isActive
          ? `2px solid #fff`
          : isAnomaly
            ? `2px solid #ef4444`
            : '2px solid transparent',
        boxShadow: isActive
          ? `0 0 0 3px ${color}40, 0 4px 12px ${color}30`
          : isAnomaly
            ? '0 0 0 3px rgba(239,68,68,0.25)'
            : 'none',
        cursor: 'pointer',
        transform: isActive ? 'scale(1.3)' : 'scale(1)',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease',
        flexShrink: 0,
        position: 'relative',
      }}
    />
  )
}

function SummaryStat({ value, label, color }) {
  return (
    <div style={{
      background: 'var(--surface-2)',
      border: '1px solid var(--border)',
      borderTop: `2px solid ${color ?? 'var(--border-2)'}`,
      borderRadius: 8,
      padding: '12px 18px',
      minWidth: 110,
    }}>
      <div style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 24,
        fontWeight: 600,
        color: color ?? 'var(--text)',
        lineHeight: 1,
        textShadow: color ? `0 0 16px ${color}50` : 'none',
      }}>
        {value}
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--muted-2)', marginTop: 5, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label}</div>
    </div>
  )
}

export default function LiveMap() {
  const fn = useCallback(() => fetchBags(), [])
  const { data, loading, error } = usePolling(fn, 3000)
  const [hovered, setHovered] = useState(null)

  const bags    = data?.bags ?? []
  const grouped = CHECKPOINTS.reduce((acc, cp) => {
    acc[cp] = bags.filter(b => b.last_checkpoint === cp)
    return acc
  }, {})

  const inTransit  = bags.filter(b => b.status === 'in_transit').length
  const arrived    = bags.filter(b => b.status === 'arrived').length
  const anomalies  = bags.filter(b => b.status !== 'arrived' && b.status !== 'in_transit').length

  const isLive = !loading && !error

  return (
    <div className="animate-fade-up">

      {/* ── Header ────────────────────────────────────────── */}
      <PageHeader
        title="Live Baggage Map"
        subtitle={`${bags.length} tag${bags.length !== 1 ? 's' : ''} tracked · polling 3s`}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <div style={{
            width: 7, height: 7, borderRadius: '50%',
            background: error ? 'var(--danger)' : loading ? 'var(--muted)' : 'var(--accent)',
            flexShrink: 0,
          }}
          className={isLive ? 'live-dot' : ''}
          />
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: error ? 'var(--danger)' : isLive ? 'var(--accent)' : 'var(--muted-2)',
          }}>
            {error ? 'SIGNAL LOST' : loading ? 'CONNECTING' : 'RADAR LIVE'}
          </span>
        </div>
      </PageHeader>

      {/* ── Error banner ──────────────────────────────────── */}
      {error && (
        <div style={{
          margin: '14px 24px 0',
          padding: '11px 16px',
          background: 'var(--danger-dim)',
          border: '1px solid rgba(239,68,68,0.25)',
          borderRadius: 9,
          color: 'var(--danger)',
          fontSize: 13,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <WifiOff size={15} />
          <span>Cannot reach Flask backend. Make sure <code style={{ background: 'rgba(239,68,68,0.1)', borderRadius: 3, padding: '1px 5px' }}>python app.py</code> is running.</span>
        </div>
      )}

      {/* ── Summary strip ─────────────────────────────────── */}
      <div style={{ padding: '18px 24px 0', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {loading ? (
          [1,2,3,4].map(i => (
            <div key={i} className="skeleton" style={{ height: 62, width: 120, borderRadius: 10 }} />
          ))
        ) : (
          <>
            <SummaryStat value={bags.length}  label="Total Bags"   />
            <SummaryStat value={inTransit}    label="In Transit"   color="var(--accent)"  />
            <SummaryStat value={arrived}      label="Arrived"      color="var(--success)" />
            {anomalies > 0 && (
              <SummaryStat value={anomalies}  label="Anomalies"    color="var(--danger)"  />
            )}
          </>
        )}
      </div>

      {/* ── Pipeline grid ─────────────────────────────────── */}
      <div style={{ padding: '16px 24px 0', display: 'flex', alignItems: 'stretch', gap: 0 }}>
        {CHECKPOINTS.map((cp, idx) => {
          const { label, color } = CP_META[cp]
          const bgs = grouped[cp]
          const isLast = idx === CHECKPOINTS.length - 1

          return (
            <div key={cp} style={{ flex: 1, display: 'flex', alignItems: 'stretch', minWidth: 0 }}>
              {/* Column card */}
              <div style={{
                flex: 1,
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: idx === 0 ? '12px 0 0 12px' : idx === CHECKPOINTS.length - 1 ? '0 12px 12px 0' : 0,
                borderLeft: idx === 0 ? undefined : 'none',
                minHeight: 380,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}>
                {/* Column header */}
                <div style={{
                  padding: '11px 13px',
                  borderBottom: `2px solid ${color}`,
                  background: color + '0d',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)' }}>
                    {label}
                  </span>
                  <span style={{
                    background: color + '25',
                    color: color,
                    fontSize: 11, fontWeight: 700,
                    borderRadius: 8, padding: '1px 7px',
                    minWidth: 20, textAlign: 'center',
                  }}>
                    {bgs.length}
                  </span>
                </div>

                {/* Dots area */}
                <div style={{
                  flex: 1,
                  padding: 12,
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 7,
                  alignContent: 'flex-start',
                }}>
                  {loading && bgs.length === 0 && (
                    [1,2,3].map(i => (
                      <div key={i} className="skeleton" style={{ width: 28, height: 28, borderRadius: '50%' }} />
                    ))
                  )}
                  {!loading && bgs.length === 0 && (
                    <p style={{ fontSize: 11, color: 'var(--muted)', width: '100%', textAlign: 'center', paddingTop: 48, lineHeight: 1.5 }}>
                      No bags
                    </p>
                  )}
                  {bgs.map(bag => (
                    <Dot
                      key={bag.tag_id}
                      bag={bag}
                      color={color}
                      isActive={hovered?.tag_id === bag.tag_id}
                      onEnter={() => setHovered(bag)}
                      onLeave={() => setHovered(null)}
                    />
                  ))}
                </div>
              </div>

              {/* Arrow connector */}
              {!isLast && (
                <div style={{
                  width: 28, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--border-2)',
                  marginTop: 0,
                  background: 'transparent',
                  zIndex: 1,
                }}>
                  <ArrowRight size={16} strokeWidth={1.5} />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ── Hover detail card ─────────────────────────────── */}
      <div style={{
        margin: '14px 24px 0',
        background: 'var(--surface)',
        border: `1px solid ${hovered ? 'var(--border-2)' : 'var(--border)'}`,
        borderRadius: 11,
        padding: hovered ? '14px 20px' : '0 20px',
        minHeight: hovered ? 'auto' : 52,
        transition: 'padding 0.15s ease, border-color 0.15s ease',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
      }}>
        {hovered ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 22, flexWrap: 'wrap', width: '100%' }}>
            <InfoCell label="Tag ID">
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 12, color: 'var(--accent)' }}>{hovered.tag_id}</span>
            </InfoCell>
            <InfoCell label="Passenger">
              {hovered.passenger || <span style={{ color: 'var(--muted)' }}>—</span>}
            </InfoCell>
            <InfoCell label="Flight">
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--success)', fontWeight: 600, fontSize: 12 }}>{hovered.flight_id}</span>
            </InfoCell>
            <InfoCell label="Checkpoint">
              {CP_META[hovered.last_checkpoint]?.label ?? hovered.last_checkpoint}
            </InfoCell>
            <InfoCell label="Status">
              <StatusBadge label={hovered.status} />
            </InfoCell>
            <InfoCell label="Last Seen">
              <span style={{ color: 'var(--muted-2)' }}>{timeAgo(hovered.last_seen)}</span>
            </InfoCell>
          </div>
        ) : (
          <p style={{ fontSize: 12, color: 'var(--muted)', width: '100%', textAlign: 'center' }}>
            {bags.length > 0 ? 'Hover a dot to inspect a bag' : ''}
          </p>
        )}
      </div>

      {/* ── Legend ────────────────────────────────────────── */}
      <div style={{ padding: '12px 24px 24px', display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Legend</span>
        {CHECKPOINTS.map(cp => (
          <div key={cp} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: CP_META[cp].color, boxShadow: `0 0 6px ${CP_META[cp].color}60` }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted-2)', letterSpacing: '0.04em' }}>{CP_META[cp].label}</span>
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--danger)', boxShadow: '0 0 6px rgba(255,51,85,0.6)' }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted-2)', letterSpacing: '0.04em' }}>Anomaly</span>
        </div>
      </div>

    </div>
  )
}

function InfoCell({ label, children }) {
  return (
    <div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 500 }}>
        {label}
      </div>
      <div style={{ fontSize: 13 }}>{children}</div>
    </div>
  )
}
