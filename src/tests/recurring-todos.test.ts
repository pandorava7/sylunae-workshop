import { describe, expect, it } from 'vitest'
import type { RecurringTodo } from '../shared/types'
import { occursOnDate, recurringLabel } from '../todos/recurring'

const base: RecurringTodo = {
  id: 'routine-1', title: '拉伸', priority: 'medium', frequency: 'daily', startDate: '2026-09-10', paused: false,
  createdAt: '2026-09-10T00:00:00.000Z', updatedAt: '2026-09-10T00:00:00.000Z',
}

describe('recurring todos', () => {
  it('shows daily routines from their start date onward', () => {
    expect(occursOnDate(base, '2026-09-09')).toBe(false)
    expect(occursOnDate(base, '2026-09-10')).toBe(true)
    expect(occursOnDate(base, '2026-09-18')).toBe(true)
  })

  it('supports selected weekdays, month-end fallback, and custom day intervals', () => {
    expect(occursOnDate({ ...base, frequency: 'weekly', weekdays: [1, 3] }, '2026-09-14')).toBe(true)
    expect(occursOnDate({ ...base, frequency: 'weekly', weekdays: [1, 3] }, '2026-09-15')).toBe(false)
    expect(occursOnDate({ ...base, frequency: 'monthly', dayOfMonth: 31 }, '2026-09-30')).toBe(true)
    expect(occursOnDate({ ...base, frequency: 'monthly', dayOfMonth: 31 }, '2026-10-30')).toBe(false)
    expect(occursOnDate({ ...base, frequency: 'interval', intervalDays: 3 }, '2026-09-16')).toBe(true)
    expect(occursOnDate({ ...base, frequency: 'interval', intervalDays: 3 }, '2026-09-17')).toBe(false)
  })

  it('uses compact labels and does not show paused routines', () => {
    expect(recurringLabel({ ...base, frequency: 'weekly', weekdays: [1, 5] })).toBe('每周一、五')
    expect(occursOnDate({ ...base, paused: true }, '2026-09-10')).toBe(false)
  })
})
