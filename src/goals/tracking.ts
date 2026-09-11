import type { Goal, GoalProgressMode, GoalReviewCadence, GoalStatus } from '../shared/types'

export type GoalHealth = 'on-track' | 'at-risk' | 'off-track' | 'no-schedule' | 'paused' | 'completed'

const clamp = (value: number) => Math.min(100, Math.max(0, Math.round(Number.isFinite(value) ? value : 0)))

export function progressModeOf(goal: Goal): GoalProgressMode {
  return goal.progressMode ?? (goal.milestones.length ? 'milestones' : 'manual')
}

export function goalProgressValue(goal: Goal, goals: Goal[] = [], visited = new Set<string>()): number {
  if (goal.status === 'completed') return 100
  if (visited.has(goal.id)) return 0
  const nextVisited = new Set(visited).add(goal.id)
  const mode = progressModeOf(goal)
  if (mode === 'manual') return clamp(goal.manualProgress ?? 0)
  if (mode === 'metric') {
    const start = goal.metricStart ?? 0
    const current = goal.metricCurrent ?? start
    const target = goal.metricTarget ?? 100
    if (target === start) return current === target ? 100 : 0
    return clamp(((current - start) / (target - start)) * 100)
  }
  if (mode === 'subgoals') {
    const children = goals.filter((item) => item.parentId === goal.id && item.status !== 'archived')
    if (!children.length) return 0
    return clamp(children.reduce((sum, child) => sum + goalProgressValue(child, goals, nextVisited), 0) / children.length)
  }
  if (!goal.milestones.length) return 0
  const totalWeight = goal.milestones.reduce((sum, item) => sum + Math.max(0, item.weight ?? 1), 0)
  if (!totalWeight) return 0
  return clamp(goal.milestones.reduce((sum, item) => sum + (item.completed ? 100 : clamp(item.progress ?? 0)) * Math.max(0, item.weight ?? 1), 0) / totalWeight)
}

export function expectedProgress(goal: Goal, now = new Date()): number | null {
  if (!goal.startDate || !goal.dueDate) return null
  const start = new Date(`${goal.startDate}T00:00:00`).getTime()
  const due = new Date(`${goal.dueDate}T23:59:59`).getTime()
  if (!Number.isFinite(start) || !Number.isFinite(due) || due <= start) return null
  return clamp(((now.getTime() - start) / (due - start)) * 100)
}

export function goalHealth(goal: Goal, goals: Goal[] = [], now = new Date()): GoalHealth {
  if (goal.status === 'completed') return 'completed'
  if (goal.status === 'paused') return 'paused'
  const expected = expectedProgress(goal, now)
  if (expected === null) return 'no-schedule'
  const gap = expected - goalProgressValue(goal, goals)
  if (gap > 25) return 'off-track'
  if (gap > 8) return 'at-risk'
  return 'on-track'
}

export function nextReviewDate(cadence: GoalReviewCadence, from = new Date()): string {
  if (cadence === 'none') return ''
  const next = new Date(from)
  next.setDate(next.getDate() + (cadence === 'weekly' ? 7 : 30))
  return next.toISOString().slice(0, 10)
}

export function normalizeGoal(goal: Goal): Goal {
  return {
    ...goal,
    status: (['active', 'paused', 'completed', 'archived'] as GoalStatus[]).includes(goal.status) ? goal.status : 'active',
    parentId: goal.parentId ?? null,
    motivation: goal.motivation ?? '',
    progressMode: progressModeOf(goal),
    manualProgress: clamp(goal.manualProgress ?? 0),
    metricStart: goal.metricStart ?? 0,
    metricCurrent: goal.metricCurrent ?? 0,
    metricTarget: goal.metricTarget ?? 100,
    metricUnit: goal.metricUnit ?? '',
    reviewCadence: goal.reviewCadence ?? 'weekly',
    nextReviewDate: goal.nextReviewDate ?? '',
    checkIns: goal.checkIns ?? [],
    milestones: goal.milestones.map((item) => ({ ...item, progress: item.completed ? 100 : clamp(item.progress ?? 0), weight: Math.max(0, item.weight ?? 1) })),
  }
}

export const goalHealthLabel: Record<GoalHealth, string> = {
  'on-track': '进展顺利',
  'at-risk': '需要关注',
  'off-track': '已经落后',
  'no-schedule': '未设时间',
  paused: '已暂停',
  completed: '已完成',
}

export const progressModeLabel: Record<GoalProgressMode, string> = {
  manual: '手动更新',
  metric: '数值指标',
  milestones: '成果加权',
  subgoals: '子目标汇总',
}
