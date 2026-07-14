import type { FormEvent } from 'react'
import type { useMemWatcherState } from '../state/useMemWatcherState'
import { ActiveSessionCard } from '../widgets/ActiveSessionCard'
import { PageHeader } from '../widgets/PageHeader'
import { SavedSessionCard } from '../widgets/SavedSessionCard'
import { SessionForm } from '../widgets/SessionForm'
import { StatChip } from '../widgets/StatChip'

type AppState = ReturnType<typeof useMemWatcherState>

export function SessionsPage({ state }: { state: AppState }) {
  function handleConnect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void state.connectSession(state.draft)
  }

  return (
    <>
      <PageHeader
        title="Sessions"
        actions={
          <>
            <StatChip label="Saved" value={state.summary.savedCount} />
            <StatChip label="Live" value={state.summary.activeCount} />
          </>
        }
      />

      <section className="sessions-layout">
        <SessionForm
          draft={state.draft}
          isConnecting={state.isConnecting}
          canSaveDraft={state.canSaveDraft}
          isEditingSavedSession={Boolean(state.editingSavedSessionId)}
          error={state.globalError}
          onChange={state.setDraft}
          onConnect={handleConnect}
          onSave={state.saveDraftSession}
        />

        <div className="sessions-columns">
          <section className="panel-card">
            <div className="card-head">
              <div>
                <p className="eyebrow">Saved Profiles</p>
              </div>
            </div>
            <div className="stack-list">
              {state.savedSessions.length === 0 ? (
                <div className="empty-copy">No saved sessions yet.</div>
              ) : (
                state.savedSessions.map((session) => (
                  <SavedSessionCard
                    key={session.id}
                    session={session}
                    onLoad={() => state.loadSavedSession(session)}
                    onEdit={() => state.editSavedSession(session)}
                    onDelete={() => state.deleteSavedSession(session.id)}
                  />
                ))
              )}
            </div>
          </section>

          <section className="panel-card">
            <div className="card-head">
              <div>
                <p className="eyebrow">Active Pollers</p>
              </div>
            </div>
            <div className="stack-list">
              {state.activeSessions.length === 0 ? (
                <div className="empty-copy">No active sessions.</div>
              ) : (
                state.activeSessions.map((session) => (
                  <ActiveSessionCard
                    key={session.sessionId}
                    session={session}
                    selected={state.selectedSessionId === session.sessionId}
                    onSelect={() => state.setSelectedSessionId(session.sessionId)}
                    onDisconnect={() => void state.disconnectSession(session.sessionId)}
                  />
                ))
              )}
            </div>
          </section>
        </div>
      </section>
    </>
  )
}
