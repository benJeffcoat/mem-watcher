import { useRef, useState } from 'react'
import type { useMemWatcherState } from '../state/useMemWatcherState'
import type { PieSegment } from '../types/monitor'
import { exportSnapshot } from '../utils/exportSnapshot'
import { formatBytes, formatTimestamp } from '../utils/formatters'
import { DonutChart } from '../widgets/DonutChart'
import { MemoryOverviewCard } from '../widgets/MemoryOverviewCard'
import { PageHeader } from '../widgets/PageHeader'
import { ProcessTable } from '../widgets/ProcessTable'
import { ExportIcon } from '../widgets/Icons'

type AppState = ReturnType<typeof useMemWatcherState>

const processPalette = ['#0f766e', '#0ea5e9', '#f97316', '#b45309', '#334155', '#7c3aed', '#dc2626']

export function PerformancePage({ state }: { state: AppState }) {
  const session = state.selectedSession
  const snapshotRef = useRef<HTMLDivElement>(null)
  const exportingRef = useRef(false)
  const [isExporting, setIsExporting] = useState(false)
  const [exportError, setExportError] = useState('')

  async function handleExport() {
    if (!snapshotRef.current || !session || exportingRef.current) return
    exportingRef.current = true
    setIsExporting(true)
    setExportError('')
    try {
      await exportSnapshot(snapshotRef.current, session.name)
    } catch (error) {
      console.error('Snapshot export failed:', error)
      setExportError('Could not export the image. Please try again.')
    } finally {
      exportingRef.current = false
      setIsExporting(false)
    }
  }

  if (!session || !session.snapshot) {
    return (
      <>
        <PageHeader title="Performance telemetry" />
        <div className="panel-card empty-state">
          <p className="eyebrow">No Session Selected</p>
          <h2>Connect to a device first</h2>
          <p>Use the Sessions page to start a device poller, then return here for CPU, RAM, and process detail.</p>
        </div>
      </>
    )
  }

  const ramSegments: PieSegment[] = session.snapshot.memory
    ? [
        {
          label: 'Used RAM',
          value: session.snapshot.memory.used_bytes,
          color: '#0f766e',
          meta: formatBytes(session.snapshot.memory.used_bytes),
        },
        {
          label: 'Free RAM',
          value: session.snapshot.memory.free_bytes,
          color: '#dbeafe',
          meta: formatBytes(session.snapshot.memory.free_bytes),
        },
      ]
    : []

  const processSegments: PieSegment[] = !session.snapshot.processes.length
    ? []
    : (() => {
        const topProcesses = session.snapshot.processes.slice(0, 6)
        const segments = topProcesses.map((process, index) => ({
          label: `${process.name} [${process.pid}]`,
          value: process.rss_bytes,
          color: processPalette[index % processPalette.length],
          meta: `${formatBytes(process.rss_bytes)} RSS`,
        }))
        const remaining = session.snapshot.processes
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

  return (
    <div className="performance-snapshot" ref={snapshotRef}>
      <PageHeader
        title={session.name}
        actions={
          <button
            type="button"
            className="ghost-button snapshot-export-button"
            onClick={() => void handleExport()}
            disabled={isExporting}
            aria-busy={isExporting}
            data-export-exclude
          >
            <ExportIcon className="action-icon" />
            {isExporting ? 'Exporting…' : 'Export Image'}
          </button>
        }
      />
      <p className="performance-snapshot-meta">
        {session.host} · Sample: {formatTimestamp(session.snapshot.timestamp)}
        {session.snapshot.uptime ? ` · Uptime: ${session.snapshot.uptime}` : ''}
      </p>
      {exportError ? <p className="snapshot-export-error" role="alert" data-export-exclude>{exportError}</p> : null}

      <section className="dashboard-grid">
        <MemoryOverviewCard
          title="Overall RAM"
          totalLabel={session.snapshot.memory ? formatBytes(session.snapshot.memory.total_bytes) : 'No sample'}
          segments={ramSegments}
          history={session.snapshot.history}
        />
        <DonutChart
          title="Process RSS"
          totalLabel={`${session.snapshot.processes.length} processes`}
          segments={processSegments}
        />
        <ProcessTable processes={session.snapshot.processes} />
      </section>
    </div>
  )
}
