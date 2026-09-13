import { describe, expect, it } from 'vitest'
import { countdownDays, countdownResult } from '../countdowns/countdown'

describe('countdown dates', () => {
  it('compares calendar days without time-of-day drift', () => {
    expect(countdownDays({ targetDate: '2026-09-13', yearly: false }, new Date(2026, 8, 12, 23, 59))).toBe(1)
    expect(countdownDays({ targetDate: '2026-09-12', yearly: false }, new Date(2026, 8, 12, 1, 30))).toBe(0)
    expect(countdownDays({ targetDate: '2026-09-10', yearly: false }, new Date(2026, 8, 12))).toBe(-2)
  })

  it('rolls yearly events to the next occurrence', () => {
    expect(countdownDays({ targetDate: '2020-09-12', yearly: true }, new Date(2026, 8, 12))).toBe(0)
    expect(countdownDays({ targetDate: '2020-09-11', yearly: true }, new Date(2026, 8, 12))).toBe(364)
  })

  it('observes leap-day events on February 28 in non-leap years', () => {
    expect(countdownDays({ targetDate: '2024-02-29', yearly: true }, new Date(2026, 1, 28))).toBe(0)
    expect(countdownDays({ targetDate: '2024-02-29', yearly: true }, new Date(2027, 2, 1))).toBe(365)
  })

  it('rejects invalid date strings', () => {
    expect(countdownDays({ targetDate: '2026-02-30', yearly: false }, new Date(2026, 0, 1))).toBeNull()
  })

  it('rolls weekly and monthly repetitions to their next occurrence', () => {
    expect(countdownDays({ targetDate: '2026-09-07', repeat: 'weekly' }, new Date(2026, 8, 12))).toBe(2)
    expect(countdownDays({ targetDate: '2026-01-31', repeat: 'monthly' }, new Date(2026, 1, 28))).toBe(0)
    expect(countdownDays({ targetDate: '2026-01-31', repeat: 'monthly' }, new Date(2026, 2, 1))).toBe(30)
  })

  it('supports precise times and count-up wording', () => {
    const future = countdownResult({ targetDate: '2026-09-12', targetTime: '18:30', precise: true, repeat: 'none', mode: 'countdown' }, new Date(2026, 8, 12, 17, 30))
    expect(future?.state).toBe('future')
    expect(future?.diffMs).toBe(3_600_000)
    const elapsed = countdownResult({ targetDate: '2026-09-10', repeat: 'none', mode: 'countup', includeStartDay: true }, new Date(2026, 8, 12))
    expect(elapsed?.wording).toBe('第')
    expect(elapsed?.displayDays).toBe(3)
  })
})
