import type { useMemWatcherState } from '../state/useMemWatcherState'
import type { PieSegment } from '../types/monitor'
import { formatBytes } from '../utils/formatters'
import { DonutChart } from '../widgets/DonutChart'
import { MemoryOverviewCard } from '../widgets/MemoryOverviewCard'
import { PageHeader } from '../widgets/PageHeader'
import { ProcessTable } from '../widgets/ProcessTable'

type AppState = ReturnType<typeof useMemWatcherState>

const processPalette = ['#0f766e', '#0ea5e9', '#f97316', '#b45309', '#334155', '#7c3aed', '#dc2626']

export function PerformancePage({ state }: { state: AppState }) {
  const session = state.selectedSession

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

  const cpuSegments: PieSegment[] = session.snapshot.cpu
    ? [
        {
          label: 'Used CPU',
          value: session.snapshot.cpu.used_percent,
          color: '#0284c7',
          meta: `Usr ${session.snapshot.cpu.user_percent.toFixed(1)}% · Sys ${session.snapshot.cpu.sys_percent.toFixed(1)}%`,
        },
        {
          label: 'Idle CPU',
          value: session.snapshot.cpu.idle_percent,
          color: '#dbeafe',
          meta: `${session.snapshot.cpu.idle_percent.toFixed(1)}% idle`,
        },
      ]
    : []

  const cpuMemoryHistory = session.snapshot.cpu_history
    .filter((point): point is typeof point & { memUsedPercent: number } => typeof point.memUsedPercent === 'number')
    .map((point) => ({
      timestamp: point.timestamp,
      usedPercent: point.memUsedPercent,
    }))

  const cpuMemoryDetails = session.snapshot.cpu
    ? (() => {
        const memUsed = session.snapshot.cpu.mem_used_bytes
        const memFree = session.snapshot.cpu.mem_free_bytes
        if (memUsed == null || memFree == null) {
          return []
        }

        const total = memUsed + memFree
        const usedPercent = total > 0 ? (memUsed / total) * 100 : 0
        const optionalParts = [
          session.snapshot.cpu.mem_cached_bytes == null ? null : `Cached ${formatBytes(session.snapshot.cpu.mem_cached_bytes)}`,
          session.snapshot.cpu.mem_shared_bytes == null ? null : `Shared ${formatBytes(session.snapshot.cpu.mem_shared_bytes)}`,
          session.snapshot.cpu.mem_buffer_bytes == null ? null : `Buff ${formatBytes(session.snapshot.cpu.mem_buffer_bytes)}`,
        ].filter((value): value is string => Boolean(value))

        return [
          {
            label: 'CPULoad Memory',
            value: `${formatBytes(memUsed)} used / ${formatBytes(memFree)} free`,
          },
          {
            label: 'CPULoad Usage',
            value: `${usedPercent.toFixed(1)}% used`,
          },
          ...(optionalParts.length
            ? [
                {
                  label: 'Cache, Shared, Buffer',
                  value: optionalParts.join(' | '),
                  helpText:
                    'Cached memory stores recently used files so they can be reopened quickly. Shared memory is used by more than one process. Buffer memory holds temporary file-system and device I/O data while Linux moves it between applications and hardware.',
                },
              ]
            : []),
        ]
      })()
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
    <>
      <PageHeader
        title={session.name}
      />

      <section className="dashboard-grid">
        <MemoryOverviewCard
          title="Overall RAM"
          totalLabel={session.snapshot.memory ? formatBytes(session.snapshot.memory.total_bytes) : 'No sample'}
          segments={ramSegments}
          history={session.snapshot.history}
        />
        <MemoryOverviewCard
          title="CPU Load"
          totalLabel={
            session.snapshot.cpu
              ? `Load avg ${session.snapshot.cpu.load_1m.toFixed(2)} / ${session.snapshot.cpu.load_5m.toFixed(2)} / ${session.snapshot.cpu.load_15m.toFixed(2)}`
              : 'No sample'
          }
          segments={cpuSegments}
          history={session.snapshot.cpu_history}
          secondaryHistory={cpuMemoryHistory}
          secondaryColor="#f97316"
          trendLegend={[
            { label: 'CPU used', color: '#4aa3ff' },
            { label: 'Memory used', color: '#f97316' },
          ]}
          trendTitle="CPU Trend"
          details={cpuMemoryDetails}
        />
        <DonutChart
          title="Process RSS"
          totalLabel={`${session.snapshot.processes.length} processes`}
          segments={processSegments}
        />
        <ProcessTable processes={session.snapshot.processes} />
      </section>
    </>
  )
}
