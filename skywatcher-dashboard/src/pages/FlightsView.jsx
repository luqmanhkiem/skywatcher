import { useCallback } from 'react'
import { Plane, Package, AlertTriangle, CheckCircle2, Clock } from 'lucide-react'
import { usePolling }    from '../hooks/usePolling'
import { fetchFlights }  from '../utils/api'
import PageHeader        from '../components/PageHeader'

function parseISO(iso) {
  if (!iso) return null
  return new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z')
}

function timeAgo(iso) {
  const d = parseISO(iso)
  if (!d) return null
  const diff = Math.floor((Date.now() - d.getTime()) / 1000)
  if (diff < 60)   return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  return `${Math.floor(diff / 3600)}h ago`
}

function FlightCard({ f }) {
  const pct        = f.total_bags > 0 ? Math.round((f.arrived / f.total_bags) * 100) : 0
  const isComplete = pct === 100
  const hasAnomaly = f.bags_with_anomalies > 0
  const inTransit  = f.total_bags - f.arrived - (f.bags_with_anomalies ?? 0)

  let barColor = 'var(--accent)'
  if (isComplete) barColor = 'var(--success)'
  else if (hasAnomaly && pct > 50) barColor = 'var(--warning)'

  const accentColor = isComplete ? '#00CC7D' : hasAnomaly ? '#FF7A2F' : '#F5A623'

  return (
    <div style={{
      background: 'var(--surface)',
      border: `1px solid ${hasAnomaly ? 'rgba(255,122,47,0.25)' : isComplete ? 'rgba(0,204,125,0.2)' : 'var(--border)'}`,
      borderTop: `2px solid ${accentColor}`,
      borderRadius: 10,
      padding: '18px 20px',
      display: 'flex',
      flexDirection: 'column',
      gap: 0,
      transition: 'border-color 0.2s, transform 0.15s',
      cursor: 'default',
    }}
    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.08)' }}
    onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)';    e.currentTarget.style.boxShadow = 'none' }}
    >
      {/* ── Flight header ──────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div style={{
          width: 38, height: 38, borderRadius: 9, flexShrink: 0,
          background: isComplete ? 'rgba(0,204,125,0.12)' : 'rgba(245,166,35,0.10)',
          border: `1px solid ${isComplete ? 'rgba(0,204,125,0.25)' : 'rgba(245,166,35,0.25)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Plane size={17} color={isComplete ? 'var(--success)' : 'var(--accent)'} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 15, letterSpacing: '0.06em', color: isComplete ? 'var(--success)' : 'var(--accent)' }}>
            {f.flight_id}
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--muted-2)', marginTop: 3, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            {f.total_bags} bag{f.total_bags !== 1 ? 's' : ''} total
          </div>
        </div>

        {/* Status chip */}
        {isComplete ? (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 4,
            background: 'rgba(0,204,125,0.1)',
            border: '1px solid rgba(0,204,125,0.25)',
            color: 'var(--success)',
            fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 600,
            borderRadius: 20, padding: '3px 9px', letterSpacing: '0.06em',
          }}>
            <CheckCircle2 size={10} />
            COMPLETE
          </div>
        ) : hasAnomaly ? (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 4,
            background: 'rgba(255,122,47,0.1)',
            border: '1px solid rgba(255,122,47,0.25)',
            color: 'var(--warning)',
            fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 600,
            borderRadius: 20, padding: '3px 9px', letterSpacing: '0.06em',
          }}>
            <AlertTriangle size={10} />
            ALERT
          </div>
        ) : (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 4,
            background: 'rgba(245,166,35,0.08)',
            border: '1px solid rgba(245,166,35,0.2)',
            color: 'var(--accent)',
            fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 600,
            borderRadius: 20, padding: '3px 9px', letterSpacing: '0.06em',
          }}>
            <Clock size={10} />
            IN PROGRESS
          </div>
        )}
      </div>

      {/* ── Progress bar ───────────────────────── */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted-2)', marginBottom: 7 }}>
          <span>Arrived</span>
          <span style={{ fontWeight: 600, color: isComplete ? 'var(--success)' : 'var(--text)' }}>
            {f.arrived} / {f.total_bags}
          </span>
        </div>
        <div style={{ height: 7, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{
            width: `${pct}%`,
            height: '100%',
            background: barColor,
            borderRadius: 4,
            transition: 'width 0.5s ease',
            boxShadow: isComplete ? `0 0 8px ${barColor}60` : 'none',
          }} />
        </div>
      </div>

      {/* ── Stats row ──────────────────────────── */}
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{
          flex: 1, background: 'var(--surface-2)', borderRadius: 8,
          padding: '8px 10px', textAlign: 'center',
          border: '1px solid var(--border)',
        }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700, color: 'var(--success)' }}>{f.arrived}</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--muted)', marginTop: 3, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Arrived</div>
        </div>
        <div style={{
          flex: 1, background: 'var(--surface-2)', borderRadius: 8,
          padding: '8px 10px', textAlign: 'center',
          border: '1px solid var(--border)',
        }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700, color: 'var(--accent)' }}>
            {Math.max(0, f.total_bags - f.arrived)}
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--muted)', marginTop: 3, letterSpacing: '0.06em', textTransform: 'uppercase' }}>In Transit</div>
        </div>
        <div style={{
          flex: 1, background: hasAnomaly ? 'rgba(255,122,47,0.06)' : 'var(--surface-2)',
          borderRadius: 8, padding: '8px 10px', textAlign: 'center',
          border: `1px solid ${hasAnomaly ? 'rgba(255,122,47,0.2)' : 'var(--border)'}`,
        }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700, color: hasAnomaly ? 'var(--warning)' : 'var(--muted)' }}>
            {f.bags_with_anomalies ?? 0}
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--muted)', marginTop: 3, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Anomalies</div>
        </div>
      </div>

      {/* ── Arrival rate footer ─────────────────── */}
      <div style={{
        marginTop: 12,
        paddingTop: 12,
        borderTop: '1px solid var(--border)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Arrival Rate</span>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 13, fontWeight: 700,
          color: isComplete ? 'var(--success)' : pct >= 50 ? 'var(--accent)' : 'var(--muted-2)',
        }}>
          {pct}%
        </span>
      </div>
    </div>
  )
}

function SkeletonCard() {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '18px 20px' }}>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <div className="skeleton" style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div className="skeleton" style={{ height: 17, width: '60%', marginBottom: 7 }} />
          <div className="skeleton" style={{ height: 11, width: '40%' }} />
        </div>
      </div>
      <div className="skeleton" style={{ height: 7, borderRadius: 4, marginBottom: 14 }} />
      <div style={{ display: 'flex', gap: 8 }}>
        {[1,2,3].map(i => <div key={i} className="skeleton" style={{ flex: 1, height: 50, borderRadius: 8 }} />)}
      </div>
    </div>
  )
}

export default function FlightsView() {
  const fn = useCallback(() => fetchFlights(), [])
  const { data, loading } = usePolling(fn, 5000)
  const flights = data?.flights ?? []

  const completedCount = flights.filter(f => f.total_bags > 0 && f.arrived === f.total_bags).length
  const alertCount     = flights.filter(f => f.bags_with_anomalies > 0).length

  return (
    <div className="animate-fade-up">

      {/* ── Header ────────────────────────────────────────── */}
      <PageHeader
        title="Flight Summaries"
        subtitle={`${flights.length} flight${flights.length !== 1 ? 's' : ''} · baggage status per flight · refreshes every 5s`}
      >
        {!loading && flights.length > 0 && (
          <div style={{ display: 'flex', gap: 10 }}>
            {completedCount > 0 && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 5,
                fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--success)',
                background: 'rgba(0,204,125,0.08)',
                border: '1px solid rgba(0,204,125,0.2)',
                borderRadius: 8, padding: '4px 10px', letterSpacing: '0.06em',
              }}>
                <CheckCircle2 size={11} />
                {completedCount} COMPLETE
              </div>
            )}
            {alertCount > 0 && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 5,
                fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--warning)',
                background: 'rgba(255,122,47,0.08)',
                border: '1px solid rgba(255,122,47,0.2)',
                borderRadius: 8, padding: '4px 10px', letterSpacing: '0.06em',
              }}>
                <AlertTriangle size={11} />
                {alertCount} WITH ALERTS
              </div>
            )}
          </div>
        )}
      </PageHeader>

      {/* ── Flight grid ───────────────────────────────────── */}
      <div style={{
        padding: 24,
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: 14,
      }}>
        {loading && [1,2,3,4].map(i => <SkeletonCard key={i} />)}

        {!loading && flights.length === 0 && (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '72px 0', color: 'var(--muted)' }}>
            <Package size={36} style={{ marginBottom: 14, opacity: 0.4 }} />
            <p style={{ fontSize: 15, fontWeight: 500, marginBottom: 6, color: 'var(--text-2)' }}>No flights yet</p>
            <p style={{ fontSize: 13 }}>Start the RFID simulator to see flight data.</p>
          </div>
        )}

        {flights.map(f => <FlightCard key={f.flight_id} f={f} />)}
      </div>

    </div>
  )
}
