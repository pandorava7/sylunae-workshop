import { useMemo, useState } from 'react'
import { Archive, CalendarDays, Check, CheckCircle2, ChevronRight, Circle, CircleDot, Flag, ListChecks, Plus, Target, Trash2 } from 'lucide-react'
import { useAppStore } from '../app/AppStore'
import type { Goal, GoalStatus, Milestone } from '../shared/types'
import { formatDate, goalProgress, isOverdue, newId, nowIso } from '../utils'
import { EmptyState } from '../components/Icons'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { Button } from '../components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog'
import { Input } from '../components/ui/input'
import { Progress } from '../components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '../components/ui/sheet'
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs'
import { Textarea } from '../components/ui/textarea'
import { usePersistentState } from '../lib/usePersistentState'

type SortMode = 'due' | 'progress' | 'updated'

export function GoalsPage({ embedded = false }: { embedded?: boolean }) {
  const { snapshot, update } = useAppStore()
  const goals = snapshot?.goals || []
  const [status, setStatus] = usePersistentState<GoalStatus>('navigation.goalStatus', 'active')
  const [sort, setSort] = useState<SortMode>('due')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Goal | null>(null)
  const selected = goals.find((goal) => goal.id === selectedId) || null
  const visible = useMemo(() => goals.filter((goal) => goal.status === status).sort((a, b) => {
    if (sort === 'progress') return goalProgress(b.milestones.map((item) => item.completed), b.status) - goalProgress(a.milestones.map((item) => item.completed), a.status)
    if (sort === 'updated') return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    if (!a.dueDate) return 1
    if (!b.dueDate) return -1
    return a.dueDate.localeCompare(b.dueDate)
  }), [goals, status, sort])

  const saveGoal = (id: string, patch: Partial<Goal>) => update((state) => ({ ...state, goals: state.goals.map((goal) => goal.id === id ? { ...goal, ...patch, updatedAt: nowIso() } : goal) }))
  const addGoal = (data: { title: string; description: string; startDate: string; dueDate: string }) => {
    const now = nowIso(); const goal: Goal = { id: newId(), ...data, status: 'active', milestones: [], createdAt: now, updatedAt: now }
    update((state) => ({ ...state, goals: [goal, ...state.goals] })); setCreating(false); setStatus('active'); setSelectedId(goal.id)
  }
  const removeGoal = (goal: Goal) => {
    update((state) => ({ ...state, goals: state.goals.filter((item) => item.id !== goal.id) })); setSelectedId(null)
  }

  return <section className={`${embedded ? 'task-panel' : 'page'} goals-page`}>
    {embedded ? <div className="panel-heading"><div><h2>目标追踪</h2><p>把远方拆成今天可以完成的一小步</p></div><Button className="button primary" onClick={() => setCreating(true)}><Plus size={17} />新建目标</Button></div> : <header className="page-header"><div><span className="eyebrow">GOALS</span><h1>目标</h1><p>把远方拆成今天可以完成的一小步</p></div><Button className="button primary" onClick={() => setCreating(true)}><Plus size={17} />新建目标</Button></header>}
    <div className="goal-overview">
      <div><span className="overview-icon"><CircleDot size={19} /></span><p>进行中</p><strong>{goals.filter((goal) => goal.status === 'active').length}</strong></div>
      <div><span className="overview-icon"><CheckCircle2 size={19} /></span><p>已完成</p><strong>{goals.filter((goal) => goal.status === 'completed').length}</strong></div>
      <div><span className="overview-icon"><Flag size={19} /></span><p>待完成里程碑</p><strong>{goals.flatMap((goal) => goal.milestones).filter((item) => !item.completed).length}</strong></div>
    </div>
    <div className="toolbar"><Tabs value={status} onValueChange={(value) => setStatus(value as GoalStatus)}><TabsList className="segmented"><TabsTrigger value="active">进行中</TabsTrigger><TabsTrigger value="completed">已完成</TabsTrigger><TabsTrigger value="archived">已归档</TabsTrigger></TabsList></Tabs><Select value={sort} onValueChange={(value) => setSort(value as SortMode)}><SelectTrigger className="select-control push-right"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="due">按截止日期</SelectItem><SelectItem value="progress">按完成进度</SelectItem><SelectItem value="updated">按最近更新</SelectItem></SelectContent></Select></div>
    {visible.length === 0 ? <EmptyState icon={<Target size={27} />} title={status === 'active' ? '写下第一个目标' : '这里暂时没有目标'} description={status === 'active' ? '不必宏大，只需足够清晰。之后再用里程碑一步步靠近。' : '切换分类，看看其他目标。'} action={status === 'active' ? <Button className="button primary" onClick={() => setCreating(true)}>新建目标</Button> : undefined} /> : <div className="goal-grid">{visible.map((goal) => <GoalCard key={goal.id} goal={goal} onClick={() => setSelectedId(goal.id)} />)}</div>}
    {creating && <GoalForm onClose={() => setCreating(false)} onSubmit={addGoal} />}
    {selected && <GoalDrawer goal={selected} onClose={() => setSelectedId(null)} onSave={(patch) => saveGoal(selected.id, patch)} onDelete={() => setDeleteTarget(selected)} />}
    <ConfirmDialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }} title="永久删除目标？" description={deleteTarget ? `“${deleteTarget.title}”及其里程碑将被删除，此操作无法撤销。` : ''} confirmLabel="永久删除" destructive icon={<Trash2 />} onConfirm={() => { if (deleteTarget) removeGoal(deleteTarget); setDeleteTarget(null) }} />
  </section>
}

function GoalCard({ goal, onClick }: { goal: Goal; onClick: () => void }) {
  const progress = goalProgress(goal.milestones.map((item) => item.completed), goal.status)
  const overdue = isOverdue(goal.dueDate, goal.status === 'completed')
  return <button className="goal-card" onClick={onClick}><div className="goal-card-top"><span className={`goal-status ${goal.status}`}>{goal.status === 'completed' ? <Check size={14} /> : <Target size={14} />}{goal.status === 'completed' ? '已完成' : goal.status === 'archived' ? '已归档' : '进行中'}</span><ChevronRight size={17} /></div><h3>{goal.title}</h3><p>{goal.description || '还没有补充说明'}</p><div className="progress-label"><span>{goal.milestones.filter((item) => item.completed).length}/{goal.milestones.length} 个里程碑</span><strong>{progress}%</strong></div><Progress value={progress} className="progress-bar" /><div className={`goal-date ${overdue ? 'overdue' : ''}`}><CalendarDays size={14} />{goal.dueDate ? `${overdue ? '已逾期 · ' : ''}${formatDate(goal.dueDate)}` : '未设置截止日期'}</div></button>
}

function GoalForm({ onClose, onSubmit }: { onClose: () => void; onSubmit: (value: { title: string; description: string; startDate: string; dueDate: string }) => void }) {
  const today = new Date().toISOString().slice(0, 10)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [startDate, setStartDate] = useState(today)
  const [dueDate, setDueDate] = useState('')
  return <Dialog open onOpenChange={(open) => { if (!open) onClose() }}><DialogContent className="modal-card"><DialogHeader className="modal-title"><div><span className="eyebrow">NEW GOAL</span><DialogTitle>新建目标</DialogTitle><DialogDescription>设置目标和时间范围，之后可以继续添加里程碑。</DialogDescription></div></DialogHeader><label>目标名称<Input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder="例如：完成个人作品集" /></label><label>简短说明<Textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="为什么想完成它？" rows={3} /></label><div className="form-row"><label>开始日期<Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label><label>截止日期<Input type="date" min={startDate} value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></label></div><DialogFooter className="modal-actions"><Button variant="outline" className="button secondary" onClick={onClose}>取消</Button><Button className="button primary" disabled={!title.trim()} onClick={() => onSubmit({ title: title.trim(), description: description.trim(), startDate, dueDate })}>创建目标</Button></DialogFooter></DialogContent></Dialog>
}

function GoalDrawer({ goal, onClose, onSave, onDelete }: { goal: Goal; onClose: () => void; onSave: (patch: Partial<Goal>) => void; onDelete: () => void }) {
  const [milestoneTitle, setMilestoneTitle] = useState('')
  const [milestoneDue, setMilestoneDue] = useState('')
  const progress = goalProgress(goal.milestones.map((item) => item.completed), goal.status)
  const addMilestone = () => {
    if (!milestoneTitle.trim()) return
    const now = nowIso(); const milestone: Milestone = { id: newId(), title: milestoneTitle.trim(), dueDate: milestoneDue, completed: false, createdAt: now, updatedAt: now }
    onSave({ milestones: [...goal.milestones, milestone] }); setMilestoneTitle(''); setMilestoneDue('')
  }
  const patchMilestone = (id: string, patch: Partial<Milestone>) => onSave({ milestones: goal.milestones.map((item) => item.id === id ? { ...item, ...patch, updatedAt: nowIso() } : item) })
  const removeMilestone = (id: string) => onSave({ milestones: goal.milestones.filter((item) => item.id !== id) })
  return <Sheet open onOpenChange={(open) => { if (!open) onClose() }}><SheetContent className="detail-drawer goal-drawer" showCloseButton><SheetTitle className="sr-only">{goal.title}</SheetTitle><SheetDescription className="sr-only">编辑目标详情和里程碑</SheetDescription><div className="drawer-content">
    <div className="badge-row"><span className={`badge ${goal.status === 'active' ? 'accent' : ''}`}>{goal.status === 'active' ? '进行中' : goal.status === 'completed' ? '已完成' : '已归档'}</span></div>
    <Input className="drawer-title-input" value={goal.title} onChange={(event) => onSave({ title: event.target.value })} />
    <Textarea className="drawer-description" value={goal.description} onChange={(event) => onSave({ description: event.target.value })} placeholder="添加目标说明…" rows={3} />
    <div className="progress-label"><span>总体进度</span><strong>{progress}%</strong></div><Progress value={progress} className="progress-bar large" />
    <div className="form-row drawer-dates"><label>开始日期<Input type="date" value={goal.startDate} onChange={(event) => onSave({ startDate: event.target.value })} /></label><label>截止日期<Input type="date" value={goal.dueDate} onChange={(event) => onSave({ dueDate: event.target.value })} /></label></div>
    <div className="section-heading"><div><ListChecks size={17} /><strong>里程碑</strong></div><span>{goal.milestones.filter((item) => item.completed).length}/{goal.milestones.length}</span></div>
    <div className="milestone-list">{goal.milestones.map((item) => <div key={item.id} className={item.completed ? 'completed' : ''}><button className="milestone-check" onClick={() => patchMilestone(item.id, { completed: !item.completed })}>{item.completed ? <CheckCircle2 size={19} /> : <Circle size={19} />}</button><div><input value={item.title} onChange={(event) => patchMilestone(item.id, { title: event.target.value })} /><span className={isOverdue(item.dueDate, item.completed) ? 'overdue' : ''}>{item.dueDate ? `${isOverdue(item.dueDate, item.completed) ? '已逾期 · ' : ''}${formatDate(item.dueDate)}` : '未设置日期'}</span></div><button className="ghost-danger" onClick={() => removeMilestone(item.id)}><Trash2 size={15} /></button></div>)}</div>
    <div className="milestone-add"><Input value={milestoneTitle} onChange={(event) => setMilestoneTitle(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') addMilestone() }} placeholder="添加一个里程碑" /><Input type="date" value={milestoneDue} onChange={(event) => setMilestoneDue(event.target.value)} /><Button onClick={addMilestone} disabled={!milestoneTitle.trim()}><Plus size={17} /></Button></div>
    <div className="goal-drawer-actions">{goal.status !== 'completed' && <Button className="button primary" onClick={() => onSave({ status: 'completed' })}><Check size={16} />标记完成</Button>}{goal.status === 'completed' && <Button variant="outline" className="button secondary" onClick={() => onSave({ status: 'active' })}>重新开启</Button>}<Button variant="outline" className="button secondary" onClick={() => onSave({ status: goal.status === 'archived' ? 'active' : 'archived' })}><Archive size={16} />{goal.status === 'archived' ? '移出归档' : '归档'}</Button><Button variant="destructive" size="icon" className="icon-button danger push-right" onClick={onDelete}><Trash2 size={17} /></Button></div>
  </div></SheetContent></Sheet>
}
