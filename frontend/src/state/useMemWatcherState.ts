import { useEffect, useMemo, useRef, useState } from 'react'
import type {
  ActiveSession,
  ConnectionDraft,
  DeviceSnapshot,
  PageKey,
  SavedSession,
  SessionResponse,
} from '../types/monitor'
import { loadSavedSessions, persistSavedSessions } from '../utils/sessionStorage'

type ConnectTarget = ConnectionDraft & { savedSessionId?: string | null }
type PolledSession = ActiveSession | null

function isDraftComplete(draft: ConnectionDraft) {
  return Boolean(
    draft.name.trim() &&
      draft.host.trim() &&
      draft.username.trim() &&
      draft.port.trim() &&
      Number(draft.port) > 0,
  )
}

export function useMemWatcherState() {
  const [page, setPage] = useState<PageKey>('dashboard')
  const [draft, setDraft] = useState<ConnectionDraft>({
    name: 'New Session',
    host: '',
    username: 'admin',
    password: '',
    port: '22',
  })
  const [savedSessions, setSavedSessions] = useState<SavedSession[]>(() => loadSavedSessions())
  const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([])
  const [editingSavedSessionId, setEditingSavedSessionId] = useState<string | null>(null)
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [globalError, setGlobalError] = useState<string | null>(null)
  const activeSessionsRef = useRef<ActiveSession[]>([])

  useEffect(() => {
    activeSessionsRef.current = activeSessions
  }, [activeSessions])

  useEffect(() => {
    persistSavedSessions(savedSessions)
  }, [savedSessions])

  useEffect(() => {
    const intervalId = window.setInterval(async () => {
      const currentSessions = activeSessionsRef.current
      if (!currentSessions.length) {
        return
      }
      const refreshed = await Promise.all<PolledSession>(
        currentSessions.map(async (session) => {
          try {
            const response = await fetch(`/api/sessions/${session.sessionId}`)
            if (response.status === 404) {
              return null
            }
            if (!response.ok) {
              return { ...session, error: 'Polling session failed.' }
            }
            const snapshot = (await response.json()) as DeviceSnapshot
            return { ...session, snapshot, error: snapshot.error }
          } catch (error) {
            return {
              ...session,
              error: error instanceof Error ? error.message : 'Polling session failed.',
            }
          }
        }),
      )
      const nextSessions = refreshed.filter((session): session is ActiveSession => Boolean(session))
      setActiveSessions(nextSessions)
      setSelectedSessionId((current) => {
        if (!current) {
          return nextSessions[0]?.sessionId ?? null
        }
        return nextSessions.some((session) => session.sessionId === current)
          ? current
          : nextSessions[0]?.sessionId ?? null
      })
    }, 3000)
    return () => window.clearInterval(intervalId)
  }, [])

  useEffect(() => {
    return () => {
      activeSessionsRef.current.forEach((session) => {
        void fetch(`/api/sessions/${session.sessionId}`, { method: 'DELETE' })
      })
    }
  }, [])

  const selectedSession =
    activeSessions.find((session) => session.sessionId === selectedSessionId) ?? activeSessions[0] ?? null

  async function connectSession(target: ConnectTarget) {
    setIsConnecting(true)
    setGlobalError(null)
    try {
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
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
        savedSessionId: target.savedSessionId ?? null,
        name: target.name || target.host,
        host: target.host,
        username: target.username,
        port: Number(target.port),
        snapshot: payload.snapshot,
        error: payload.snapshot.error,
      }
      setActiveSessions((current) => [nextSession, ...current.filter((item) => item.host !== nextSession.host)])
      setSelectedSessionId(payload.session_id)
      setDraft((current) => ({ ...current, password: '' }))
      if (target.savedSessionId) {
        setSavedSessions((current) =>
          current.map((item) =>
            item.id === target.savedSessionId ? { ...item, lastUsedAt: new Date().toISOString() } : item,
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
    await fetch(`/api/sessions/${sessionId}`, { method: 'DELETE' })
    setActiveSessions((current) => current.filter((session) => session.sessionId !== sessionId))
    setSelectedSessionId((current) => (current === sessionId ? null : current))
  }

  function saveDraftSession() {
    if (!isDraftComplete(draft)) {
      setGlobalError('Complete name, host, username, and port before saving.')
      return
    }
    setGlobalError(null)
    if (editingSavedSessionId) {
      setSavedSessions((current) =>
        current.map((session) =>
          session.id === editingSavedSessionId
            ? {
                ...session,
                name: draft.name.trim() || draft.host.trim(),
                host: draft.host.trim(),
                username: draft.username.trim(),
                port: Number(draft.port),
              }
            : session,
        ),
      )
      setEditingSavedSessionId(null)
      return
    }
    const nextSession: SavedSession = {
      id: crypto.randomUUID(),
      name: draft.name.trim() || draft.host.trim(),
      host: draft.host.trim(),
      username: draft.username.trim(),
      port: Number(draft.port),
      lastUsedAt: null,
    }
    setSavedSessions((current) => [nextSession, ...current])
  }

  function loadSavedSession(session: SavedSession) {
    setEditingSavedSessionId(null)
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

  function deleteSavedSession(sessionId: string) {
    setSavedSessions((current) => current.filter((session) => session.id !== sessionId))
    setEditingSavedSessionId((current) => (current === sessionId ? null : current))
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
    setDraft,
    savedSessions,
    activeSessions,
    editingSavedSessionId,
    selectedSessionId,
    setSelectedSessionId,
    selectedSession,
    isConnecting,
    canSaveDraft: isDraftComplete(draft),
    globalError,
    summary,
    connectSession,
    disconnectSession,
    saveDraftSession,
    loadSavedSession,
    editSavedSession,
    deleteSavedSession,
  }
}
