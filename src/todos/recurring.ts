import type { RecurringTodo } from '../shared/types'

const dayMs = 86_400_000

export function localDateKey(value = new Date()): string {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function dateAtMidnight(key: string): Date {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function daysBetween(startDate: string, occurrenceDate: string): number {
  return Math.round((dateAtMidnight(occurrenceDate).getTime() - dateAtMidnight(startDate).getTime()) / dayMs)
}

export function occursOnDate(todo: RecurringTodo, occurrenceDate: string): boolean {
  if (todo.paused || occurrenceDate < todo.startDate) return false
  const date = dateAtMidnight(occurrenceDate)
  if (todo.frequency === 'daily') return true
  if (todo.frequency === 'weekly') return (todo.weekdays?.length ? todo.weekdays : [dateAtMidnight(todo.startDate).getDay()]).includes(date.getDay())
  if (todo.frequency === 'monthly') return date.getDate() === Math.min(todo.dayOfMonth ?? dateAtMidnight(todo.startDate).getDate(), new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate())
  const interval = Math.max(1, todo.intervalDays ?? 1)
  return daysBetween(todo.startDate, occurrenceDate) % interval === 0
}

export function recurringLabel(todo: RecurringTodo): string {
  if (todo.frequency === 'daily') return '每天'
  if (todo.frequency === 'weekly') {
    const names = ['日', '一', '二', '三', '四', '五', '六']
    const weekdays = todo.weekdays?.length ? todo.weekdays : [dateAtMidnight(todo.startDate).getDay()]
    return `每周${weekdays.sort((a, b) => a - b).map((day) => names[day]).join('、')}`
  }
  if (todo.frequency === 'monthly') return `每月 ${todo.dayOfMonth ?? dateAtMidnight(todo.startDate).getDate()} 日`
  return `每 ${Math.max(1, todo.intervalDays ?? 1)} 天`
}
