import { describe, expect, it } from 'vitest'
import type { Goal } from '../shared/types'
import { layoutGoalSpace } from '../goals/spaceLayout'

const goal = (id: string, parentId: string | null = null, startDate = '2026-01-01'): Goal => ({
  id,
  parentId,
  title: id,
  description: '',
  status: 'active',
  startDate,
  dueDate: '',
  progressMode: 'milestones',
  milestones: [],
  createdAt: `${startDate}T00:00:00.000Z`,
  updatedAt: `${startDate}T00:00:00.000Z`,
})

describe('goal space layout', () => {
  it('places dependencies from left to right and connects them', () => {
    const layout = layoutGoalSpace([goal('root'), goal('child', 'root'), goal('leaf', 'child')])
    const positions = new Map(layout.nodes.map((node) => [node.goal.id, node]))
    expect(positions.get('root')!.x).toBeLessThan(positions.get('child')!.x)
    expect(positions.get('child')!.x).toBeLessThan(positions.get('leaf')!.x)
    expect(layout.edges).toEqual([
      { from: 'root', to: 'child', order: 1 },
      { from: 'child', to: 'leaf', order: 1 },
    ])
  })

  it('orders sibling goals by their planned sequence', () => {
    const layout = layoutGoalSpace([goal('root'), goal('later', 'root', '2026-06-01'), goal('first', 'root', '2026-02-01')])
    const positions = new Map(layout.nodes.map((node) => [node.goal.id, node]))
    expect(positions.get('first')!.order).toBe(1)
    expect(positions.get('first')!.y).toBeLessThan(positions.get('later')!.y)
  })

  it('keeps orphaned and cyclic data visible without recursing forever', () => {
    const cyclicA = goal('a', 'b')
    const cyclicB = goal('b', 'a')
    const orphan = goal('orphan', 'missing')
    const layout = layoutGoalSpace([cyclicA, cyclicB, orphan])
    expect(new Set(layout.nodes.map((node) => node.goal.id))).toEqual(new Set(['a', 'b', 'orphan']))
  })
})
