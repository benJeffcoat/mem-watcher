import type { LogEntry } from '../types/monitor'
import { CopyIcon } from './Icons'

function levelClassName(level: string) {
  const normalized = level.toLowerCase()
  if (normalized === 'error') {
    return 'log-level-error'
  }
  if (normalized === 'warning' || normalized === 'warn') {
    return 'log-level-warn'
  }
  return 'log-level-notice'
}

export function LogViewer({
  entries,
  copied,
  onCopy,
}: {
  entries: LogEntry[]
  copied: boolean
  onCopy: () => void
}) {
  return (
    <section className="panel-card log-viewer-card">
      <div className="card-head">
        <div>
          <p className="eyebrow">Log Output</p>
        </div>
        <div className="log-viewer-actions">
          <span className="log-result-count">{entries.length} lines</span>
          <button
            type="button"
            className={`icon-button ${copied ? 'icon-button-primary' : ''}`}
            onClick={onCopy}
            aria-label="Copy visible logs"
            title={copied ? 'Copied' : 'Copy visible logs'}
          >
            <CopyIcon className="action-icon" />
          </button>
        </div>
      </div>

      <div className="log-scroll">
        {entries.length === 0 ? (
          <div className="empty-copy">No log lines match the current filters.</div>
        ) : (
          <div className="log-list">
            {entries.map((entry, index) => (
              <article className="log-row" key={`${entry.line_number ?? index}-${entry.timestamp ?? index}`}>
                <div className="log-row-meta">
                  <span className="log-line-number">{entry.line_number ?? index + 1}</span>
                  <span className={`log-level-pill ${levelClassName(entry.level)}`}>{entry.level}</span>
                  <span className="log-source">{entry.source}</span>
                  <span className="log-timestamp">{entry.timestamp ?? 'No timestamp'}</span>
                </div>
                <p className="log-message">{entry.message}</p>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
