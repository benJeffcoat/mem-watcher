import type { PieSegment } from '../types/monitor'

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

export function DonutChart({
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

  const donutSegments = segments.reduce<Array<{ segment: PieSegment; startAngle: number; endAngle: number }>>(
    (acc, segment) => {
      const startAngle = acc.length ? acc[acc.length - 1].endAngle : 0
      const endAngle = startAngle + (segment.value / total) * 360
      acc.push({ segment, startAngle, endAngle })
      return acc
    },
    [],
  )

  return (
    <div className="chart-card">
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
    </div>
  )
}
