import { useMemo, useState, type ReactNode } from 'react'
import { Activity, Archive, ArrowRight, BarChart3, CalendarDays, ChevronRight, Circle, CircleDot, Compass, GitBranch, HeartHandshake, Lightbulb, ListChecks, Pause, Play, Plus, RefreshCw, Search, Sparkles, Target, Trash2 } from 'lucide-react'
import { useAppStore } from '../app/AppStore'
import type { Goal, GoalCheckIn, GoalProgressMode, GoalReviewCadence, GoalStatus, Milestone } from '../shared/types'
import { formatDate, isOverdue, newId, nowIso } from '../utils'
import { expectedProgress, goalHealth, goalHealthLabel, goalProgressValue, nextReviewDate, progressModeLabel } from '../goals/tracking'
import { EmptyState } from '../components/Icons'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { Button } from '../components/ui/button'
import { Checkbox } from '../components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog'
import { Input } from '../components/ui/input'
import { Progress } from '../components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '../components/ui/sheet'
import { Slider } from '../components/ui/slider'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { Textarea } from '../components/ui/textarea'
import { usePersistentState } from '../lib/usePersistentState'

type GoalFilter = GoalStatus | 'all'
type SortMode = 'attention' | 'due' | 'progress' | 'updated'
type GoalDraft = Pick<Goal, 'title' | 'description' | 'motivation' | 'parentId' | 'startDate' | 'dueDate' | 'progressMode' | 'metricStart' | 'metricCurrent' | 'metricTarget' | 'metricUnit' | 'reviewCadence'>

const todayString = () => new Date().toISOString().slice(0, 10)
const numberValue = (value: string, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback

export function GoalsPage({ embedded = false }: { embedded?: boolean }) {
  const { snapshot, update } = useAppStore()
  const goals = snapshot?.goals || []
  const [filter, setFilter] = usePersistentState<GoalFilter>('navigation.goalStatus', 'active')
  const [sort, setSort] = useState<SortMode>('attention')
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [creatingFor, setCreatingFor] = useState<string | null | undefined>(undefined)
  const [deleteTarget, setDeleteTarget] = useState<Goal | null>(null)
  const selected = goals.find((goal) => goal.id === selectedId) || null
  const active = goals.filter((goal) => goal.status === 'active')
  const needingAttention = active.filter((goal) => ['at-risk', 'off-track'].includes(goalHealth(goal, goals)))
  const reviewDue = active.filter((goal) => goal.nextReviewDate && goal.nextReviewDate <= todayString())
  const completedThisMonth = goals.filter((goal) => goal.status === 'completed' && goal.updatedAt.slice(0, 7) === todayString().slice(0, 7)).length

  const visible = useMemo(() => {
    const matched = goals.filter((goal) => (filter === 'all' || goal.status === filter) && (!query.trim() || `${goal.title} ${goal.description} ${goal.motivation ?? ''}`.toLowerCase().includes(query.trim().toLowerCase())))
    return matched.sort((a, b) => {
      if (sort === 'progress') return goalProgressValue(b, goals) - goalProgressValue(a, goals)
      if (sort === 'updated') return b.updatedAt.localeCompare(a.updatedAt)
      if (sort === 'attention') {
        const rank = { 'off-track': 0, 'at-risk': 1, 'on-track': 2, 'no-schedule': 3, paused: 4, completed: 5 }
        const difference = rank[goalHealth(a, goals)] - rank[goalHealth(b, goals)]
        if (difference) return difference
      }
      if (!a.dueDate) return 1
      if (!b.dueDate) return -1
      return a.dueDate.localeCompare(b.dueDate)
    })
  }, [filter, goals, query, sort])

  const focusGoal = [...active].sort((a, b) => {
    const severity = { 'off-track': 0, 'at-risk': 1, 'on-track': 2, 'no-schedule': 3, paused: 4, completed: 5 }
    return severity[goalHealth(a, goals)] - severity[goalHealth(b, goals)] || (a.dueDate || '9999').localeCompare(b.dueDate || '9999')
  })[0]

  const saveGoal = (id: string, patch: Partial<Goal>) => update((state) => ({ ...state, goals: state.goals.map((goal) => goal.id === id ? { ...goal, ...patch, updatedAt: nowIso() } : goal) }))
  const createGoalTodo = (goalId: string, title: string) => update((state) => {
    const now = nowIso()
    return { ...state, todos: [{ id: newId(), title, goalId, priority: 'medium', dueDate: '', completed: false, completedAt: null, createdAt: now, updatedAt: now }, ...state.todos] }
  })
  const addGoal = (data: GoalDraft) => {
    const now = nowIso()
    const goal: Goal = { id: newId(), ...data, status: 'active', manualProgress: 0, nextReviewDate: nextReviewDate(data.reviewCadence ?? 'weekly'), checkIns: [], milestones: [], createdAt: now, updatedAt: now }
    update((state) => ({ ...state, goals: [goal, ...state.goals] }))
    setCreatingFor(undefined); setFilter('active'); setSelectedId(goal.id)
  }
  const removeGoal = (goal: Goal) => {
    update((state) => ({ ...state, goals: state.goals.filter((item) => item.id !== goal.id).map((item) => item.parentId === goal.id ? { ...item, parentId: null, updatedAt: nowIso() } : item) }))
    setSelectedId(null)
  }

  return <section className={`${embedded ? 'task-panel' : 'page'} goals-page goals-workspace`}>
    <div className={embedded ? 'panel-heading goals-heading' : 'page-header goals-heading'}>
      <div>{!embedded && <span className="eyebrow">GOAL SYSTEM</span>}<h2>{embedded ? '目标追踪' : '目标系统'}</h2><p>让方向、成果和今天要做的事始终连在一起</p></div>
      <Button className="button primary" onClick={() => setCreatingFor(null)}><Plus size={17} />新建目标</Button>
    </div>

    {goals.length > 0 && <div className="goal-dashboard">
      <button className="goal-focus-card" onClick={() => focusGoal && setSelectedId(focusGoal.id)} disabled={!focusGoal}>
        <span className="goal-focus-icon"><Compass size={20} /></span>
        <div><small>现在最值得推进</small><strong>{focusGoal?.title ?? '所有目标都已完成'}</strong><p>{focusGoal ? (focusGoal.checkIns?.[0]?.nextStep || focusGoal.motivation || '打开目标，为它写下一个清晰的下一步。') : '去记录一个新的方向吧。'}</p></div>
        {focusGoal && <span className="goal-focus-progress">{goalProgressValue(focusGoal, goals)}%<ArrowRight size={16} /></span>}
      </button>
      <div className="goal-pulse-grid">
        <GoalStat icon={<CircleDot />} value={active.length} label="进行中" />
        <GoalStat icon={<HeartHandshake />} value={needingAttention.length} label="需要关照" tone={needingAttention.length ? 'warn' : 'good'} />
        <GoalStat icon={<RefreshCw />} value={reviewDue.length} label="待回顾" tone={reviewDue.length ? 'warn' : undefined} />
        <GoalStat icon={<Sparkles />} value={completedThisMonth} label="本月完成" tone="good" />
      </div>
    </div>}

    <div className="goal-toolbar">
      <Tabs value={filter} onValueChange={(value) => setFilter(value as GoalFilter)}><TabsList className="segmented goal-filter-tabs"><TabsTrigger value="active">进行中</TabsTrigger><TabsTrigger value="paused">已暂停</TabsTrigger><TabsTrigger value="completed">已完成</TabsTrigger><TabsTrigger value="archived">已归档</TabsTrigger><TabsTrigger value="all">全部</TabsTrigger></TabsList></Tabs>
      <label className="goal-search"><Search size={15} /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索目标" aria-label="搜索目标" /></label>
      <Select value={sort} onValueChange={(value) => setSort(value as SortMode)}><SelectTrigger className="select-control goal-sort"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="attention">优先看需关注</SelectItem><SelectItem value="due">按截止日期</SelectItem><SelectItem value="progress">按完成进度</SelectItem><SelectItem value="updated">按最近更新</SelectItem></SelectContent></Select>
    </div>

    {visible.length === 0 ? <EmptyState icon={<Target size={27} />} title={goals.length ? '没有符合条件的目标' : '从一个真正想抵达的方向开始'} description={goals.length ? '试试切换状态或清空搜索。' : '先写清楚为什么重要，再选择一种适合它的进度方式。'} action={!goals.length ? <Button className="button primary" onClick={() => setCreatingFor(null)}>创建第一个目标</Button> : undefined} /> : <div className="goal-list" role="list">{visible.map((goal) => <GoalRow key={goal.id} goal={goal} goals={goals} onClick={() => setSelectedId(goal.id)} />)}</div>}

    {creatingFor !== undefined && <GoalForm goals={goals} initialParentId={creatingFor} onClose={() => setCreatingFor(undefined)} onSubmit={addGoal} />}
    {selected && <GoalDrawer goal={selected} goals={goals} onClose={() => setSelectedId(null)} onOpenGoal={setSelectedId} onAddSubgoal={() => setCreatingFor(selected.id)} onSave={(patch) => saveGoal(selected.id, patch)} onCreateTodo={(title) => createGoalTodo(selected.id, title)} onDelete={() => setDeleteTarget(selected)} />}
    <ConfirmDialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }} title="永久删除目标？" description={deleteTarget ? `“${deleteTarget.title}”会被删除；它的子目标会保留并移到顶层。此操作无法撤销。` : ''} confirmLabel="永久删除" destructive icon={<Trash2 />} onConfirm={() => { if (deleteTarget) removeGoal(deleteTarget); setDeleteTarget(null) }} />
  </section>
}

function GoalStat({ icon, value, label, tone }: { icon: ReactNode; value: number; label: string; tone?: string }) {
  return <div className={`goal-stat ${tone ?? ''}`}><span>{icon}</span><strong>{value}</strong><small>{label}</small></div>
}

function GoalRow({ goal, goals, onClick }: { goal: Goal; goals: Goal[]; onClick: () => void }) {
  const progress = goalProgressValue(goal, goals)
  const expected = expectedProgress(goal)
  const health = goalHealth(goal, goals)
  const parent = goals.find((item) => item.id === goal.parentId)
  const children = goals.filter((item) => item.parentId === goal.id && item.status !== 'archived')
  return <button className="goal-row" onClick={onClick} role="listitem">
    <div className="goal-row-main"><div className="goal-row-titleline"><span className={`goal-health-dot ${health}`} />{parent && <span className="goal-parent-label">{parent.title}<ChevronRight size={11} /></span>}<h3>{goal.title}</h3></div><p>{goal.description || goal.motivation || '还没有补充目标说明'}</p><div className="goal-row-meta"><span className={`goal-health-label ${health}`}>{goalHealthLabel[health]}</span><span>{progressModeLabel[goal.progressMode ?? 'manual']}</span>{children.length > 0 && <span><GitBranch size={12} />{children.length} 个子目标</span>}<span className={isOverdue(goal.dueDate, goal.status === 'completed') ? 'overdue' : ''}><CalendarDays size={12} />{goal.dueDate ? formatDate(goal.dueDate) : '未设截止日期'}</span></div></div>
    <div className="goal-row-progress"><strong>{progress}%</strong><Progress value={progress} className={`progress-bar ${health}`} />{expected !== null && goal.status === 'active' ? <small>时间预期 {expected}%</small> : <small>{goal.status === 'paused' ? '随时可以重新开始' : '当前进度'}</small>}</div><ChevronRight className="goal-row-arrow" size={18} />
  </button>
}

function GoalForm({ goals, initialParentId, onClose, onSubmit }: { goals: Goal[]; initialParentId: string | null; onClose: () => void; onSubmit: (value: GoalDraft) => void }) {
  const today = todayString()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [motivation, setMotivation] = useState('')
  const [parentId, setParentId] = useState(initialParentId ?? 'none')
  const [startDate, setStartDate] = useState(today)
  const [dueDate, setDueDate] = useState('')
  const [progressMode, setProgressMode] = useState<GoalProgressMode>('milestones')
  const [metricStart, setMetricStart] = useState('0')
  const [metricCurrent, setMetricCurrent] = useState('0')
  const [metricTarget, setMetricTarget] = useState('100')
  const [metricUnit, setMetricUnit] = useState('')
  const [reviewCadence, setReviewCadence] = useState<GoalReviewCadence>('weekly')
  const validDates = !dueDate || !startDate || dueDate >= startDate
  const submit = () => onSubmit({ title: title.trim(), description: description.trim(), motivation: motivation.trim(), parentId: parentId === 'none' ? null : parentId, startDate, dueDate, progressMode, metricStart: numberValue(metricStart), metricCurrent: numberValue(metricCurrent), metricTarget: numberValue(metricTarget, 100), metricUnit: metricUnit.trim(), reviewCadence })
  return <Dialog open onOpenChange={(open) => { if (!open) onClose() }}><DialogContent className="modal-card goal-create-dialog"><DialogHeader className="modal-title"><div><span className="eyebrow">NEW GOAL</span><DialogTitle>{initialParentId ? '创建子目标' : '创建目标'}</DialogTitle><DialogDescription>先定义方向和成功标准，细节可以稍后补充。</DialogDescription></div></DialogHeader>
    <div className="goal-form-section"><strong>1 · 想抵达哪里？</strong><label>目标名称<Input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder="例如：完成并发布个人作品集" /></label><label>达成时会是什么样？<Textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="用结果描述成功，而不是只写要做的事情" rows={2} /></label><label>为什么这对你重要？<Input value={motivation} onChange={(event) => setMotivation(event.target.value)} placeholder="在动力不足时，这句话会提醒你" /></label></div>
    <div className="goal-form-section"><strong>2 · 它与什么相关？</strong><label>上级目标<Select value={parentId} onValueChange={setParentId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">没有，作为顶层目标</SelectItem>{goals.filter((goal) => goal.status !== 'archived').map((goal) => <SelectItem key={goal.id} value={goal.id}>{goal.title}</SelectItem>)}</SelectContent></Select></label><div className="form-row"><label>开始日期<Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label><label>期望日期<Input type="date" min={startDate} value={dueDate} onChange={(event) => setDueDate(event.target.value)} />{!validDates && <small className="form-error">不能早于开始日期</small>}</label></div></div>
    <div className="goal-form-section"><strong>3 · 如何判断进度？</strong><Select value={progressMode} onValueChange={(value) => setProgressMode(value as GoalProgressMode)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="milestones">成果加权 · 多个关键成果共同推进</SelectItem><SelectItem value="metric">数值指标 · 金额、数量、时长等</SelectItem><SelectItem value="subgoals">子目标汇总 · 由拆分目标自动计算</SelectItem><SelectItem value="manual">手动更新 · 适合难以量化的方向</SelectItem></SelectContent></Select>{progressMode === 'metric' && <div className="metric-fields"><label>起点<Input inputMode="decimal" value={metricStart} onChange={(event) => setMetricStart(event.target.value)} /></label><label>当前<Input inputMode="decimal" value={metricCurrent} onChange={(event) => setMetricCurrent(event.target.value)} /></label><label>目标<Input inputMode="decimal" value={metricTarget} onChange={(event) => setMetricTarget(event.target.value)} /></label><label>单位<Input value={metricUnit} onChange={(event) => setMetricUnit(event.target.value)} placeholder="页 / km" /></label></div>}<label>回顾节奏<Select value={reviewCadence} onValueChange={(value) => setReviewCadence(value as GoalReviewCadence)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="weekly">每周回顾</SelectItem><SelectItem value="monthly">每月回顾</SelectItem><SelectItem value="none">不设固定节奏</SelectItem></SelectContent></Select></label></div>
    <DialogFooter className="modal-actions"><Button variant="outline" className="button secondary" onClick={onClose}>取消</Button><Button className="button primary" disabled={!title.trim() || !validDates} onClick={submit}>创建并继续完善</Button></DialogFooter>
  </DialogContent></Dialog>
}

function GoalDrawer({ goal, goals, onClose, onOpenGoal, onAddSubgoal, onSave, onCreateTodo, onDelete }: { goal: Goal; goals: Goal[]; onClose: () => void; onOpenGoal: (id: string) => void; onAddSubgoal: () => void; onSave: (patch: Partial<Goal>) => void; onCreateTodo: (title: string) => void; onDelete: () => void }) {
  const [checkInOpen, setCheckInOpen] = useState(false)
  const [milestoneTitle, setMilestoneTitle] = useState('')
  const [milestoneDue, setMilestoneDue] = useState('')
  const progress = goalProgressValue(goal, goals)
  const health = goalHealth(goal, goals)
  const createsCycle = (candidate: Goal) => {
    let current: Goal | undefined = candidate
    const visited = new Set<string>()
    while (current?.parentId && !visited.has(current.id)) {
      if (current.parentId === goal.id) return true
      visited.add(current.id)
      current = goals.find((item) => item.id === current?.parentId)
    }
    return false
  }
  const parentOptions = goals.filter((item) => item.id !== goal.id && !createsCycle(item) && item.status !== 'archived')
  const children = goals.filter((item) => item.parentId === goal.id && item.status !== 'archived')
  const addMilestone = () => {
    if (!milestoneTitle.trim()) return
    const now = nowIso(); const milestone: Milestone = { id: newId(), title: milestoneTitle.trim(), dueDate: milestoneDue, completed: false, progress: 0, weight: 1, createdAt: now, updatedAt: now }
    onSave({ milestones: [...goal.milestones, milestone] }); setMilestoneTitle(''); setMilestoneDue('')
  }
  const patchMilestone = (id: string, patch: Partial<Milestone>) => onSave({ milestones: goal.milestones.map((item) => item.id === id ? { ...item, ...patch, updatedAt: nowIso() } : item) })
  const removeMilestone = (id: string) => onSave({ milestones: goal.milestones.filter((item) => item.id !== id) })
  return <><Sheet open onOpenChange={(open) => { if (!open) onClose() }}><SheetContent className="detail-drawer goal-drawer" showCloseButton><SheetTitle className="sr-only">{goal.title}</SheetTitle><SheetDescription className="sr-only">管理目标、成果、子目标和回顾记录</SheetDescription><div className="drawer-content">
    <div className="goal-detail-kicker"><span className={`goal-health-label ${health}`}>{goalHealthLabel[health]}</span><Select value={goal.status} onValueChange={(value) => onSave({ status: value as GoalStatus })}><SelectTrigger className="goal-status-select"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">进行中</SelectItem><SelectItem value="paused">暂停一下</SelectItem><SelectItem value="completed">标记完成</SelectItem><SelectItem value="archived">归档</SelectItem></SelectContent></Select></div>
    <Input className="drawer-title-input" value={goal.title} onChange={(event) => onSave({ title: event.target.value })} aria-label="目标名称" />
    <Textarea className="drawer-description" value={goal.description} onChange={(event) => onSave({ description: event.target.value })} placeholder="描述达成目标时的样子…" rows={2} />
    <div className="goal-detail-progress"><div><span>总体进度</span><strong>{progress}%</strong></div><Progress value={progress} className={`progress-bar large ${health}`} /><div className="goal-progress-foot"><span>{progressModeLabel[goal.progressMode ?? 'manual']}</span>{expectedProgress(goal) !== null && <span>时间预期 {expectedProgress(goal)}%</span>}</div></div>
    <Button className="button primary goal-checkin-button" onClick={() => setCheckInOpen(true)}><Activity size={16} />记录本次进展</Button>

    <Tabs defaultValue="overview" className="goal-detail-tabs"><TabsList className="goal-detail-tablist"><TabsTrigger value="overview">概览</TabsTrigger><TabsTrigger value="structure">成果与子目标</TabsTrigger><TabsTrigger value="reviews">回顾记录</TabsTrigger></TabsList>
      <TabsContent value="overview" className="goal-tab-panel"><label>为什么重要<Textarea value={goal.motivation ?? ''} onChange={(event) => onSave({ motivation: event.target.value })} placeholder="写给未来可能想放弃的自己" rows={3} /></label><label>上级目标<Select value={goal.parentId ?? 'none'} onValueChange={(value) => onSave({ parentId: value === 'none' ? null : value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">没有，作为顶层目标</SelectItem>{parentOptions.map((item) => <SelectItem key={item.id} value={item.id}>{item.title}</SelectItem>)}</SelectContent></Select></label><div className="form-row drawer-dates"><label>开始日期<Input type="date" value={goal.startDate} onChange={(event) => onSave({ startDate: event.target.value })} /></label><label>期望日期<Input type="date" min={goal.startDate} value={goal.dueDate} onChange={(event) => onSave({ dueDate: event.target.value })} /></label></div><label>进度方式<Select value={goal.progressMode ?? 'manual'} onValueChange={(value) => onSave({ progressMode: value as GoalProgressMode })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="manual">手动更新</SelectItem><SelectItem value="metric">数值指标</SelectItem><SelectItem value="milestones">成果加权</SelectItem><SelectItem value="subgoals">子目标汇总</SelectItem></SelectContent></Select></label>
        {(goal.progressMode ?? 'manual') === 'manual' && <div className="manual-progress-editor"><div><span>当前进度</span><strong>{goal.manualProgress ?? 0}%</strong></div><Slider value={[goal.manualProgress ?? 0]} onValueChange={([value]) => onSave({ manualProgress: value })} /></div>}
        {goal.progressMode === 'metric' && <div className="metric-fields goal-metric-editor"><label>起点<Input type="number" value={goal.metricStart ?? 0} onChange={(event) => onSave({ metricStart: numberValue(event.target.value) })} /></label><label>当前<Input type="number" value={goal.metricCurrent ?? 0} onChange={(event) => onSave({ metricCurrent: numberValue(event.target.value) })} /></label><label>目标<Input type="number" value={goal.metricTarget ?? 100} onChange={(event) => onSave({ metricTarget: numberValue(event.target.value) })} /></label><label>单位<Input value={goal.metricUnit ?? ''} onChange={(event) => onSave({ metricUnit: event.target.value })} /></label></div>}
        <label>回顾节奏<Select value={goal.reviewCadence ?? 'weekly'} onValueChange={(value) => onSave({ reviewCadence: value as GoalReviewCadence, nextReviewDate: nextReviewDate(value as GoalReviewCadence) })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="weekly">每周</SelectItem><SelectItem value="monthly">每月</SelectItem><SelectItem value="none">不固定</SelectItem></SelectContent></Select></label>
      </TabsContent>
      <TabsContent value="structure" className="goal-tab-panel"><div className="goal-section-title"><div><ListChecks size={17} /><div><strong>关键成果</strong><small>每项可独立设置进度和权重</small></div></div><span>{goal.milestones.length}</span></div>{goal.milestones.length ? <div className="milestone-list refined">{goal.milestones.map((item) => <div key={item.id} className={item.completed ? 'completed' : ''}><button className="milestone-check" onClick={() => patchMilestone(item.id, { completed: !item.completed, progress: !item.completed ? 100 : 0 })} aria-label={item.completed ? '设为未完成' : '设为完成'}>{item.completed ? <CircleDot size={19} /> : <Circle size={19} />}</button><div className="milestone-body"><Input value={item.title} onChange={(event) => patchMilestone(item.id, { title: event.target.value })} /><div className="milestone-controls"><label>进度 <Input type="number" min="0" max="100" value={item.completed ? 100 : item.progress ?? 0} onChange={(event) => { const value = Math.min(100, Math.max(0, numberValue(event.target.value))); patchMilestone(item.id, { progress: value, completed: value === 100 }) }} />%</label><label>权重 <Input type="number" min="0" value={item.weight ?? 1} onChange={(event) => patchMilestone(item.id, { weight: Math.max(0, numberValue(event.target.value, 1)) })} /></label><span className={isOverdue(item.dueDate, item.completed) ? 'overdue' : ''}>{item.dueDate ? formatDate(item.dueDate) : '未设日期'}</span></div></div><button className="ghost-danger" onClick={() => removeMilestone(item.id)} aria-label="删除成果"><Trash2 size={15} /></button></div>)}</div> : <p className="goal-inline-empty">添加 2–5 个能证明目标正在实现的结果。</p>}<div className="milestone-add"><Input value={milestoneTitle} onChange={(event) => setMilestoneTitle(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') addMilestone() }} placeholder="添加关键成果" /><Input type="date" value={milestoneDue} onChange={(event) => setMilestoneDue(event.target.value)} /><Button onClick={addMilestone} disabled={!milestoneTitle.trim()} aria-label="添加成果"><Plus size={17} /></Button></div>
        <div className="goal-section-title subgoal-heading"><div><GitBranch size={17} /><div><strong>子目标</strong><small>适合需要独立管理的较大阶段</small></div></div><Button variant="outline" size="sm" onClick={onAddSubgoal}><Plus size={14} />添加</Button></div>{children.length ? <div className="subgoal-list">{children.map((child) => <button key={child.id} onClick={() => onOpenGoal(child.id)}><span className={`goal-health-dot ${goalHealth(child, goals)}`} /><div><strong>{child.title}</strong><small>{goalProgressValue(child, goals)}% · {goalHealthLabel[goalHealth(child, goals)]}</small></div><ChevronRight size={15} /></button>)}</div> : <p className="goal-inline-empty">还没有子目标。简单步骤更适合放在关键成果里。</p>}
      </TabsContent>
      <TabsContent value="reviews" className="goal-tab-panel"><div className="goal-section-title"><div><RefreshCw size={17} /><div><strong>回顾记录</strong><small>留下变化、阻碍和下一步</small></div></div><span>{goal.checkIns?.length ?? 0}</span></div>{goal.checkIns?.length ? <div className="checkin-timeline">{goal.checkIns.map((item) => <article key={item.id}><span /><div><header><strong>{item.progress}%</strong><time>{formatDate(item.createdAt)}</time><small>信心 {item.confidence}/5</small></header>{item.note && <p>{item.note}</p>}{item.nextStep && <div><ArrowRight size={13} />下一步：{item.nextStep}</div>}</div></article>)}</div> : <div className="goal-review-empty"><Lightbulb size={20} /><strong>第一次回顾不用等到“有好消息”</strong><p>记录卡住的地方，本身就是重新获得掌控感的一步。</p><Button variant="outline" onClick={() => setCheckInOpen(true)}>开始回顾</Button></div>}
      </TabsContent>
    </Tabs>
    <div className="goal-drawer-actions">{goal.status === 'paused' ? <Button variant="outline" className="button secondary" onClick={() => onSave({ status: 'active' })}><Play size={16} />继续目标</Button> : goal.status === 'active' ? <Button variant="outline" className="button secondary" onClick={() => onSave({ status: 'paused' })}><Pause size={16} />暂停一下</Button> : null}<Button variant="outline" className="button secondary" onClick={() => onSave({ status: goal.status === 'archived' ? 'active' : 'archived' })}><Archive size={16} />{goal.status === 'archived' ? '移出归档' : '归档'}</Button><Button variant="destructive" size="icon" className="icon-button danger push-right" onClick={onDelete} aria-label="删除目标"><Trash2 size={17} /></Button></div>
  </div></SheetContent></Sheet>{checkInOpen && <CheckInDialog goal={goal} progress={progress} onClose={() => setCheckInOpen(false)} onSave={onSave} onCreateTodo={onCreateTodo} />}</>
}

function CheckInDialog({ goal, progress, onClose, onSave, onCreateTodo }: { goal: Goal; progress: number; onClose: () => void; onSave: (patch: Partial<Goal>) => void; onCreateTodo: (title: string) => void }) {
  const [manualProgress, setManualProgress] = useState(goal.manualProgress ?? progress)
  const [confidence, setConfidence] = useState(3)
  const [note, setNote] = useState('')
  const [nextStep, setNextStep] = useState(goal.checkIns?.[0]?.nextStep ?? '')
  const [addToTodos, setAddToTodos] = useState(false)
  const save = () => {
    const now = nowIso(); const checkIn: GoalCheckIn = { id: newId(), progress: goal.progressMode === 'manual' || !goal.progressMode ? manualProgress : progress, confidence, note: note.trim(), nextStep: nextStep.trim(), createdAt: now }
    onSave({ ...(goal.progressMode === 'manual' || !goal.progressMode ? { manualProgress } : {}), checkIns: [checkIn, ...(goal.checkIns ?? [])], nextReviewDate: nextReviewDate(goal.reviewCadence ?? 'weekly', new Date(now)) })
    if (addToTodos && nextStep.trim()) onCreateTodo(nextStep.trim())
    onClose()
  }
  return <Dialog open onOpenChange={(open) => { if (!open) onClose() }}><DialogContent className="modal-card checkin-dialog"><DialogHeader className="modal-title"><div><span className="eyebrow">CHECK-IN</span><DialogTitle>回顾这段进展</DialogTitle><DialogDescription>不评判快慢，只记录事实并找到下一步。</DialogDescription></div></DialogHeader>{(goal.progressMode === 'manual' || !goal.progressMode) ? <div className="checkin-progress"><div><span>更新进度</span><strong>{manualProgress}%</strong></div><Slider value={[manualProgress]} onValueChange={([value]) => setManualProgress(value)} /></div> : <div className="checkin-derived"><BarChart3 size={17} /><span>当前自动计算进度</span><strong>{progress}%</strong></div>}<label>这段时间发生了什么？<Textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="进展、收获或遇到的阻碍都可以" rows={3} /></label><fieldset className="confidence-field"><legend>对按计划推进有多少信心？</legend><div>{[1, 2, 3, 4, 5].map((value) => <button type="button" className={confidence === value ? 'active' : ''} key={value} onClick={() => setConfidence(value)}>{value}</button>)}</div><small>{confidence <= 2 ? '需要调整范围或寻求帮助' : confidence === 3 ? '有不确定性，但仍可推进' : '节奏清晰，继续保持'}</small></fieldset><label>下一步做什么？<Input value={nextStep} onChange={(event) => setNextStep(event.target.value)} placeholder="尽量写成一次就能开始的动作" /></label>{nextStep.trim() && <label className="checkin-todo-option"><Checkbox checked={addToTodos} onCheckedChange={(checked) => setAddToTodos(checked === true)} /><span><strong>同时加入快速待办</strong><small>把下一步带到任务箱，今天就能开始</small></span></label>}<DialogFooter className="modal-actions"><Button variant="outline" onClick={onClose}>取消</Button><Button className="button primary" onClick={save}>保存本次回顾</Button></DialogFooter></DialogContent></Dialog>
}
