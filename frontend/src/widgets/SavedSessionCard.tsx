import type { SavedSession } from '../types/monitor'
import { DeleteIcon, EditIcon, LoadIcon } from './Icons'

export function SavedSessionCard({
  session,
  onLoad,
  onEdit,
  onDelete,
}: {
  session: SavedSession
  onLoad: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <article className="panel-card saved-card">
      <div className="saved-card-copy">
        <strong>{session.name}</strong>
      </div>
      <div className="saved-card-main">
        <dl className="saved-card-meta">
          <div>
            <dt>IP</dt>
            <dd>{session.host}</dd>
          </div>
          <div>
            <dt>User</dt>
            <dd>{session.username}</dd>
          </div>
          <div>
            <dt>Port</dt>
            <dd>{session.port}</dd>
          </div>
        </dl>
        <div className="session-card-actions">
          <button type="button" className="icon-button" onClick={onLoad} aria-label="Load session" title="Load">
            <LoadIcon className="action-icon" />
          </button>
          <button type="button" className="icon-button" onClick={onEdit} aria-label="Edit session" title="Edit">
            <EditIcon className="action-icon" />
          </button>
          <button type="button" className="icon-button" onClick={onDelete} aria-label="Delete session" title="Delete">
            <DeleteIcon className="action-icon" />
          </button>
        </div>
      </div>
    </article>
  )
}
