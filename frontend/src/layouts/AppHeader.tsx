import type { useMemWatcherState } from '../state/useMemWatcherState'
import { MenuIcon } from '../widgets/Icons'

type AppState = ReturnType<typeof useMemWatcherState>

export function AppHeader({
  state,
  sidebarCollapsed,
  onToggleSidebar,
}: {
  state: AppState
  sidebarCollapsed: boolean
  onToggleSidebar: () => void
}) {
  const hostLabel = state.selectedSession?.host ?? (state.draft.host || 'No device selected')

  return (
    <header className="topbar">
      <div className="topbar-brand">
        <button
          type="button"
          className={`nav-toggle ${sidebarCollapsed ? 'nav-toggle-active' : ''}`}
          aria-label={sidebarCollapsed ? 'Expand navigation' : 'Collapse navigation'}
          aria-pressed={sidebarCollapsed}
          onClick={onToggleSidebar}
        >
          <MenuIcon className="chrome-icon" />
        </button>
        <div className="topbar-title">
          <strong>Coolbox</strong>
        </div>
      </div>
      <div className="topbar-meta">
        <div className="meta-pill">
          <span
            className={`status-dot ${state.selectedSession?.snapshot?.connected ? 'status-live' : 'status-idle'}`}
          />
          {state.selectedSession?.snapshot?.connected ? 'Live session' : 'Disconnected'}
        </div>
        <div className="meta-pill">{hostLabel}</div>
      </div>
    </header>
  )
}
