import { describe, expect, it } from 'vitest'
import { daysUntil, dueBirthdayReminders, localDateKey, nextBirthday, normalizeBirthdays, validBirthdayDate } from '../birthdays/reminders'
import { createDefaultSnapshot } from '../shared/defaults'
import { applyPartialBackup, createBackup, createPartialBackup, parseBackup, parsePartialBackup } from '../data/backup'
import { changedSnapshotSections } from '../data/snapshotSections'

const person = { id: 'p1', name: '小月', date: '2000-01-03', enabled: true }
function state() { return { ...normalizeBirthdays(), people: [person] } }

describe('birthday reminders', () => {
  it('rejects invalid dates and observes leap birthdays on February 28', () => {
    expect(validBirthdayDate('2025-02-29')).toBe(false)
    expect(validBirthdayDate('2000-02-29')).toBe(true)
    const leap = { ...person, date: '2000-02-29' }
    expect(localDateKey(nextBirthday(leap, new Date(2027, 1, 28, 23)))).toBe('2027-02-28')
    expect(localDateKey(nextBirthday(leap, new Date(2027, 2, 1)))).toBe('2028-02-29')
  })

  it('starts at the local configured time and handles a reminder window across years', () => {
    expect(dueBirthdayReminders(state(), new Date(2026, 11, 27, 8, 59))).toEqual([])
    expect(dueBirthdayReminders(state(), new Date(2026, 11, 27, 9))).toMatchObject([{ occurrence: '2027-01-03', count: 1 }])
    expect(daysUntil(nextBirthday(person, new Date(2026, 11, 27)), new Date(2026, 11, 27))).toBe(7)
  })

  it('does not resend after reload, respects intervals and the yearly cap', () => {
    const saved = state()
    saved.deliveries.p1 = { occurrence: '2027-01-03', count: 1, lastSentAt: new Date(2026, 11, 27, 9).toISOString() }
    expect(dueBirthdayReminders(saved, new Date(2026, 11, 27, 10))).toEqual([])
    expect(dueBirthdayReminders(saved, new Date(2027, 0, 3, 9))).toMatchObject([{ count: 2, body: '今天是 小月 的生日，生日快乐！' }])
    saved.deliveries.p1.count = 2
    expect(dueBirthdayReminders(saved, new Date(2027, 0, 3, 10))).toEqual([])
    expect(dueBirthdayReminders(saved, new Date(2027, 11, 27, 9))).toMatchObject([{ count: 1, occurrence: '2028-01-03' }])
  })

  it('sends one catch-up reminder, stops after the birthday and honors all switches', () => {
    const saved = state()
    expect(dueBirthdayReminders(saved, new Date(2027, 0, 2, 20))).toHaveLength(1)
    expect(dueBirthdayReminders(saved, new Date(2027, 0, 4))).toEqual([])
    saved.settings.enabled = false
    expect(dueBirthdayReminders(saved, new Date(2027, 0, 3, 10))).toEqual([])
    saved.settings.enabled = true
    saved.people[0] = { ...person, enabled: false }
    expect(dueBirthdayReminders(saved, new Date(2027, 0, 3, 10))).toEqual([])
    saved.people[0] = person
    saved.settings.toast = false
    expect(dueBirthdayReminders(saved, new Date(2027, 0, 3, 10))).toEqual([])
  })

  it('migrates old backups, round-trips birthday settings and isolates persistence', () => {
    const snapshot = createDefaultSnapshot()
    snapshot.birthdays = state()
    expect(parseBackup(JSON.stringify(createBackup(snapshot))).snapshot.birthdays).toEqual(snapshot.birthdays)
    const partial = parsePartialBackup(JSON.stringify(createPartialBackup(snapshot, 'tools')))
    expect(applyPartialBackup(createDefaultSnapshot(), partial).birthdays).toEqual(snapshot.birthdays)
    const legacy = JSON.parse(JSON.stringify(createBackup(snapshot)))
    delete legacy.snapshot.birthdays
    expect(parseBackup(JSON.stringify(legacy)).snapshot.birthdays).toEqual(normalizeBirthdays())
    expect(changedSnapshotSections(snapshot, { ...snapshot, birthdays: normalizeBirthdays() })).toEqual({ birthdays: normalizeBirthdays() })
  })
})
