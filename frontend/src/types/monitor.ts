export type PageKey = 'dashboard' | 'sessions' | 'performance' | 'logs'

export type ConnectionDraft = {
  name: string
  host: string
  username: string
  password: string
  port: string
}

export type SavedSession = {
  id: string
  name: string
  host: string
  username: string
  port: number
  lastUsedAt: string | null
}

export type ProcessInfo = {
  pid: number
  name: string
  command: string
  rss_bytes: number
  pss_bytes: number
  user_percent: number
  sys_percent: number
}

export type MemorySnapshot = {
  used_percent: number
  total_bytes: number
  used_bytes: number
  free_bytes: number
}

export type HistoryPoint = {
  timestamp: string
  usedPercent: number
  freeBytes: number
}

export type DeviceSnapshot = {
  connected: boolean
  host: string
  prompt: string
  timestamp: string | null
  uptime: string | null
  memory: MemorySnapshot | null
  processes: ProcessInfo[]
  error: string | null
  history: HistoryPoint[]
}

export type SessionResponse = {
  session_id: string
  snapshot: DeviceSnapshot
}

export type LogEntry = {
  line_number: number | null
  level: string
  source: string
  timestamp: string | null
  message: string
  raw: string
}

export type LogResponse = {
  command: string
  fetched_at: string
  entries: LogEntry[]
  raw: string
}

export type ActiveSession = {
  sessionId: string
  savedSessionId: string | null
  name: string
  host: string
  username: string
  port: number
  snapshot: DeviceSnapshot | null
  error: string | null
}

export type PieSegment = {
  label: string
  value: number
  color: string
  meta: string
}
