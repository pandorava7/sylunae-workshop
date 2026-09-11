import { describe, expect, it } from 'vitest'
import type { Goal } from '../shared/types'
import { expectedProgress, goalHealth, goalProgressValue, normalizeGoal } from '../goals/tracking'

const goal = (patch: Partial<Goal> = {}): Goal => ({
  id: 'goal', title: '目标', description: '', status: 'active', startDate: '2026-01-01', dueDate: '2026-01-11', milestones: [], createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', ...patch,
})

describe('goal tracking', () => {
  it('supports increasing and decreasing metric progress', () => {
    expect(goalProgressValue(goal({ progressMode: 'metric', metricStart: 0, metricCurrent: 30, metricTarget: 60 }))).toBe(50)
    expect(goalProgressValue(goal({ progressMode: 'metric', metricStart: 100, metricCurrent: 70, metricTarget: 40 }))).toBe(50)
  })

  it('rolls up weighted results and child goals', () => {
    const weighted = goal({ progressMode: 'milestones', milestones: [
      { id: 'a', title: 'A', dueDate: '', completed: true, weight: 3, createdAt: '', updatedAt: '' },
      { id: 'b', title: 'B', dueDate: '', completed: false, progress: 50, weight: 1, createdAt: '', updatedAt: '' },
    ] })
    expect(goalProgressValue(weighted)).toBe(88)
    const parent = goal({ id: 'parent', progressMode: 'subgoals' })
    const children = [goal({ id: 'one', parentId: 'parent', progressMode: 'manual', manualProgress: 20 }), goal({ id: 'two', parentId: 'parent', progressMode: 'manual', manualProgress: 80 })]
    expect(goalProgressValue(parent, [parent, ...children])).toBe(50)
  })

  it('compares actual progress with the time expectation', () => {
    const now = new Date('2026-01-06T00:00:00')
    expect(expectedProgress(goal(), now)).toBeGreaterThanOrEqual(45)
    expect(goalHealth(goal({ progressMode: 'manual', manualProgress: 5 }), [], now)).toBe('off-track')
    expect(goalHealth(goal({ progressMode: 'manual', manualProgress: 60 }), [], now)).toBe('on-track')
  })

  it('normalizes legacy goals without losing milestones', () => {
    const legacy = normalizeGoal(goal({ milestones: [{ id: 'm', title: '旧里程碑', dueDate: '', completed: true, createdAt: '', updatedAt: '' }] }))
    expect(legacy.progressMode).toBe('milestones')
    expect(legacy.milestones[0]).toMatchObject({ progress: 100, weight: 1 })
    expect(legacy.checkIns).toEqual([])
  })
})
