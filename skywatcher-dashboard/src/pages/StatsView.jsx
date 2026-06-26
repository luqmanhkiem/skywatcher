import { useCallback } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend,
  LineChart, Line,
} from 'recharts'
import { Activity, AlertTriangle, XCircle, Radio, Clock } from 'lucide-react'
import { usePolling }  from '../hooks/usePolling'
import { useIsMobile } from '../hooks/useIsMobile'
import {
  fetchStats, fetchAlerts,
  fetchAnomalyTrend, fetchFlightAnomalies,
  fetchAvgResolution, fetchCheckpointHeatmap,
} from '../utils/api'
import PageHeader from '../components/PageHeader'

const CP_COLORS = {
  check_in: '#38BDF8',
  security: '#F5A623',
  sorting:  '#A78BFA',
  loading:  '#F97316',
  arrival:  '#00CC7D',
}

const CP_LABELS = {
  check_in: 'Check-In',
  security: 'Security',
  sorting:  'Sorting',
  loading:  'Loading',
  arrival:  'Arrival',
}

const ANOMALY_TYPES = ['STALL', 'WRONG_ROUTE', 'SECURITY_BYPASS', 'ANOMALY']
const ANOMALY_COLORS = {
  STALL:           '#FF7A2F',
  WRONG_ROUTE:     '#FF3355',
  SECURITY_BYPASS: '#A78BFA',
  ANOMALY:         '#F5A623',
}
const ANOMALY_LABELS = {
  STALL:           'Stall',
  WRONG_ROUTE:     'Wrong Route',
  SECURITY_BYPASS: 'Security Bypass',
  ANOMALY:         'Other',
}

const TOOLTIP_STYLE = {
  contentStyle: {
    background: 'var(--surface)',
    border: '1px solid var(--border-2)',
    borderRadius: 9,
    fontSize: 12,
    boxShadow: '0 8px 24px rgba(0,0,0,0.10)',
  },
  labelStyle:  { color: 'var(--text)', fontWeight: 600, marginBottom: 4 },
  itemStyle:   { color: 'var(--muted)' },
  cursor:      { fill: 'rgba(0,0,0,0.04)' },
}

function StatCard({ label, value, sub, accent, Icon, loading }) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderTop: `2px solid ${accent ?? 'var(--border-2)'}`,
      borderRadius: 10,
      padding: '18px 22px',
      display: 'flex',
      alignItems: 'flex-start',
      gap: 14,
      transition: 'border-color 0.2s',
    }}>
      {Icon && (
        <div style={{
          width: 36, height: 36, borderRadius: 8, flexShrink: 0,
          background: accent ? accent + '15' : 'var(--surface-3)',
          border: `1px solid ${accent ? accent + '35' : 'var(--border)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: accent ? `0 0 10px ${accent}25` : 'none',
        }}>
          <Icon size={16} color={accent ?? 'var(--muted-2)'} />
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6, fontWeight: 600 }}>
          {label}
        </div>
        {loading ? (
          <div className="skeleton" style={{ height: 26, width: '60%', marginBottom: 6 }} />
        ) : (
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 26, fontWeight: 700, color: accent ?? 'var(--text)', lineHeight: 1, textShadow: accent ? `0 0 20px ${accent}50` : 'none' }}>
            {value}
          </div>
        )}
        {sub && !loading && (
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted-2)', marginTop: 5, letterSpacing: '0.04em' }}>{sub}</div>
        )}
      </div>
    </div>
  )
}

function ChartBox({ title, children, empty, emptyMsg, loading }) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 10,
      padding: '20px 22px 22px',
    }}>
      <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 14, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-2)', marginBottom: 18 }}>
        {title}
      </h2>
      {loading ? (
        <div className="skeleton" style={{ height: 200, borderRadius: 8 }} />
      ) : empty ? (
        <p style={{ color: 'var(--muted)', fontSize: 13, textAlign: 'center', padding: '40px 0' }}>{emptyMsg}</p>
      ) : children}
    </div>
  )
}

export default function StatsView() {
  const isMobile     = useIsMobile()
  const statsFn      = useCallback(() => fetchStats(), [])
  const alertsFn     = useCallback(() => fetchAlerts(500), [])
  const trendFn      = useCallback(() => fetchAnomalyTrend(), [])
  const flightAnFn   = useCallback(() => fetchFlightAnomalies(), [])
  const avgResFn     = useCallback(() => fetchAvgResolution(), [])
  const heatmapFn    = useCallback(() => fetchCheckpointHeatmap(), [])

  const { data: statsData,     loading: statsLoading   } = usePolling(statsFn,    5000)
  const { data: alertsData,    loading: alertsLoading  } = usePolling(alertsFn,   5000)
  const { data: trendData,     loading: trendLoading   } = usePolling(trendFn,    10000)
  const { data: flightAnData,  loading: flightAnLoading} = usePolling(flightAnFn, 10000)
  const { data: avgResData                              } = usePolling(avgResFn,   10000)
  const { data: heatmapData,   loading: heatmapLoading } = usePolling(heatmapFn,  10000)

  const loading = statsLoading || alertsLoading

  const stats = (statsData?.stats ?? []).map(s => ({
    ...s,
    name:  CP_LABELS[s.checkpoint]  ?? s.checkpoint,
    color: CP_COLORS[s.checkpoint]  ?? '#6b7280',
  }))

  const allAlerts      = alertsData?.alerts ?? []
  const anomalyCounts  = ANOMALY_TYPES.map(type => ({
    name:  ANOMALY_LABELS[type],
    count: allAlerts.filter(a => a.type === type).length,
    color: ANOMALY_COLORS[type],
  })).filter(a => a.count > 0)

  const totalEvents     = stats.reduce((s, r) => s + r.count, 0)
  const totalAnomalies  = allAlerts.length
  const resolvedCount   = allAlerts.filter(a => a.resolved).length
  const unresolvedCount = totalAnomalies - resolvedCount
  const resolvedPct     = totalAnomalies ? Math.round((resolvedCount / totalAnomalies) * 100) : 0
  const activeCheckpoints = stats.length

  const avgMins    = avgResData?.avg_mins ?? null
  const trendRows  = Array.isArray(trendData)    ? trendData.map(r => ({ ...r, date: r.date?.slice(5) })) : []
  const flightRows = Array.isArray(flightAnData)  ? flightAnData  : []
  const heatRows   = Array.isArray(heatmapData)   ? heatmapData   : []
  const heatMax    = heatRows.reduce((m, r) => Math.max(m, r.count), 0)

  return (
    <div className="animate-fade-up">

      {/* ── Header ────────────────────────────────────────── */}
      <PageHeader
        title="Analytics"
        subtitle="Checkpoint throughput and anomaly breakdown · refreshes every 5s"
      />

      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* ── KPI cards ─────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
          <StatCard
            Icon={Activity}
            label="Total Scans"
            value={totalEvents.toLocaleString()}
            sub="RFID events recorded"
            loading={statsLoading}
          />
          <StatCard
            Icon={AlertTriangle}
            label="Anomalies Detected"
            value={totalAnomalies}
            sub={totalAnomalies > 0 ? `${resolvedPct}% resolved` : 'None yet'}
            accent={totalAnomalies > 0 ? 'var(--warning)' : undefined}
            loading={alertsLoading}
          />
          <StatCard
            Icon={XCircle}
            label="Unresolved"
            value={unresolvedCount}
            sub={unresolvedCount > 0 ? 'Require attention' : 'All clear'}
            accent={unresolvedCount > 0 ? 'var(--danger)' : 'var(--success)'}
            loading={alertsLoading}
          />
          <StatCard
            Icon={Radio}
            label="Active Checkpoints"
            value={`${activeCheckpoints} / 5`}
            sub="Pipeline coverage"
            accent="var(--accent)"
            loading={statsLoading}
          />
          <StatCard
            Icon={Clock}
            label="Avg Resolution Time"
            value={avgMins !== null ? `${avgMins}m` : '—'}
            sub={avgMins !== null ? 'From detection to resolve' : 'No resolved alerts yet'}
            accent="var(--accent)"
            loading={false}
          />
        </div>

        {/* ── Resolution rate bar ───────────────────────── */}
        {totalAnomalies > 0 && !loading && (
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: '16px 22px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 12, color: 'var(--muted-2)', fontWeight: 500 }}>Alert Resolution Rate</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: resolvedPct >= 80 ? 'var(--success)' : resolvedPct >= 50 ? 'var(--warning)' : 'var(--danger)' }}>
                {resolvedPct}%
              </span>
            </div>
            <div style={{ height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{
                width: `${resolvedPct}%`, height: '100%',
                background: resolvedPct >= 80
                  ? 'linear-gradient(90deg, #22c55e, #16a34a)'
                  : resolvedPct >= 50
                    ? 'linear-gradient(90deg, #f59e0b, #d97706)'
                    : 'linear-gradient(90deg, #ef4444, #dc2626)',
                borderRadius: 4,
                transition: 'width 0.6s ease',
              }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted)', marginTop: 8 }}>
              <span>{resolvedCount} resolved</span>
              <span>{unresolvedCount} pending</span>
            </div>
          </div>
        )}

        {/* ── Charts grid ───────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : (anomalyCounts.length > 0 ? '1fr 1fr' : '1fr'), gap: 16 }}>

          <ChartBox
            title="Events per Checkpoint"
            empty={stats.length === 0}
            emptyMsg="No scan data yet — start the RFID simulator."
            loading={statsLoading}
          >
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={stats} margin={{ top: 4, right: 6, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fill: 'var(--muted-2)', fontSize: 11 }}
                  axisLine={false} tickLine={false}
                />
                <YAxis
                  tick={{ fill: 'var(--muted-2)', fontSize: 11 }}
                  axisLine={false} tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip {...TOOLTIP_STYLE} formatter={v => [v, 'Scans']} />
                <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={52}>
                  {stats.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartBox>

          {anomalyCounts.length > 0 && (
            <ChartBox
              title="Anomaly Type Breakdown"
              empty={false}
              loading={alertsLoading}
            >
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={anomalyCounts}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    innerRadius={46}
                    paddingAngle={3}
                    strokeWidth={0}
                  >
                    {anomalyCounts.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE.contentStyle}
                    formatter={(v, name) => [v + ' alert' + (v !== 1 ? 's' : ''), name]}
                  />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    formatter={value => (
                      <span style={{ color: 'var(--muted-2)', fontSize: 11 }}>{value}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            </ChartBox>
          )}
        </div>

        {/* ── Anomaly bar chart (when no pie data yet) ───── */}
        {anomalyCounts.length === 0 && (
          <ChartBox
            title="Anomaly Type Breakdown"
            empty={true}
            emptyMsg="No anomalies recorded yet."
            loading={alertsLoading}
          />
        )}

        {/* ── Trend + Flight anomalies ───────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
          <ChartBox
            title="Anomaly Trend (last 14 days)"
            empty={trendRows.length === 0}
            emptyMsg="No anomaly data for the past 14 days."
            loading={trendLoading}
          >
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={trendRows} margin={{ top: 4, right: 6, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: 'var(--muted-2)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--muted-2)', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip {...TOOLTIP_STYLE} formatter={v => [v, 'Anomalies']} />
                <Line type="monotone" dataKey="count" stroke="#ef4444" strokeWidth={2} dot={{ r: 3, fill: '#ef4444' }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </ChartBox>

          <ChartBox
            title="Anomalies per Flight"
            empty={flightRows.length === 0}
            emptyMsg="No flight anomaly data yet."
            loading={flightAnLoading}
          >
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={flightRows} margin={{ top: 4, right: 6, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="flight_id" tick={{ fill: 'var(--muted-2)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--muted-2)', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip {...TOOLTIP_STYLE} formatter={v => [v, 'Anomalies']} />
                <Bar dataKey="count" fill="#f59e0b" radius={[6, 6, 0, 0]} maxBarSize={48} />
              </BarChart>
            </ResponsiveContainer>
          </ChartBox>
        </div>

        {/* ── Checkpoint heatmap ────────────────────────── */}
        <ChartBox
          title="Anomaly Hotspots by Checkpoint"
          empty={heatRows.length === 0}
          emptyMsg="No checkpoint anomaly data yet."
          loading={heatmapLoading}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {heatRows.map(row => {
              const pct = heatMax > 0 ? Math.round((row.count / heatMax) * 100) : 0
              const color = CP_COLORS[row.checkpoint] ?? '#6b7280'
              return (
                <div key={row.checkpoint}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--muted-2)', marginBottom: 5 }}>
                    <span style={{ fontWeight: 500, color: 'var(--text-2)' }}>
                      {CP_LABELS[row.checkpoint] ?? row.checkpoint}
                    </span>
                    <span style={{ color, fontWeight: 600 }}>{row.count} anomal{row.count === 1 ? 'y' : 'ies'}</span>
                  </div>
                  <div style={{ height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{
                      width: `${pct}%`, height: '100%',
                      background: color,
                      borderRadius: 4,
                      transition: 'width 0.6s ease',
                    }} />
                  </div>
                </div>
              )
            })}
          </div>
        </ChartBox>

      </div>
    </div>
  )
}
