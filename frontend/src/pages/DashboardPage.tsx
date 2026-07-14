import type { useMemWatcherState } from '../state/useMemWatcherState'
import { ActiveSessionCard } from '../widgets/ActiveSessionCard'
import { PageHeader } from '../widgets/PageHeader'
import { StatChip } from '../widgets/StatChip'

type AppState = ReturnType<typeof useMemWatcherState>

export function DashboardPage({ state }: { state: AppState }) {
  return (
    <>
      <PageHeader
        title="Active sessions"
        actions={
          <>
            <StatChip label="Active" value={state.summary.activeCount} />
            <StatChip label="Connected" value={state.summary.connectedCount} />
            <StatChip label="Saved" value={state.summary.savedCount} />
          </>
        }
      />

      <section className="session-grid">
        {state.activeSessions.length === 0 ? (
          <div className="panel-card empty-state">
            <p className="eyebrow">No Active Sessions</p>
            <h2>Nothing connected</h2>
          </div>
        ) : (
          state.activeSessions.map((session) => (
            <ActiveSessionCard
              key={session.sessionId}
              session={session}
              selected={state.selectedSessionId === session.sessionId}
              onSelect={() => {
                state.setSelectedSessionId(session.sessionId)
                state.setPage('performance')
              }}
              onDisconnect={() => void state.disconnectSession(session.sessionId)}
            />
          ))
        )}
      </section>
    </>
  )
}
