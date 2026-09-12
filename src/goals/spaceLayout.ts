import type { Goal } from '../shared/types'

export interface GoalSpaceNode {
  goal: Goal
  depth: number
  order: number
  x: number
  y: number
}

export interface GoalSpaceEdge {
  from: string
  to: string
  order: number
}

export interface GoalSpaceLayout {
  nodes: GoalSpaceNode[]
  edges: GoalSpaceEdge[]
  width: number
  height: number
}

const NODE_WIDTH = 304
const COLUMN_GAP = 156
const ROW_GAP = 52
const MIN_NODE_HEIGHT = 176

const nodeHeight = (goal: Goal) => MIN_NODE_HEIGHT + Math.min(goal.milestones.length, 3) * 27 + (goal.progressMode === 'metric' ? 34 : 0)

const bySequence = (a: Goal, b: Goal) => {
  const aDate = a.startDate || a.dueDate || a.createdAt
  const bDate = b.startDate || b.dueDate || b.createdAt
  return aDate.localeCompare(bDate) || a.createdAt.localeCompare(b.createdAt)
}

export function layoutGoalSpace(goals: Goal[]): GoalSpaceLayout {
  if (!goals.length) return { nodes: [], edges: [], width: 1600, height: 960 }

  const ids = new Set(goals.map((goal) => goal.id))
  const children = new Map<string, Goal[]>()
  goals.forEach((goal) => {
    if (!goal.parentId || !ids.has(goal.parentId)) return
    children.set(goal.parentId, [...(children.get(goal.parentId) ?? []), goal])
  })
  children.forEach((items) => items.sort(bySequence))

  const roots = goals.filter((goal) => !goal.parentId || !ids.has(goal.parentId)).sort(bySequence)
  const placed = new Set<string>()
  const nodes: GoalSpaceNode[] = []
  const edges: GoalSpaceEdge[] = []
  let cursorY = 128
  let maxDepth = 0

  const place = (goal: Goal, depth: number, order: number, lineage: Set<string>): number => {
    if (placed.has(goal.id) || lineage.has(goal.id)) return cursorY
    placed.add(goal.id)
    maxDepth = Math.max(maxDepth, depth)
    const nextLineage = new Set(lineage).add(goal.id)
    const directChildren = (children.get(goal.id) ?? []).filter((child) => !nextLineage.has(child.id))
    let y: number
    if (directChildren.length) {
      const childYs = directChildren.map((child, index) => {
        edges.push({ from: goal.id, to: child.id, order: index + 1 })
        return place(child, depth + 1, index + 1, nextLineage)
      })
      y = (childYs[0] + childYs[childYs.length - 1]) / 2
    } else {
      y = cursorY
      cursorY += nodeHeight(goal) + ROW_GAP
    }
    nodes.push({ goal, depth, order, x: 120 + depth * (NODE_WIDTH + COLUMN_GAP), y })
    return y
  }

  roots.forEach((goal, index) => {
    place(goal, 0, index + 1, new Set())
    cursorY += 92
  })
  goals.filter((goal) => !placed.has(goal.id)).sort(bySequence).forEach((goal, index) => {
    place(goal, 0, roots.length + index + 1, new Set())
    cursorY += 92
  })

  return {
    nodes,
    edges,
    width: Math.max(1800, 240 + (maxDepth + 1) * (NODE_WIDTH + COLUMN_GAP)),
    height: Math.max(1050, cursorY + 150),
  }
}

export const goalSpaceNodeSize = { width: NODE_WIDTH, height: nodeHeight }
