import { useEffect, useMemo, useState } from 'react'
import type { useMemWatcherState } from '../state/useMemWatcherState'
import type { LogEntry } from '../types/monitor'
import { RefreshIcon } from '../widgets/Icons'
import { LogViewer } from '../widgets/LogViewer'
import { PageHeader } from '../widgets/PageHeader'

type AppState = ReturnType<typeof useMemWatcherState>

const logCommands = ['ERRlog', 'PRINTAUDITLOG', 'GETAUDITLOG']

function buildCopyText(command: string, entries: LogEntry[]) {
  const lines = entries.map((entry) => entry.raw)
  if (!lines.length) {
    return `${command}\n`
  }
  return `${command}\n${lines.join('\n')}`
}

function filterEntries(entries: LogEntry[], levelFilter: string, sourceFilter: string) {
  return entries.filter((entry) => {
    const levelMatches = levelFilter === 'all' || entry.level === levelFilter
    const sourceMatches = sourceFilter === 'all' || entry.source === sourceFilter
    return levelMatches && sourceMatches
  })
}

export function LogsPage({ state }: { state: AppState }) {
  const session = state.selectedSession
  const [command, setCommand] = useState('ERRlog')
  const [levelFilter, setLevelFilter] = useState('all')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [copied, setCopied] = useState(false)

  const logResponse = session ? state.logsBySession[session.sessionId] : undefined
  const isLoading = session ? state.logsLoadingBySession[session.sessionId] : false
  const logError = session ? state.logsErrorBySession[session.sessionId] : null

  useEffect(() => {
    setLevelFilter('all')
    setSourceFilter('all')
    setCopied(false)
  }, [session?.sessionId])

  useEffect(() => {
    if (!session || logResponse || isLoading) {
      return
    }
    void state.fetchSessionLogs(session.sessionId, command)
  }, [command, isLoading, logResponse, session, state])

  const levels = useMemo(() => {
    if (!logResponse) {
      return []
    }
    return [...new Set(logResponse.entries.map((entry) => entry.level))].sort()
  }, [logResponse])

  const sources = useMemo(() => {
    if (!logResponse) {
      return []
    }
    return [...new Set(logResponse.entries.map((entry) => entry.source))].sort((left, right) =>
      left.localeCompare(right),
    )
  }, [logResponse])

  const filteredEntries = useMemo(() => {
    if (!logResponse) {
      return []
    }
    return filterEntries(logResponse.entries, levelFilter, sourceFilter)
  }, [levelFilter, logResponse, sourceFilter])

  async function handleCopy() {
    if (!logResponse) {
      return
    }
    await navigator.clipboard.writeText(buildCopyText(logResponse.command, filteredEntries))
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  if (!session) {
    return (
      <>
        <PageHeader title="Logs" />
        <div className="panel-card empty-state">
          <p className="eyebrow">No Session Selected</p>
          <h2>Connect to a device first</h2>
        </div>
      </>
    )
  }

  return (
    <>
      <PageHeader title="Logs" />

      <section className="logs-grid">
        <section className="panel-card log-toolbar-card">
          <div className="card-head">
            <div>
              <p className="eyebrow">Request Logs</p>
            </div>
          </div>

          <div className="logs-toolbar">
            <label>
              <span>Preset</span>
              <select value={command} onChange={(event) => setCommand(event.target.value)}>
                {logCommands.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <label className="logs-command-field">
              <span>Console Command</span>
              <input value={command} onChange={(event) => setCommand(event.target.value)} />
            </label>

            <button
              type="button"
              className="connect-button logs-fetch-button"
              onClick={() => void state.fetchSessionLogs(session.sessionId, command)}
              disabled={isLoading || !command.trim()}
            >
              <RefreshIcon className="action-icon" />
              {isLoading ? 'Loading...' : 'Request'}
            </button>
          </div>

          <div className="logs-toolbar logs-toolbar-secondary">
            <label>
              <span>Severity</span>
              <select value={levelFilter} onChange={(event) => setLevelFilter(event.target.value)}>
                <option value="all">All</option>
                {levels.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
            </label>

            <label className="logs-command-field">
              <span>Source</span>
              <select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)}>
                <option value="all">All</option>
                {sources.map((source) => (
                  <option key={source} value={source}>
                    {source}
                  </option>
                ))}
              </select>
            </label>

            <div className="log-fetch-meta">
              <span>{session.name}</span>
              <strong>{logResponse?.fetched_at ? new Date(logResponse.fetched_at).toLocaleString() : 'No fetch yet'}</strong>
            </div>
          </div>

          {logError ? <div className="error-banner">{logError}</div> : null}
        </section>

        <LogViewer entries={filteredEntries} copied={copied} onCopy={() => void handleCopy()} />
      </section>
    </>
  )
}
