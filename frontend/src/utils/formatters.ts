export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
  }
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(0)} KB`
  }
  return `${bytes} B`
}

export function formatTimestamp(value: string | null): string {
  if (!value) {
    return 'No sample yet'
  }
  return new Date(value).toLocaleString()
}

export function formatCpu(totalCpu: number): string {
  return `${totalCpu.toFixed(1)}%`
}
