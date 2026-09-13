import type { CountdownEvent, CountdownMode, CountdownRepeat } from '../shared/types'

const DAY_MS = 86_400_000

type CountdownInput = Pick<CountdownEvent, 'targetDate'> & Partial<Pick<CountdownEvent, 'targetTime' | 'precise' | 'repeat' | 'yearly' | 'mode' | 'includeStartDay'>>

export interface CountdownResult {
  occurrence: Date
  signedDays: number
  displayDays: number
  diffMs: number
  state: 'future' | 'today' | 'past'
  wording: '还有' | '已经' | '已超期' | '尚未开始' | '第'
}

function dateParts(value: string): [number, number, number] | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const parts: [number, number, number] = [Number(match[1]), Number(match[2]), Number(match[3])]
  const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]))
  return date.getUTCFullYear() === parts[0] && date.getUTCMonth() === parts[1] - 1 && date.getUTCDate() === parts[2] ? parts : null
}

function timeParts(value = ''): [number, number] {
  const match = /^(\d{2}):(\d{2})$/.exec(value)
  if (!match) return [0, 0]
  const hour = Number(match[1])
  const minute = Number(match[2])
  return hour < 24 && minute < 60 ? [hour, minute] : [0, 0]
}

function localDate(year: number, month: number, day: number, hour: number, minute: number): Date {
  const lastDay = new Date(year, month, 0).getDate()
  return new Date(year, month - 1, Math.min(day, lastDay), hour, minute, 0, 0)
}

function localDayNumber(date: Date): number {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
}

function resolvedRepeat(event: CountdownInput): CountdownRepeat {
  return event.repeat ?? (event.yearly ? 'yearly' : 'none')
}

function eventDate(event: CountdownInput): Date | null {
  const parts = dateParts(event.targetDate)
  if (!parts) return null
  const [hour, minute] = event.precise ? timeParts(event.targetTime) : [0, 0]
  return localDate(parts[0], parts[1], parts[2], hour, minute)
}

function hasOccurred(candidate: Date, today: Date, precise: boolean): boolean {
  return precise ? candidate.getTime() < today.getTime() : localDayNumber(candidate) < localDayNumber(today)
}

function nextOccurrence(event: CountdownInput, today: Date): Date | null {
  const original = eventDate(event)
  if (!original) return null
  const repeat = resolvedRepeat(event)
  if (repeat === 'none' || event.mode === 'countup') return original
  const [hour, minute] = event.precise ? timeParts(event.targetTime) : [0, 0]

  if (repeat === 'weekly') {
    const candidate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), hour, minute, 0, 0)
    const offset = (original.getDay() - candidate.getDay() + 7) % 7
    candidate.setDate(candidate.getDate() + offset)
    if (hasOccurred(candidate, today, Boolean(event.precise))) candidate.setDate(candidate.getDate() + 7)
    return candidate
  }

  if (repeat === 'monthly') {
    let candidate = localDate(today.getFullYear(), today.getMonth() + 1, original.getDate(), hour, minute)
    if (hasOccurred(candidate, today, Boolean(event.precise))) candidate = localDate(today.getFullYear(), today.getMonth() + 2, original.getDate(), hour, minute)
    return candidate
  }

  let candidate = localDate(today.getFullYear(), original.getMonth() + 1, original.getDate(), hour, minute)
  if (hasOccurred(candidate, today, Boolean(event.precise))) candidate = localDate(today.getFullYear() + 1, original.getMonth() + 1, original.getDate(), hour, minute)
  return candidate
}

export function countdownResult(event: CountdownInput, today = new Date()): CountdownResult | null {
  const occurrence = nextOccurrence(event, today)
  if (!occurrence) return null
  const signedDays = Math.round((localDayNumber(occurrence) - localDayNumber(today)) / DAY_MS)
  const diffMs = occurrence.getTime() - today.getTime()
  const state = event.precise && signedDays === 0
    ? diffMs === 0 ? 'today' : diffMs > 0 ? 'future' : 'past'
    : signedDays === 0 ? 'today' : signedDays > 0 ? 'future' : 'past'
  const mode: CountdownMode = event.mode ?? 'auto'
  const includeStart = Boolean(event.includeStartDay) && state !== 'future'
  const displayDays = Math.abs(signedDays) + (includeStart ? 1 : 0)
  const wording = includeStart && mode !== 'countdown'
    ? '第'
    : state === 'future'
    ? mode === 'countup' ? '尚未开始' : '还有'
    : state === 'past'
      ? mode === 'countdown' ? '已超期' : '已经'
      : '还有'
  return { occurrence, signedDays, displayDays, diffMs, state, wording }
}

export function countdownDays(event: CountdownInput, today = new Date()): number | null {
  return countdownResult(event, today)?.signedDays ?? null
}

export function countdownDateLabel(event: CountdownInput, today = new Date()): string {
  const result = countdownResult(event, today)
  if (!result) return '日期无效'
  if (result.state === 'today' && result.displayDays === 0) return '就是今天'
  return `${result.wording} ${result.displayDays} 天`
}

export function preciseCountdownParts(result: CountdownResult): { days: number; hours: number; minutes: number; seconds: number } {
  let seconds = Math.max(0, Math.floor(Math.abs(result.diffMs) / 1000))
  const days = Math.floor(seconds / 86_400)
  seconds %= 86_400
  const hours = Math.floor(seconds / 3_600)
  seconds %= 3_600
  const minutes = Math.floor(seconds / 60)
  return { days, hours, minutes, seconds: seconds % 60 }
}
