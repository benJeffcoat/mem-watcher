import type { FormEvent } from 'react'
import type { ConnectionDraft } from '../types/monitor'

export function SessionForm({
  draft,
  isConnecting,
  canSaveDraft,
  isEditingSavedSession,
  error,
  onChange,
  onConnect,
  onSave,
}: {
  draft: ConnectionDraft
  isConnecting: boolean
  canSaveDraft: boolean
  isEditingSavedSession: boolean
  error: string | null
  onChange: (next: ConnectionDraft) => void
  onConnect: (event: FormEvent<HTMLFormElement>) => void
  onSave: () => void
}) {
  return (
    <form className="panel-card session-form-card" onSubmit={onConnect}>
      <div className="card-head">
        <div>
          <p className="eyebrow">Session Builder</p>
        </div>
      </div>
      <label>
        <span>Session Name</span>
        <input value={draft.name} onChange={(event) => onChange({ ...draft, name: event.target.value })} required />
      </label>
      <label>
        <span>IP Address / Host</span>
        <input value={draft.host} onChange={(event) => onChange({ ...draft, host: event.target.value })} required />
      </label>
      <div className="field-row">
        <label>
          <span>Username</span>
          <input
            value={draft.username}
            onChange={(event) => onChange({ ...draft, username: event.target.value })}
            required
          />
        </label>
        <label>
          <span>SSH Port</span>
          <input value={draft.port} onChange={(event) => onChange({ ...draft, port: event.target.value })} required />
        </label>
      </div>
      <label>
        <span>Password</span>
        <input
          type="password"
          value={draft.password}
          onChange={(event) => onChange({ ...draft, password: event.target.value })}
          required
        />
      </label>
      <div className="session-form-actions">
        <button className="ghost-button" type="button" onClick={onSave} disabled={!canSaveDraft}>
          {isEditingSavedSession ? 'Save Changes' : 'Save Draft'}
        </button>
        <button className="connect-button" type="submit" disabled={isConnecting}>
          {isConnecting ? 'Connecting...' : 'Connect'}
        </button>
      </div>
      {error ? <div className="error-banner">{error}</div> : null}
    </form>
  )
}
