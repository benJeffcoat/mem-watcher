import type { useMemWatcherState } from '../state/useMemWatcherState'
import { DashboardIcon, PerformanceIcon, SessionsIcon } from '../widgets/Icons'

type AppState = ReturnType<typeof useMemWatcherState>

const navItems = [
  { key: 'dashboard', label: 'Dashboard', icon: DashboardIcon },
  { key: 'sessions', label: 'Sessions', icon: SessionsIcon },
  { key: 'performance', label: 'Performance', icon: PerformanceIcon },
] as const

export function Sidebar({ state, collapsed }: { state: AppState; collapsed: boolean }) {
  return (
    <aside
      className={`sidebar ${collapsed ? 'sidebar-collapsed' : ''}`}
      aria-hidden={collapsed}
    >
      <div className="sidebar-section">
        {navItems.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`nav-item ${state.page === item.key ? 'nav-item-active' : ''}`}
            onClick={() => state.setPage(item.key)}
            aria-label={item.label}
            title={item.label}
          >
            <item.icon className="nav-icon-svg" />
            {!collapsed ? item.label : null}
          </button>
        ))}
      </div>
    </aside>
  )
}
