import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'

type ConnectionForm = {
  host: string
  username: string
  password: string
  port: string
}

type ProcessInfo = {
  pid: number
  name: string
  command: string
  rss_bytes: number
  pss_bytes: number
  user_percent: number
  sys_percent: number
}

type MemorySnapshot = {
  used_percent: number
  total_bytes: number
  used_bytes: number
  free_bytes: number
}

type HistoryPoint = {
  timestamp: string
  usedPercent: number
  freeBytes: number
}

type DeviceSnapshot = {
  connected: boolean
  host: string
  prompt: string
  timestamp: string | null
  uptime: string | null
  memory: MemorySnapshot | null
  processes: ProcessInfo[]
  error: string | null
  history: HistoryPoint[]
}

type SessionResponse = {
  session_id: string
  snapshot: DeviceSnapshot
}

type PieSegment = {
  label: string
  value: number
  color: string
  meta: string
}

const processPalette = [
  '#0f766e',
  '#0ea5e9',
  '#f97316',
  '#b45309',
  '#334155',
  '#7c3aed',
  '#dc2626',
]

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
  }
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(0)} KB`
  }
  return `${bytes} B`
}

function formatTimestamp(value: string | null): string {
  if (!value) {
    return 'No sample yet'
  }
  const date = new Date(value)
  return date.toLocaleString()
}

function buildArcPath(cx: number, cy: number, radius: number, startAngle: number, endAngle: number): string {
  const startRadians = (startAngle - 90) * (Math.PI / 180)
  const endRadians = (endAngle - 90) * (Math.PI / 180)
  const startX = cx + radius * Math.cos(startRadians)
  const startY = cy + radius * Math.sin(startRadians)
  const endX = cx + radius * Math.cos(endRadians)
  const endY = cy + radius * Math.sin(endRadians)
  const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0
  return `M ${startX} ${startY} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${endX} ${endY}`
}

function DonutChart({
  title,
  totalLabel,
  segments,
}: {
  title: string
  totalLabel: string
  segments: PieSegment[]
}) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0)

  if (total <= 0) {
    return (
      <div className="chart-card">
        <div className="chart-header">
          <p className="eyebrow">{title}</p>
        </div>
        <div className="chart-empty">No data</div>
      </div>
    )
  }

  let runningAngle = 0

  return (
    <div className="chart-card">
      <div className="chart-header">
        <p className="eyebrow">{title}</p>
        <strong>{totalLabel}</strong>
      </div>
      <div className="chart-shell">
        <svg viewBox="0 0 220 220" className="donut-chart" aria-hidden="true">
          <circle cx="110" cy="110" r="78" className="donut-track" />
          {segments.map((segment) => {
            const percentage = segment.value / total
            const startAngle = runningAngle
            const endAngle = runningAngle + percentage * 360
            runningAngle = endAngle
            return (
              <path
                key={segment.label}
                d={buildArcPath(110, 110, 78, startAngle, endAngle)}
                stroke={segment.color}
                className="donut-segment"
              />
            )
          })}
          <circle cx="110" cy="110" r="54" className="donut-hole" />
        </svg>
        <div className="legend">
          {segments.map((segment) => {
            const percentage = total === 0 ? 0 : (segment.value / total) * 100
            return (
              <div className="legend-row" key={segment.label}>
                <span className="legend-swatch" style={{ backgroundColor: segment.color }} />
                <div>
                  <div className="legend-label-row">
                    <strong>{segment.label}</strong>
                    <span>{percentage.toFixed(1)}%</span>
                  </div>
                  <p>{segment.meta}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function HistoryChart({ history }: { history: HistoryPoint[] }) {
  if (history.length < 2) {
    return <div className="history-empty">Waiting for enough samples to draw a trend.</div>
  }

  const width = 560
  const height = 170
  const left = 18
  const top = 18
  const chartWidth = width - left * 2
  const chartHeight = height - top * 2

  const points = history.map((point, index) => {
    const x = left + (index / Math.max(history.length - 1, 1)) * chartWidth
    const y = top + ((100 - point.usedPercent) / 100) * chartHeight
    return `${x},${y}`
  })

  return (
    <div className="history-card">
      <div className="chart-header">
        <p className="eyebrow">Memory Trend</p>
        <strong>{history.length} samples</strong>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="history-chart" aria-hidden="true">
        <rect x="0" y="0" width={width} height={height} rx="18" className="history-bg" />
        <line x1={left} x2={width - left} y1={top} y2={top} className="history-grid" />
        <line
          x1={left}
          x2={width - left}
          y1={top + chartHeight / 2}
          y2={top + chartHeight / 2}
          className="history-grid"
        />
        <line
          x1={left}
          x2={width - left}
          y1={top + chartHeight}
          y2={top + chartHeight}
          className="history-grid"
        />
        <polyline points={points.join(' ')} className="history-line" />
        {points.map((point, index) => {
          const [x, y] = point.split(',')
          return <circle key={history[index].timestamp} cx={x} cy={y} r="3.6" className="history-dot" />
        })}
      </svg>
      <div className="history-footer">
        <span>{formatTimestamp(history[0]?.timestamp ?? null)}</span>
        <span>{formatTimestamp(history[history.length - 1]?.timestamp ?? null)}</span>
      </div>
    </div>
  )
}

function App() {
  const [form, setForm] = useState<ConnectionForm>({
    host: '',
    username: 'admin',
    password: '',
    port: '22',
  })
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [snapshot, setSnapshot] = useState<DeviceSnapshot | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!sessionId) {
      return
    }
    const intervalId = window.setInterval(async () => {
      const response = await fetch(`/api/sessions/${sessionId}`)
      if (!response.ok) {
        setError('Polling session failed.')
        return
      }
      const nextSnapshot = (await response.json()) as DeviceSnapshot
      setSnapshot(nextSnapshot)
      setError(nextSnapshot.error)
    }, 3000)
    return () => window.clearInterval(intervalId)
  }, [sessionId])

  useEffect(() => {
    return () => {
      if (sessionId) {
        void fetch(`/api/sessions/${sessionId}`, { method: 'DELETE' })
      }
    }
  }, [sessionId])

  async function handleConnect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsConnecting(true)
    setError(null)

    if (sessionId) {
      await fetch(`/api/sessions/${sessionId}`, { method: 'DELETE' })
      setSessionId(null)
    }

    try {
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: form.host,
          username: form.username,
          password: form.password,
          port: Number(form.port),
        }),
      })

      const payload = (await response.json()) as SessionResponse | { detail?: string }
      if (!response.ok || !('session_id' in payload)) {
        setError('detail' in payload ? payload.detail ?? 'Connection failed.' : 'Connection failed.')
        setSnapshot(null)
        return
      }

      setSessionId(payload.session_id)
      setSnapshot(payload.snapshot)
      setError(payload.snapshot.error)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Connection failed.')
      setSnapshot(null)
    } finally {
      setIsConnecting(false)
    }
  }

  async function handleDisconnect() {
    if (!sessionId) {
      return
    }
    await fetch(`/api/sessions/${sessionId}`, { method: 'DELETE' })
    setSessionId(null)
    setSnapshot(null)
    setError(null)
  }

  const ramSegments = !snapshot?.memory
    ? []
    : [
        {
          label: 'Used RAM',
          value: snapshot.memory.used_bytes,
          color: '#0f766e',
          meta: formatBytes(snapshot.memory.used_bytes),
        },
        {
          label: 'Free RAM',
          value: snapshot.memory.free_bytes,
          color: '#dbeafe',
          meta: formatBytes(snapshot.memory.free_bytes),
        },
      ]

  const processSegments = !snapshot?.processes.length
    ? []
    : (() => {
        const topProcessesForChart = snapshot.processes.slice(0, 6)
        const segments = topProcessesForChart.map((process, index) => ({
          label: `${process.name} [${process.pid}]`,
          value: process.rss_bytes,
          color: processPalette[index % processPalette.length],
          meta: `${formatBytes(process.rss_bytes)} RSS`,
        }))
        const remaining = snapshot.processes
          .slice(6)
          .reduce((sum, process) => sum + process.rss_bytes, 0)
        if (remaining > 0) {
          segments.push({
            label: 'Other processes',
            value: remaining,
            color: '#cbd5e1',
            meta: formatBytes(remaining),
          })
        }
        return segments
      })()

  const topProcesses = snapshot?.processes.slice(0, 10) ?? []

  return (
    <main className="app-shell">
      <section className="masthead">
        <div>
          <p className="eyebrow">Crestron SSH Monitor</p>
          <h1>Track processor RAM and live process memory from one screen.</h1>
        </div>
        <p className="masthead-copy">
          The backend maintains the SSH session and polls `RAMFree`, `TASKSTAT`, and `UPTIME`
          every 10 seconds. The dashboard refreshes against that cached session.
        </p>
      </section>

      <section className="workspace">
        <form className="connect-card" onSubmit={handleConnect}>
          <div className="card-head">
            <div>
              <p className="eyebrow">Connection</p>
              <h2>Device Login</h2>
            </div>
            {sessionId ? (
              <button type="button" className="ghost-button" onClick={handleDisconnect}>
                Disconnect
              </button>
            ) : null}
          </div>

          <label>
            <span>IP Address / Host</span>
            <input
              value={form.host}
              onChange={(event) => setForm((current) => ({ ...current, host: event.target.value }))}
              placeholder="10.10.20.207"
              required
            />
          </label>
          <div className="field-row">
            <label>
              <span>Username</span>
              <input
                value={form.username}
                onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))}
                required
              />
            </label>
            <label>
              <span>SSH Port</span>
              <input
                value={form.port}
                onChange={(event) => setForm((current) => ({ ...current, port: event.target.value }))}
                required
              />
            </label>
          </div>
          <label>
            <span>Password</span>
            <input
              type="password"
              value={form.password}
              onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
              required
            />
          </label>

          <button className="connect-button" type="submit" disabled={isConnecting}>
            {isConnecting ? 'Connecting...' : sessionId ? 'Reconnect' : 'Connect'}
          </button>

          <dl className="status-grid">
            <div>
              <dt>Status</dt>
              <dd className={snapshot?.connected ? 'ok' : 'warn'}>
                {snapshot?.connected ? 'Connected' : 'Disconnected'}
              </dd>
            </div>
            <div>
              <dt>Prompt</dt>
              <dd>{snapshot?.prompt ?? 'Not connected'}</dd>
            </div>
            <div>
              <dt>Last Sample</dt>
              <dd>{formatTimestamp(snapshot?.timestamp ?? null)}</dd>
            </div>
            <div>
              <dt>Uptime</dt>
              <dd>{snapshot?.uptime ?? 'Unknown'}</dd>
            </div>
          </dl>

          {error ? <div className="error-banner">{error}</div> : null}
        </form>

        <section className="dashboard-grid">
          <DonutChart
            title="Overall RAM"
            totalLabel={snapshot?.memory ? formatBytes(snapshot.memory.total_bytes) : 'No sample'}
            segments={ramSegments}
          />
          <DonutChart
            title="Process RSS"
            totalLabel={snapshot?.processes.length ? `${snapshot.processes.length} processes` : 'No sample'}
            segments={processSegments}
          />
          <HistoryChart history={snapshot?.history ?? []} />

          <section className="table-card">
            <div className="card-head">
              <div>
                <p className="eyebrow">Process Table</p>
                <h2>Top Memory Consumers</h2>
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>PID</th>
                    <th>RSS</th>
                    <th>PSS</th>
                    <th>CPU</th>
                    <th>Command</th>
                  </tr>
                </thead>
                <tbody>
                  {topProcesses.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="empty-row">
                        No process data yet.
                      </td>
                    </tr>
                  ) : (
                    topProcesses.map((process) => (
                      <tr key={`${process.pid}-${process.command}`}>
                        <td>{process.name}</td>
                        <td>{process.pid}</td>
                        <td>{formatBytes(process.rss_bytes)}</td>
                        <td>{formatBytes(process.pss_bytes)}</td>
                        <td>{(process.user_percent + process.sys_percent).toFixed(1)}%</td>
                        <td className="command-cell">{process.command}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </section>
      </section>
    </main>
  )
}

export default App
