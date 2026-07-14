import { useState, type PropsWithChildren } from 'react'
import type { useMemWatcherState } from '../state/useMemWatcherState'
import { AppHeader } from './AppHeader'
import { Sidebar } from './Sidebar'

type AppState = ReturnType<typeof useMemWatcherState>

export function AppShell({ state, children }: PropsWithChildren<{ state: AppState }>) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  return (
    <main className="launcher-shell">
      <AppHeader
        state={state}
        sidebarCollapsed={sidebarCollapsed}
        onToggleSidebar={() => setSidebarCollapsed((current) => !current)}
      />
      <div className={`app-frame ${sidebarCollapsed ? 'app-frame-collapsed' : ''}`}>
        <Sidebar state={state} collapsed={sidebarCollapsed} />
        <section className="content-panel">{children}</section>
      </div>
    </main>
  )
}
