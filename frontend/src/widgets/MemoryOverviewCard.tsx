import type { PieSegment, UtilizationPoint } from '../types/monitor'
import { formatTimestamp } from '../utils/formatters'

type DetailRow = {
  label: string
  value: string
}

type TrendLegendItem = {
  label: string
  color: string
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

export function MemoryOverviewCard({
  title,
  totalLabel,
  segments,
  history,
  trendTitle = 'Memory Trend',
  details = [],
  secondaryHistory = [],
  secondaryColor = '#f97316',
  trendLegend = [],
}: {
  title: string
  totalLabel: string
  segments: PieSegment[]
  history: UtilizationPoint[]
  trendTitle?: string
  details?: DetailRow[]
  secondaryHistory?: UtilizationPoint[]
  secondaryColor?: string
  trendLegend?: TrendLegendItem[]
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

  const donutSegments = segments.reduce<Array<{ segment: PieSegment; startAngle: number; endAngle: number }>>(
    (acc, segment) => {
      const startAngle = acc.length ? acc[acc.length - 1].endAngle : 0
      const endAngle = startAngle + (segment.value / total) * 360
      acc.push({ segment, startAngle, endAngle })
      return acc
    },
    [],
  )
  const showTrend = history.length >= 2
  const width = 560
  const height = 118
  const left = 48
  const top = 14
  const chartWidth = width - left * 2
  const chartHeight = height - top * 2
  const buildPoints = (series: UtilizationPoint[]) =>
    series.map((point, index) => {
      const x = left + (index / Math.max(series.length - 1, 1)) * chartWidth
      const y = top + ((100 - point.usedPercent) / 100) * chartHeight
      return `${x},${y}`
    })
  const points = buildPoints(history)
  const secondaryPoints = secondaryHistory.length >= 2 ? buildPoints(secondaryHistory) : []

  return (
    <div className="chart-card memory-card">
      <div className="chart-header">
        <p className="eyebrow">{title}</p>
        <strong>{totalLabel}</strong>
      </div>
      <div className="chart-shell">
        <svg viewBox="0 0 220 220" className="donut-chart" aria-hidden="true">
          <circle cx="110" cy="110" r="78" className="donut-track" />
          {donutSegments.map(({ segment, startAngle, endAngle }) => {
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
      {details.length ? (
        <div className="memory-meta-grid">
          {details.map((item) => (
            <div className="memory-meta-item" key={item.label}>
              <p className="eyebrow">{item.label}</p>
              <strong>{item.value}</strong>
            </div>
          ))}
        </div>
      ) : null}
      <div className="memory-trend-inline">
        <div className="memory-trend-inline-head">
          <p className="eyebrow">{trendTitle}</p>
          <strong>{history.length} samples</strong>
        </div>
        {trendLegend.length ? (
          <div className="trend-legend" aria-label="Trend legend">
            {trendLegend.map((item) => (
              <span className="trend-legend-item" key={`${item.label}-${item.color}`}>
                <span className="trend-legend-swatch" style={{ backgroundColor: item.color }} aria-hidden="true" />
                <span>{item.label}</span>
              </span>
            ))}
          </div>
        ) : null}
        {showTrend ? (
          <>
            <svg viewBox={`0 0 ${width} ${height}`} className="history-chart compact-history-chart" aria-hidden="true">
              <rect x="0" y="0" width={width} height={height} rx="14" className="history-bg" />
              <text x="10" y={top + 4} className="history-axis-label">
                100%
              </text>
              <text x="18" y={top + chartHeight / 2 + 4} className="history-axis-label">
                50%
              </text>
              <text x="24" y={top + chartHeight + 4} className="history-axis-label">
                0%
              </text>
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
              {secondaryPoints.length >= 2 ? (
                <polyline
                  points={secondaryPoints.join(' ')}
                  className="history-line history-line-secondary"
                  style={{ stroke: secondaryColor }}
                />
              ) : null}
              {points.map((point, index) => {
                const [x, y] = point.split(',')
                return <circle key={history[index].timestamp} cx={x} cy={y} r="3.4" className="history-dot" />
              })}
              {secondaryPoints.map((point, index) => {
                const [x, y] = point.split(',')
                return (
                  <circle
                    key={`secondary-${secondaryHistory[index].timestamp}`}
                    cx={x}
                    cy={y}
                    r="3.1"
                    className="history-dot history-dot-secondary"
                    style={{ fill: secondaryColor }}
                  />
                )
              })}
            </svg>
            <div className="history-footer">
              <span>{formatTimestamp(history[0]?.timestamp ?? null)}</span>
              <span>{formatTimestamp(history[history.length - 1]?.timestamp ?? null)}</span>
            </div>
          </>
        ) : (
          <div className="chart-empty compact-history-empty">Waiting for enough samples to draw a trend.</div>
        )}
      </div>
    </div>
  )
}
