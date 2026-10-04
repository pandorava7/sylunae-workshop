// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDefaultSnapshot } from '../shared/defaults'
import type { AppSnapshot, SylunaeAPI } from '../shared/types'
import { BirthdayNotifications } from '../components/BirthdayNotifications'

const store = vi.hoisted(() => ({ snapshot: null as AppSnapshot | null, update: vi.fn() }))
vi.mock('../app/AppStore', () => ({ useAppStore: () => store }))

describe('global birthday notification delivery', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 4, 10))
    store.snapshot = createDefaultSnapshot()
    store.snapshot.birthdays.people = [{ id: 'one', name: '小月', date: '2000-10-04', enabled: true }]
    store.snapshot.birthdays.settings = { ...store.snapshot.birthdays.settings, toast: false, external: true }
    store.update.mockReset()
    store.update.mockImplementation((recipe: (current: AppSnapshot) => AppSnapshot) => { store.snapshot = recipe(store.snapshot!) })
  })
  afterEach(() => {
    cleanup()
    delete window.sylunae
    vi.useRealTimers()
  })

  it('keeps failed system notifications eligible without consuming a reminder', async () => {
    const notifyBirthday = vi.fn().mockResolvedValue(false)
    window.sylunae = { system: { notifyBirthday } } as unknown as SylunaeAPI
    await act(async () => { render(<BirthdayNotifications><div>其他页面</div></BirthdayNotifications>) })
    expect(notifyBirthday).toHaveBeenCalledOnce()
    expect(store.update).not.toHaveBeenCalled()
    await act(async () => { await vi.advanceTimersByTimeAsync(30000) })
    expect(notifyBirthday).toHaveBeenCalledTimes(2)
    expect(store.snapshot!.birthdays.deliveries).toEqual({})
  })

  it('persists successful delivery and prevents repeats after the app remounts', async () => {
    const notifyBirthday = vi.fn().mockResolvedValue(true)
    window.sylunae = { system: { notifyBirthday } } as unknown as SylunaeAPI
    let view: ReturnType<typeof render>
    await act(async () => { view = render(<BirthdayNotifications><div>其他页面</div></BirthdayNotifications>) })
    expect(store.snapshot!.birthdays.deliveries.one).toMatchObject({ occurrence: '2026-10-04', count: 1 })
    view!.unmount()
    await act(async () => { render(<BirthdayNotifications><div>重新打开</div></BirthdayNotifications>) })
    await act(async () => { await vi.advanceTimersByTimeAsync(30000) })
    expect(notifyBirthday).toHaveBeenCalledOnce()
  })
})
