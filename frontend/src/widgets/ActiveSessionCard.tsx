import type { ActiveSession } from '../types/monitor'
import { formatTimestamp } from '../utils/formatters'
import { DisconnectIcon } from './Icons'

export function ActiveSessionCard({
  session,
  selected,
  onSelect,
  onDisconnect,
}: {
  session: ActiveSession
  selected: boolean
  onSelect: () => void
  onDisconnect: () => void
}) {
  return (
    <article
      className={`panel-card dashboard-active-card ${selected ? 'session-card-selected' : ''}`}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onSelect()
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`Open performance for ${session.name}`}
    >
      <div className="dashboard-active-head">
        <div className="dashboard-active-title">
          <strong>{session.name}</strong>
        </div>
        <div className={`pill ${session.snapshot?.connected ? 'pill-good' : 'pill-warn'}`}>
          {session.snapshot?.connected ? 'Online' : 'Offline'}
        </div>
      </div>
      <dl className="dashboard-active-meta">
        <div>
          <dt>IP Address</dt>
          <dd>{session.host}</dd>
        </div>
        <div>
          <dt>Last Update</dt>
          <dd>{formatTimestamp(session.snapshot?.timestamp ?? null)}</dd>
        </div>
      </dl>
      <div className="dashboard-active-actions">
        <div className="session-card-actions">
          <button
            type="button"
            className="icon-button icon-button-large icon-button-danger"
            onClick={(event) => {
              event.stopPropagation()
              onDisconnect()
            }}
            aria-label="Disconnect session"
            title="Disconnect"
          >
            <DisconnectIcon className="action-icon" />
          </button>
        </div>
      </div>
    </article>
  )
}
