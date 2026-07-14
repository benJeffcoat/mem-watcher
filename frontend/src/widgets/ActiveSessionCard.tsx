import type { ActiveSession } from '../types/monitor'
import { formatTimestamp } from '../utils/formatters'
import { DisconnectIcon, ViewIcon } from './Icons'

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
    <article className={`panel-card saved-card active-card ${selected ? 'session-card-selected' : ''}`}>
      <div className="saved-card-copy">
        <strong>{session.name}</strong>
        <p>{session.host}</p>
      </div>
      <div className="saved-card-main">
        <dl className="saved-card-meta">
          <div>
            <dt>IP</dt>
            <dd>{session.host}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd className={session.snapshot?.connected ? 'meta-good' : 'meta-warn'}>
              {session.snapshot?.connected ? 'Online' : 'Offline'}
            </dd>
          </div>
          <div>
            <dt>Updated</dt>
            <dd>{formatTimestamp(session.snapshot?.timestamp ?? null)}</dd>
          </div>
        </dl>
        <div className="session-card-actions">
          <button type="button" className="icon-button" onClick={onSelect} aria-label="View session" title="View">
            <ViewIcon className="action-icon" />
          </button>
          <button
            type="button"
            className="icon-button"
            onClick={onDisconnect}
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
