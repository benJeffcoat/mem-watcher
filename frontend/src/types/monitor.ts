export type PageKey = 'dashboard' | 'sessions' | 'performance'

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

export type CPUSnapshot = {
  used_percent: number
  user_percent: number
  sys_percent: number
  idle_percent: number
  load_1m: number
  load_5m: number
  load_15m: number
}

export type UtilizationPoint = {
  timestamp: string
  usedPercent: number
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
  cpu: CPUSnapshot | null
  processes: ProcessInfo[]
  error: string | null
  history: HistoryPoint[]
  cpu_history: UtilizationPoint[]
}

export type SessionResponse = {
  session_id: string
  snapshot: DeviceSnapshot
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
