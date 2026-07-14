import type { ProcessInfo } from '../types/monitor'
import { formatBytes, formatCpu } from '../utils/formatters'

export function ProcessTable({ processes }: { processes: ProcessInfo[] }) {
  const topProcesses = processes.slice(0, 10)

  return (
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
                  <td>{formatCpu(process.user_percent + process.sys_percent)}</td>
                  <td className="command-cell">{process.command}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
