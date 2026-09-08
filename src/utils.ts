export function newId(): string { return crypto.randomUUID() }

export function nowIso(): string { return new Date().toISOString() }

export function formatDate(value: string, withTime = false): string {
  if (!value) return '未设置'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('zh-CN', withTime
    ? { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }
    : { year: 'numeric', month: 'short', day: 'numeric' }).format(date)
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds)) return '0:00'
  const minutes = Math.floor(seconds / 60)
  return `${minutes}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`
}

export function goalProgress(completed: boolean[], status?: string): number {
  if (status === 'completed') return 100
  if (completed.length === 0) return 0
  return Math.round((completed.filter(Boolean).length / completed.length) * 100)
}

export function isOverdue(date: string, completed = false): boolean {
  if (!date || completed) return false
  const end = new Date(`${date}T23:59:59`)
  return end.getTime() < Date.now()
}

export function extractText(node: unknown): string {
  if (!node || typeof node !== 'object') return ''
  const value = node as { text?: string; content?: unknown[] }
  return [value.text || '', ...(value.content || []).map(extractText)].join(' ')
}
