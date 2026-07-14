import { useMemo } from 'react'
import { AppShell } from '../layouts/AppShell'
import { DashboardPage } from '../pages/DashboardPage'
import { PerformancePage } from '../pages/PerformancePage'
import { SessionsPage } from '../pages/SessionsPage'
import { useMemWatcherState } from '../state/useMemWatcherState'
import './app.css'

export function MemWatcherApp() {
  const state = useMemWatcherState()

  const content = useMemo(() => {
    if (state.page === 'sessions') {
      return <SessionsPage state={state} />
    }
    if (state.page === 'performance') {
      return <PerformancePage state={state} />
    }
    return <DashboardPage state={state} />
  }, [state])

  return <AppShell state={state}>{content}</AppShell>
}
