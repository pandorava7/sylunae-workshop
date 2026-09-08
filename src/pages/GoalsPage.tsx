import { useMemo, useState } from 'react'
import { Archive, CalendarDays, Check, CheckCircle2, ChevronRight, Circle, CircleDot, Flag, ListChecks, Plus, Target, Trash2, X } from 'lucide-react'
import { useAppStore } from '../app/AppStore'
import type { Goal, GoalStatus, Milestone } from '../shared/types'
import { formatDate, goalProgress, isOverdue, newId, nowIso } from '../utils'
import { EmptyState } from '../components/Icons'

type SortMode = 'due' | 'progress' | 'updated'

export function GoalsPage() {
  const { snapshot, update } = useAppStore()
  const goals = snapshot?.goals || []
  const [status, setStatus] = useState<GoalStatus>('active')
  const [sort, setSort] = useState<SortMode>('due')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
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
    if (!confirm(`永久删除目标“${goal.title}”？`)) return
    update((state) => ({ ...state, goals: state.goals.filter((item) => item.id !== goal.id) })); setSelectedId(null)
  }

  return <section className="page goals-page">
    <header className="page-header"><div><span className="eyebrow">GOALS</span><h1>目标</h1><p>把远方拆成今天可以完成的一小步</p></div><button className="button primary" onClick={() => setCreating(true)}><Plus size={17} />新建目标</button></header>
    <div className="goal-overview">
      <div><span className="overview-icon"><CircleDot size={19} /></span><p>进行中</p><strong>{goals.filter((goal) => goal.status === 'active').length}</strong></div>
      <div><span className="overview-icon"><CheckCircle2 size={19} /></span><p>已完成</p><strong>{goals.filter((goal) => goal.status === 'completed').length}</strong></div>
      <div><span className="overview-icon"><Flag size={19} /></span><p>待完成里程碑</p><strong>{goals.flatMap((goal) => goal.milestones).filter((item) => !item.completed).length}</strong></div>
    </div>
    <div className="toolbar"><div className="segmented"><button className={status === 'active' ? 'active' : ''} onClick={() => setStatus('active')}>进行中</button><button className={status === 'completed' ? 'active' : ''} onClick={() => setStatus('completed')}>已完成</button><button className={status === 'archived' ? 'active' : ''} onClick={() => setStatus('archived')}>已归档</button></div><label className="select-control push-right"><select value={sort} onChange={(event) => setSort(event.target.value as SortMode)}><option value="due">按截止日期</option><option value="progress">按完成进度</option><option value="updated">按最近更新</option></select></label></div>
    {visible.length === 0 ? <EmptyState icon={<Target size={27} />} title={status === 'active' ? '写下第一个目标' : '这里暂时没有目标'} description={status === 'active' ? '不必宏大，只需足够清晰。之后再用里程碑一步步靠近。' : '切换分类，看看其他目标。'} action={status === 'active' ? <button className="button primary" onClick={() => setCreating(true)}>新建目标</button> : undefined} /> : <div className="goal-grid">{visible.map((goal) => <GoalCard key={goal.id} goal={goal} onClick={() => setSelectedId(goal.id)} />)}</div>}
    {creating && <GoalForm onClose={() => setCreating(false)} onSubmit={addGoal} />}
    {selected && <GoalDrawer goal={selected} onClose={() => setSelectedId(null)} onSave={(patch) => saveGoal(selected.id, patch)} onDelete={() => removeGoal(selected)} />}
  </section>
}

function GoalCard({ goal, onClick }: { goal: Goal; onClick: () => void }) {
  const progress = goalProgress(goal.milestones.map((item) => item.completed), goal.status)
  const overdue = isOverdue(goal.dueDate, goal.status === 'completed')
  return <button className="goal-card" onClick={onClick}><div className="goal-card-top"><span className={`goal-status ${goal.status}`}>{goal.status === 'completed' ? <Check size={14} /> : <Target size={14} />}{goal.status === 'completed' ? '已完成' : goal.status === 'archived' ? '已归档' : '进行中'}</span><ChevronRight size={17} /></div><h3>{goal.title}</h3><p>{goal.description || '还没有补充说明'}</p><div className="progress-label"><span>{goal.milestones.filter((item) => item.completed).length}/{goal.milestones.length} 个里程碑</span><strong>{progress}%</strong></div><div className="progress-bar"><i style={{ width: `${progress}%` }} /></div><div className={`goal-date ${overdue ? 'overdue' : ''}`}><CalendarDays size={14} />{goal.dueDate ? `${overdue ? '已逾期 · ' : ''}${formatDate(goal.dueDate)}` : '未设置截止日期'}</div></button>
}

function GoalForm({ onClose, onSubmit }: { onClose: () => void; onSubmit: (value: { title: string; description: string; startDate: string; dueDate: string }) => void }) {
  const today = new Date().toISOString().slice(0, 10)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [startDate, setStartDate] = useState(today)
  const [dueDate, setDueDate] = useState('')
  return <><button className="modal-backdrop" onClick={onClose} /><div className="modal-card"><div className="modal-title"><div><span className="eyebrow">NEW GOAL</span><h2>新建目标</h2></div><button onClick={onClose}><X size={19} /></button></div><label>目标名称<input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder="例如：完成个人作品集" /></label><label>简短说明<textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="为什么想完成它？" rows={3} /></label><div className="form-row"><label>开始日期<input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label><label>截止日期<input type="date" min={startDate} value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></label></div><div className="modal-actions"><button className="button secondary" onClick={onClose}>取消</button><button className="button primary" disabled={!title.trim()} onClick={() => onSubmit({ title: title.trim(), description: description.trim(), startDate, dueDate })}>创建目标</button></div></div></>
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
  return <><button className="drawer-backdrop" onClick={onClose} /><aside className="detail-drawer goal-drawer"><button className="drawer-close" onClick={onClose}><X size={18} /></button><div className="drawer-content">
    <div className="badge-row"><span className={`badge ${goal.status === 'active' ? 'accent' : ''}`}>{goal.status === 'active' ? '进行中' : goal.status === 'completed' ? '已完成' : '已归档'}</span></div>
    <input className="drawer-title-input" value={goal.title} onChange={(event) => onSave({ title: event.target.value })} />
    <textarea className="drawer-description" value={goal.description} onChange={(event) => onSave({ description: event.target.value })} placeholder="添加目标说明…" rows={3} />
    <div className="progress-label"><span>总体进度</span><strong>{progress}%</strong></div><div className="progress-bar large"><i style={{ width: `${progress}%` }} /></div>
    <div className="form-row drawer-dates"><label>开始日期<input type="date" value={goal.startDate} onChange={(event) => onSave({ startDate: event.target.value })} /></label><label>截止日期<input type="date" value={goal.dueDate} onChange={(event) => onSave({ dueDate: event.target.value })} /></label></div>
    <div className="section-heading"><div><ListChecks size={17} /><strong>里程碑</strong></div><span>{goal.milestones.filter((item) => item.completed).length}/{goal.milestones.length}</span></div>
    <div className="milestone-list">{goal.milestones.map((item) => <div key={item.id} className={item.completed ? 'completed' : ''}><button className="milestone-check" onClick={() => patchMilestone(item.id, { completed: !item.completed })}>{item.completed ? <CheckCircle2 size={19} /> : <Circle size={19} />}</button><div><input value={item.title} onChange={(event) => patchMilestone(item.id, { title: event.target.value })} /><span className={isOverdue(item.dueDate, item.completed) ? 'overdue' : ''}>{item.dueDate ? `${isOverdue(item.dueDate, item.completed) ? '已逾期 · ' : ''}${formatDate(item.dueDate)}` : '未设置日期'}</span></div><button className="ghost-danger" onClick={() => removeMilestone(item.id)}><Trash2 size={15} /></button></div>)}</div>
    <div className="milestone-add"><input value={milestoneTitle} onChange={(event) => setMilestoneTitle(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') addMilestone() }} placeholder="添加一个里程碑" /><input type="date" value={milestoneDue} onChange={(event) => setMilestoneDue(event.target.value)} /><button onClick={addMilestone} disabled={!milestoneTitle.trim()}><Plus size={17} /></button></div>
    <div className="goal-drawer-actions">{goal.status !== 'completed' && <button className="button primary" onClick={() => onSave({ status: 'completed' })}><Check size={16} />标记完成</button>}{goal.status === 'completed' && <button className="button secondary" onClick={() => onSave({ status: 'active' })}>重新开启</button>}<button className="button secondary" onClick={() => onSave({ status: goal.status === 'archived' ? 'active' : 'archived' })}><Archive size={16} />{goal.status === 'archived' ? '移出归档' : '归档'}</button><button className="icon-button danger push-right" onClick={onDelete}><Trash2 size={17} /></button></div>
  </div></aside></>
}
