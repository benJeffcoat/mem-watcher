import { useMemo, useState } from 'react'
import type { PieSegment, UtilizationPoint } from '../types/monitor'
import { formatTimestamp } from '../utils/formatters'
import { InfoIcon } from './Icons'

type DetailRow = {
  label: string
  value: string
  helpText?: string
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

function sampleHistory(history: UtilizationPoint[], maxPoints: number): UtilizationPoint[] {
  if (history.length <= maxPoints) {
    return history
  }
  const sampled: UtilizationPoint[] = []
  const lastIndex = history.length - 1
  for (let index = 0; index < maxPoints; index += 1) {
    const sourceIndex = Math.round((index / (maxPoints - 1)) * lastIndex)
    sampled.push(history[sourceIndex])
  }
  return sampled
}

function buildSmoothPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) {
    return ''
  }
  if (points.length === 1) {
    return `M ${points[0].x} ${points[0].y}`
  }
  let path = `M ${points[0].x} ${points[0].y}`
  for (let index = 0; index < points.length - 1; index += 1) {
    const current = points[index]
    const next = points[index + 1]
    const midX = (current.x + next.x) / 2
    const midY = (current.y + next.y) / 2
    path += ` Q ${current.x} ${current.y} ${midX} ${midY}`
  }
  const last = points[points.length - 1]
  path += ` T ${last.x} ${last.y}`
  return path
}

export function MemoryOverviewCard({
  title,
  totalLabel,
  totalHelpText,
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
  totalHelpText?: string
  segments: PieSegment[]
  history: UtilizationPoint[]
  trendTitle?: string
  details?: DetailRow[]
  secondaryHistory?: UtilizationPoint[]
  secondaryColor?: string
  trendLegend?: TrendLegendItem[]
}) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0)
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  const sampledHistory = useMemo(() => sampleHistory(history, 100), [history])
  const sampledSecondaryHistory = useMemo(() => sampleHistory(secondaryHistory, 100), [secondaryHistory])

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
  const showTrend = sampledHistory.length >= 2
  const width = 560
  const height = 118
  const left = 48
  const top = 14
  const chartWidth = width - left * 2
  const chartHeight = height - top * 2
  const chartPoints = sampledHistory.map((point, index) => ({
    x: left + (index / Math.max(sampledHistory.length - 1, 1)) * chartWidth,
    y: top + ((100 - point.usedPercent) / 100) * chartHeight,
    point,
  }))
  const hoveredPoint = hoveredIndex === null ? null : chartPoints[hoveredIndex]
  const smoothPath = buildSmoothPath(chartPoints)
  const secondaryPoints = sampledSecondaryHistory.map((point, index) => ({
    x: left + (index / Math.max(sampledSecondaryHistory.length - 1, 1)) * chartWidth,
    y: top + ((100 - point.usedPercent) / 100) * chartHeight,
  }))

  return (
    <div className="chart-card memory-card">
      <div className="chart-header">
        <p className="eyebrow">{title}</p>
        <div className="chart-total-label">
          <strong>{totalLabel}</strong>
          {totalHelpText ? (
            <span className="memory-info">
              <button className="memory-info-button" type="button" aria-label={`${title} load average details`}>
                <InfoIcon className="memory-info-icon" />
              </button>
              <span className="memory-info-popover" role="tooltip">
                {totalHelpText}
              </span>
            </span>
          ) : null}
        </div>
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
              <div className="memory-meta-label-row">
                <p className="eyebrow">{item.label}</p>
                {item.helpText ? (
                  <span className="memory-info">
                    <button className="memory-info-button" type="button" aria-label={`${item.label} details`}>
                      <InfoIcon className="memory-info-icon" />
                    </button>
                    <span className="memory-info-popover" role="tooltip">
                      {item.helpText}
                    </span>
                  </span>
                ) : null}
              </div>
              <strong>{item.value}</strong>
            </div>
          ))}
        </div>
      ) : null}
      <div className="memory-trend-inline">
        <div className="memory-trend-inline-head">
          <p className="eyebrow">{trendTitle}</p>
          <strong>{sampledHistory.length} samples</strong>
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
            <svg
              viewBox={`0 0 ${width} ${height}`}
              className="history-chart compact-history-chart"
              aria-label={trendTitle}
            >
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
              <path d={smoothPath} className="history-line" />
              {secondaryPoints.length >= 2 ? (
                <path
                  d={buildSmoothPath(secondaryPoints)}
                  className="history-line history-line-secondary"
                  style={{ stroke: secondaryColor }}
                />
              ) : null}
              {hoveredPoint ? (
                <>
                  <line
                    x1={hoveredPoint.x}
                    x2={hoveredPoint.x}
                    y1={top}
                    y2={top + chartHeight}
                    className="history-hover-line"
                  />
                  <circle cx={hoveredPoint.x} cy={hoveredPoint.y} r="4" className="history-hover-dot" />
                  <g transform={`translate(${Math.min(hoveredPoint.x + 10, width - 150)}, ${Math.max(hoveredPoint.y - 42, 8)})`}>
                    <rect width="140" height="34" rx="8" className="history-tooltip-bg" />
                    <text x="10" y="14" className="history-tooltip-value">
                      {hoveredPoint.point.usedPercent.toFixed(1)}% {title === 'CPU Load' ? 'CPU' : 'RAM'}
                    </text>
                    <text x="10" y="27" className="history-tooltip-time">
                      {formatTimestamp(hoveredPoint.point.timestamp)}
                    </text>
                  </g>
                </>
              ) : null}
              {chartPoints.map((point, index) => (
                <rect
                  key={point.point.timestamp}
                  x={index === 0 ? left : (chartPoints[index - 1].x + point.x) / 2}
                  y={top}
                  width={
                    index === chartPoints.length - 1
                      ? width - left - (index === 0 ? left : (chartPoints[index - 1].x + point.x) / 2)
                      : (point.x + chartPoints[index + 1].x) / 2 - (index === 0 ? left : (chartPoints[index - 1].x + point.x) / 2)
                  }
                  height={chartHeight}
                  className="history-hover-target"
                  onMouseEnter={() => setHoveredIndex(index)}
                  onMouseLeave={() => setHoveredIndex((current) => (current === index ? null : current))}
                />
              ))}
            </svg>
            <div className="history-footer">
              <span>{formatTimestamp(sampledHistory[0]?.timestamp ?? null)}</span>
              <span>{formatTimestamp(sampledHistory[sampledHistory.length - 1]?.timestamp ?? null)}</span>
            </div>
          </>
        ) : (
          <div className="chart-empty compact-history-empty">Waiting for enough samples to draw a trend.</div>
        )}
      </div>
    </div>
  )
}
