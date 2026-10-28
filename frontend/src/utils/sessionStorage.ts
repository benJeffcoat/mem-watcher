import type { SavedSession } from '../types/monitor'

const STORAGE_KEY = 'mem-watcher.saved-sessions'

export function loadSavedSessions(): SavedSession[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return []
    }
    const parsed = JSON.parse(raw) as SavedSession[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function clearSavedSessions(): void {
  window.localStorage.removeItem(STORAGE_KEY)
}
