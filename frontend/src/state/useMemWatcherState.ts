import { useEffect, useMemo, useRef, useState } from 'react'
import type {
  ActiveSession,
  ConnectionDraft,
  LogResponse,
  PageKey,
  SavedSession,
  SessionResponse,
} from '../types/monitor'
import { loadSavedSessions, clearSavedSessions } from '../utils/sessionStorage'

type ConnectTarget = ConnectionDraft & { savedSessionId?: string | null }
type BuilderMode = 'create' | 'connectSaved' | 'editSaved'

function isDraftComplete(draft: ConnectionDraft) {
  return Boolean(
    draft.name.trim() &&
      draft.host.trim() &&
      draft.username.trim() &&
      draft.port.trim() &&
      Number(draft.port) > 0,
  )
}

function buildDefaultDraft(): ConnectionDraft {
  return {
    name: 'New Session',
    host: '',
    username: 'admin',
    password: '',
    port: '22',
  }
}

export function useMemWatcherState() {
  const [page, setPage] = useState<PageKey>('dashboard')
  const [draft, setDraft] = useState<ConnectionDraft>(buildDefaultDraft)
  const [builderMode, setBuilderMode] = useState<BuilderMode>('create')
  const [savedSessions, setSavedSessions] = useState<SavedSession[]>([])
  const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([])
  const [editingSavedSessionId, setEditingSavedSessionId] = useState<string | null>(null)
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [logsBySession, setLogsBySession] = useState<Record<string, LogResponse | undefined>>({})
  const [logsLoadingBySession, setLogsLoadingBySession] = useState<Record<string, boolean>>({})
  const [logsErrorBySession, setLogsErrorBySession] = useState<Record<string, string | null>>({})
  const [isConnecting, setIsConnecting] = useState(false)
  const [globalError, setGlobalError] = useState<string | null>(null)
  const sessionRevision = useRef(0)

  useEffect(() => {
    let cancelled = false
    let polling = false

    async function restoreProfiles() {
      try {
        // Import existing browser profiles once, without replacing backend copies.
        const legacy = loadSavedSessions()
        const response = await fetch(legacy.length ? '/api/saved-sessions/import' : '/api/saved-sessions',
          legacy.length ? {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(legacy),
          } : undefined)
        if (!response.ok) throw new Error('Could not load saved sessions.')
        const profiles = await response.json() as SavedSession[]
        if (cancelled) return
        setSavedSessions(profiles)
        clearSavedSessions()
      } catch (error) {
        if (!cancelled) setGlobalError(error instanceof Error ? error.message : 'Could not load saved sessions.')
      }
    }

    async function refreshSessions() {
      if (polling) return
      polling = true
      const revision = sessionRevision.current
      try {
        const response = await fetch('/api/sessions')
        if (!response.ok) throw new Error('Could not load active sessions.')
        const sessions = await response.json() as ActiveSession[]
        if (cancelled || revision !== sessionRevision.current) return
        setActiveSessions(sessions)
        setSelectedSessionId((current) => sessions.some((session) => session.sessionId === current)
          ? current : sessions[0]?.sessionId ?? null)
      } catch (error) {
        if (!cancelled && revision === sessionRevision.current) {
          setActiveSessions((current) => current.map((session) => ({
            ...session,
            error: error instanceof Error ? error.message : 'Polling session failed.',
          })))
          setGlobalError(error instanceof Error ? error.message : 'Could not load active sessions.')
        }
      } finally {
        polling = false
      }
    }

    void restoreProfiles()
    void refreshSessions()
    const intervalId = window.setInterval(() => void refreshSessions(), 3000)
    // Connections belong to the backend; only an explicit Disconnect closes them.
    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [])

  const selectedSession =
    activeSessions.find((session) => session.sessionId === selectedSessionId) ?? activeSessions[0] ?? null

  async function connectSession(target: ConnectTarget) {
    const savedSessionId = target.savedSessionId ?? savedSessions.find((session) =>
      session.name === target.name && session.host === target.host &&
      session.username === target.username && session.port === Number(target.port))?.id ?? null
    setIsConnecting(true)
    setGlobalError(null)
    try {
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: target.name,
          savedSessionId,
          host: target.host,
          username: target.username,
          password: target.password,
          port: Number(target.port),
        }),
      })
      const payload = (await response.json()) as SessionResponse | { detail?: string }
      if (!response.ok || !('session_id' in payload)) {
        setGlobalError('detail' in payload ? payload.detail ?? 'Connection failed.' : 'Connection failed.')
        return
      }
      const nextSession: ActiveSession = {
        sessionId: payload.session_id,
        savedSessionId,
        name: target.name || target.host,
        host: target.host,
        username: target.username,
        port: Number(target.port),
        snapshot: payload.snapshot,
        error: payload.snapshot.error,
      }
      sessionRevision.current += 1
      setActiveSessions((current) => [nextSession, ...current])
      setSelectedSessionId(payload.session_id)
      setDraft((current) => ({ ...current, password: '' }))
      setBuilderMode('create')
      if (savedSessionId) {
        setSavedSessions((current) =>
          current.map((item) =>
            item.id === savedSessionId ? { ...item, lastUsedAt: new Date().toISOString() } : item,
          ),
        )
      }
      setPage('dashboard')
    } catch (error) {
      setGlobalError(error instanceof Error ? error.message : 'Connection failed.')
    } finally {
      setIsConnecting(false)
    }
  }

  async function disconnectSession(sessionId: string) {
    try {
      const response = await fetch(`/api/sessions/${sessionId}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Could not disconnect session.')
    } catch (error) {
      setGlobalError(error instanceof Error ? error.message : 'Could not disconnect session.')
      return
    }
    sessionRevision.current += 1
    setActiveSessions((current) => current.filter((session) => session.sessionId !== sessionId))
    setSelectedSessionId((current) => (current === sessionId ? null : current))
    setLogsBySession((current) => {
      const next = { ...current }
      delete next[sessionId]
      return next
    })
    setLogsLoadingBySession((current) => {
      const next = { ...current }
      delete next[sessionId]
      return next
    })
    setLogsErrorBySession((current) => {
      const next = { ...current }
      delete next[sessionId]
      return next
    })
  }

  async function fetchSessionLogs(sessionId: string, command: string) {
    setLogsLoadingBySession((current) => ({ ...current, [sessionId]: true }))
    setLogsErrorBySession((current) => ({ ...current, [sessionId]: null }))
    try {
      const response = await fetch(`/api/sessions/${sessionId}/logs?command=${encodeURIComponent(command)}`)
      const payload = (await response.json()) as LogResponse | { detail?: string }
      if (!response.ok || !('command' in payload)) {
        const message = 'detail' in payload ? payload.detail ?? 'Log request failed.' : 'Log request failed.'
        setLogsErrorBySession((current) => ({ ...current, [sessionId]: message }))
        return null
      }
      setLogsBySession((current) => ({ ...current, [sessionId]: payload }))
      return payload
    } catch (error) {
      setLogsErrorBySession((current) => ({
        ...current,
        [sessionId]: error instanceof Error ? error.message : 'Log request failed.',
      }))
      return null
    } finally {
      setLogsLoadingBySession((current) => ({ ...current, [sessionId]: false }))
    }
  }

  async function saveDraftSession() {
    if (!isDraftComplete(draft)) {
      setGlobalError('Complete name, host, username, and port before saving.')
      return
    }
    const previous = savedSessions.find((session) => session.id === editingSavedSessionId)
    const profile: SavedSession = {
      id: editingSavedSessionId ?? crypto.randomUUID(),
      name: draft.name.trim(),
      host: draft.host.trim(),
      username: draft.username.trim(),
      port: Number(draft.port),
      lastUsedAt: previous?.lastUsedAt ?? null,
    }
    try {
      const response = await fetch(`/api/saved-sessions/${profile.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
      })
      if (!response.ok) throw new Error('Could not save session.')
      const saved = await response.json() as SavedSession
      setSavedSessions((current) => [saved, ...current.filter((session) => session.id !== saved.id)])
      setGlobalError(null)
      setEditingSavedSessionId(null)
      setDraft(buildDefaultDraft())
      setBuilderMode('create')
    } catch (error) {
      setGlobalError(error instanceof Error ? error.message : 'Could not save session.')
    }
  }

  function loadSavedSession(session: SavedSession) {
    setEditingSavedSessionId(null)
    setBuilderMode('connectSaved')
    setGlobalError(null)
    setDraft({
      name: session.name,
      host: session.host,
      username: session.username,
      password: '',
      port: String(session.port),
    })
    setPage('sessions')
  }

  function editSavedSession(session: SavedSession) {
    setEditingSavedSessionId(session.id)
    setBuilderMode('editSaved')
    setGlobalError(null)
    setDraft({
      name: session.name,
      host: session.host,
      username: session.username,
      password: '',
      port: String(session.port),
    })
    setPage('sessions')
  }

  async function deleteSavedSession(sessionId: string) {
    try {
      const response = await fetch(`/api/saved-sessions/${sessionId}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Could not delete saved session.')
      setSavedSessions((current) => current.filter((session) => session.id !== sessionId))
      setEditingSavedSessionId((current) => (current === sessionId ? null : current))
    } catch (error) {
      setGlobalError(error instanceof Error ? error.message : 'Could not delete saved session.')
    }
  }

  function cancelEditSavedSession() {
    setEditingSavedSessionId(null)
    setBuilderMode('create')
    setGlobalError(null)
    setDraft(buildDefaultDraft())
  }

  const summary = useMemo(() => {
    const connectedCount = activeSessions.filter((session) => session.snapshot?.connected).length
    return {
      connectedCount,
      activeCount: activeSessions.length,
      savedCount: savedSessions.length,
    }
  }, [activeSessions, savedSessions])

  return {
    page,
    setPage,
    draft,
    builderMode,
    setDraft,
    savedSessions,
    activeSessions,
    editingSavedSessionId,
    selectedSessionId,
    setSelectedSessionId,
    selectedSession,
    isConnecting,
    logsBySession,
    logsLoadingBySession,
    logsErrorBySession,
    canSaveDraft: isDraftComplete(draft),
    globalError,
    summary,
    connectSession,
    disconnectSession,
    saveDraftSession,
    loadSavedSession,
    editSavedSession,
    cancelEditSavedSession,
    deleteSavedSession,
    fetchSessionLogs,
  }
}
