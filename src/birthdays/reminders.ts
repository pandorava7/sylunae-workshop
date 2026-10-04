import type { BirthdayPerson, BirthdaySettings, BirthdayState } from '../shared/types'

export const defaultBirthdaySettings: BirthdaySettings = {
  enabled: true, daysBefore: 7, time: '09:00', repeatCount: 2,
  intervalHours: 168, external: false, toast: true,
}

export function validBirthdayDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return year >= 100 && date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
}

export function normalizeBirthdays(value?: Partial<BirthdayState>): BirthdayState {
  const settings = value?.settings
  const bounded = (number: unknown, fallback: number, min: number, max: number) => typeof number === 'number' && Number.isInteger(number) && number >= min && number <= max ? number : fallback
  return {
    people: Array.isArray(value?.people) ? value.people.filter((person) => person && typeof person.id === 'string' && typeof person.name === 'string' && person.name.trim() && validBirthdayDate(person.date)).map((person) => ({ ...person, enabled: person.enabled !== false })) : [],
    settings: {
      enabled: settings?.enabled !== false,
      daysBefore: bounded(settings?.daysBefore, 7, 0, 365),
      time: typeof settings?.time === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(settings.time) ? settings.time : '09:00',
      repeatCount: bounded(settings?.repeatCount, 2, 1, 20),
      intervalHours: bounded(settings?.intervalHours, 168, 1, 8760),
      external: settings?.external === true, toast: settings?.toast !== false,
    },
    deliveries: Object.fromEntries(Object.entries(value?.deliveries ?? {}).filter(([id, record]) => typeof id === 'string' && record && /^\d{4}-\d{2}-\d{2}$/.test(record.occurrence) && Number.isInteger(record.count) && record.count >= 0 && Number.isFinite(Date.parse(record.lastSentAt)))),
  }
}

function inYear(person: BirthdayPerson, year: number): Date {
  const [, month, day] = person.date.split('-').map(Number)
  // February 29 is observed on February 28 in non-leap years.
  return new Date(year, month - 1, Math.min(day, new Date(year, month, 0).getDate()))
}

export function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function nextBirthday(person: BirthdayPerson, now = new Date()): Date {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const date = inYear(person, today.getFullYear())
  return date < today ? inYear(person, today.getFullYear() + 1) : date
}

export function daysUntil(date: Date, now = new Date()): number {
  return Math.round((Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())) / 86400000)
}

export function dueBirthdayReminders(state: BirthdayState, now = new Date()) {
  const { settings } = state
  if (!settings.enabled || (!settings.toast && !settings.external)) return []
  return state.people.flatMap((person) => {
    if (!person.enabled) return []
    const birthday = nextBirthday(person, now)
    const start = new Date(birthday)
    start.setDate(start.getDate() - settings.daysBefore)
    const [hours, minutes] = settings.time.split(':').map(Number)
    start.setHours(hours, minutes, 0, 0)
    if (now < start) return []
    const occurrence = localDateKey(birthday)
    const previous = state.deliveries[person.id]
    const sent = previous?.occurrence === occurrence ? previous : undefined
    if (sent && (sent.count >= settings.repeatCount || now.getTime() - Date.parse(sent.lastSentAt) < settings.intervalHours * 3600000)) return []
    const remaining = daysUntil(birthday, now)
    return [{ person, occurrence, count: (sent?.count ?? 0) + 1, body: remaining === 0 ? `今天是 ${person.name} 的生日，生日快乐！` : `${person.name} 的生日还有 ${remaining} 天（${birthday.getMonth() + 1}月${birthday.getDate()}日）。` }]
  })
}
