import type { HistoryPoint } from '../types/monitor'
import { formatTimestamp } from '../utils/formatters'

export function HistoryChart({ history }: { history: HistoryPoint[] }) {
  if (history.length < 2) {
    return <div className="history-card history-empty">Waiting for enough samples to draw a trend.</div>
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
