import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { CalendarClock, Check, Circle, Clock3, ListTodo, Pause, Play, Plus, RotateCcw, Settings2, Target, TimerReset, Trash2 } from 'lucide-react'
import { useAppStore } from '../app/AppStore'
import type { PomodoroMode, QuickTodo, TodoPriority } from '../shared/types'
import { newId, nowIso } from '../utils'
import { GoalsPage } from './GoalsPage'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs'

export type TaskView = 'goals' | 'todos' | 'pomodoro' | 'countdown'

const viewMeta: Record<TaskView, { label: string; icon: typeof Target }> = {
  goals: { label: '目标追踪', icon: Target },
  todos: { label: '快速待办', icon: ListTodo },
  pomodoro: { label: '番茄钟', icon: Clock3 },
  countdown: { label: '倒数日', icon: CalendarClock },
}

export function TasksPage({ initialView = 'goals', startPomodoro = false }: { initialView?: TaskView; startPomodoro?: boolean }) {
  const [view, setView] = useState<TaskView>(initialView)
  const pageRef = useRef<HTMLElement>(null)
  useEffect(() => { pageRef.current?.scrollTo({ top: 0 }) }, [view])
  return <section ref={pageRef} className="page tasks-page">
    <header className="page-header"><div><span className="eyebrow">TASK SPACE</span><h1>任务箱</h1><p>让计划、专注与日常小事在同一个地方有序发生</p></div></header>
    <Tabs value={view} onValueChange={(value) => setView(value as TaskView)} className="workspace-tabs">
      <TabsList className="workspace-tab-list">{Object.entries(viewMeta).map(([id, item]) => { const Icon = item.icon; return <TabsTrigger key={id} value={id}><Icon size={16} />{item.label}{id === 'countdown' && <span className="soon-badge">即将推出</span>}</TabsTrigger> })}</TabsList>
    </Tabs>
    {view === 'goals' && <GoalsPage embedded />}
    {view === 'todos' && <TodoPanel />}
    {view === 'pomodoro' && <PomodoroPanel autoStart={startPomodoro} />}
    {view === 'countdown' && <CountdownPlaceholder />}
  </section>
}

function TodoPanel() {
  const { snapshot, update } = useAppStore()
  const todos = snapshot?.todos ?? []
  const [draft, setDraft] = useState('')
  const [priority, setPriority] = useState<TodoPriority>('medium')
  const [dueDate, setDueDate] = useState('')
  const [filter, setFilter] = useState<'open' | 'done' | 'all'>('open')
  const visible = useMemo(() => todos.filter((todo) => filter === 'all' || (filter === 'done' ? todo.completed : !todo.completed)), [todos, filter])
  const add = () => {
    const title = draft.trim()
    if (!title) return
    const now = nowIso()
    const todo: QuickTodo = { id: newId(), title, priority, dueDate, completed: false, createdAt: now, updatedAt: now }
    update((state) => ({ ...state, todos: [todo, ...state.todos] }))
    setDraft(''); setDueDate('')
  }
  const patch = (id: string, value: Partial<QuickTodo>) => update((state) => ({ ...state, todos: state.todos.map((todo) => todo.id === id ? { ...todo, ...value, updatedAt: nowIso() } : todo) }))
  const remove = (id: string) => update((state) => ({ ...state, todos: state.todos.filter((todo) => todo.id !== id) }))
  const openCount = todos.filter((todo) => !todo.completed).length
  return <div className="task-panel">
    <div className="panel-heading"><div><h2>快速待办</h2><p>{openCount ? `还有 ${openCount} 件小事等待完成` : '今天的待办已经清空'}</p></div></div>
    <div className="todo-composer">
      <Input value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') add() }} placeholder="写下一件要做的小事…" aria-label="待办内容" />
      <Select value={priority} onValueChange={(value) => setPriority(value as TodoPriority)}><SelectTrigger aria-label="优先级"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="high">高优先级</SelectItem><SelectItem value="medium">普通</SelectItem><SelectItem value="low">低优先级</SelectItem></SelectContent></Select>
      <Input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} aria-label="截止日期" />
      <Button className="button primary" onClick={add} disabled={!draft.trim()}><Plus size={17} />添加</Button>
    </div>
    <div className="todo-filter"><Tabs value={filter} onValueChange={(value) => setFilter(value as typeof filter)}><TabsList className="segmented"><TabsTrigger value="open">待完成</TabsTrigger><TabsTrigger value="done">已完成</TabsTrigger><TabsTrigger value="all">全部</TabsTrigger></TabsList></Tabs><span>{todos.filter((todo) => todo.completed).length} / {todos.length} 已完成</span></div>
    <div className="todo-list">{visible.length ? visible.map((todo) => <div className={`todo-row ${todo.completed ? 'completed' : ''}`} key={todo.id}>
      <button className="todo-check" onClick={() => patch(todo.id, { completed: !todo.completed })} aria-label={todo.completed ? '恢复待办' : '完成待办'}>{todo.completed ? <Check size={16} /> : <Circle size={18} />}</button>
      <div className="todo-copy"><input value={todo.title} onChange={(event) => patch(todo.id, { title: event.target.value })} aria-label="编辑待办" /><span><i className={`priority-dot ${todo.priority}`} />{todo.priority === 'high' ? '高优先级' : todo.priority === 'low' ? '低优先级' : '普通'}{todo.dueDate && <> · {todo.dueDate}</>}</span></div>
      <button className="icon-button danger" onClick={() => remove(todo.id)} aria-label="删除待办"><Trash2 size={16} /></button>
    </div>) : <div className="compact-empty"><ListTodo size={28} /><strong>{filter === 'done' ? '还没有已完成的待办' : '这里很清爽'}</strong><span>{filter === 'open' ? '随手记下一件小事，然后开始行动。' : '切换筛选查看其他待办。'}</span></div>}</div>
  </div>
}

const modeLabels: Record<PomodoroMode, string> = { focus: '专注', shortBreak: '短休息', longBreak: '长休息' }

function PomodoroPanel({ autoStart = false }: { autoStart?: boolean }) {
  const { snapshot, update } = useAppStore()
  const timer = snapshot!.pomodoro
  const autoStarted = useRef(false)
  const [editing, setEditing] = useState(false)
  const [draftConfig, setDraftConfig] = useState({ focusMinutes: String(timer.focusMinutes), shortBreakMinutes: String(timer.shortBreakMinutes), longBreakMinutes: String(timer.longBreakMinutes), sessionsBeforeLongBreak: String(timer.sessionsBeforeLongBreak) })

  useEffect(() => {
    if (!autoStart || autoStarted.current || timer.running) return
    autoStarted.current = true
    update((state) => ({ ...state, pomodoro: { ...state.pomodoro, running: true, endsAt: new Date(Date.now() + state.pomodoro.secondsRemaining * 1000).toISOString() } }))
  }, [autoStart, timer.running, update])

  useEffect(() => {
    if (!timer.running || !timer.endsAt) return
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((new Date(timer.endsAt!).getTime() - Date.now()) / 1000))
      if (remaining > 0) { update((state) => ({ ...state, pomodoro: { ...state.pomodoro, secondsRemaining: remaining } })); return }
      update((state) => {
        const finishedFocus = state.pomodoro.mode === 'focus'
        const completedSessions = state.pomodoro.completedSessions + (finishedFocus ? 1 : 0)
        const nextMode: PomodoroMode = finishedFocus ? (completedSessions % state.pomodoro.sessionsBeforeLongBreak === 0 ? 'longBreak' : 'shortBreak') : 'focus'
        const minutes = nextMode === 'focus' ? state.pomodoro.focusMinutes : nextMode === 'shortBreak' ? state.pomodoro.shortBreakMinutes : state.pomodoro.longBreakMinutes
        return { ...state, pomodoro: { ...state.pomodoro, mode: nextMode, completedSessions, secondsRemaining: minutes * 60, running: false, endsAt: null } }
      })
      if ('Notification' in window && Notification.permission === 'granted') new Notification('丝月工坊', { body: timer.mode === 'focus' ? '本轮专注完成，休息一下吧。' : '休息结束，准备开始下一轮专注。' })
    }
    tick()
    const id = window.setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [timer.running, timer.endsAt, timer.mode, update])

  const minutesFor = (mode: PomodoroMode) => mode === 'focus' ? timer.focusMinutes : mode === 'shortBreak' ? timer.shortBreakMinutes : timer.longBreakMinutes
  const switchMode = (mode: PomodoroMode) => update((state) => ({ ...state, pomodoro: { ...state.pomodoro, mode, secondsRemaining: minutesFor(mode) * 60, running: false, endsAt: null } }))
  const toggle = async () => {
    if (!timer.running && 'Notification' in window && Notification.permission === 'default') void Notification.requestPermission()
    update((state) => ({ ...state, pomodoro: { ...state.pomodoro, running: !state.pomodoro.running, endsAt: state.pomodoro.running ? null : new Date(Date.now() + state.pomodoro.secondsRemaining * 1000).toISOString() } }))
  }
  const reset = () => update((state) => ({ ...state, pomodoro: { ...state.pomodoro, secondsRemaining: minutesFor(state.pomodoro.mode) * 60, running: false, endsAt: null } }))
  const total = Math.max(1, minutesFor(timer.mode) * 60)
  const progress = Math.min(100, Math.max(0, ((total - timer.secondsRemaining) / total) * 100))
  const timeText = `${String(Math.floor(timer.secondsRemaining / 60)).padStart(2, '0')}:${String(timer.secondsRemaining % 60).padStart(2, '0')}`
  const saveConfig = () => {
    const numberInRange = (value: string, fallback: number, min: number, max: number) => Math.min(max, Math.max(min, Number(value) || fallback))
    const config = {
      focusMinutes: numberInRange(draftConfig.focusMinutes, timer.focusMinutes, 1, 120),
      shortBreakMinutes: numberInRange(draftConfig.shortBreakMinutes, timer.shortBreakMinutes, 1, 60),
      longBreakMinutes: numberInRange(draftConfig.longBreakMinutes, timer.longBreakMinutes, 1, 90),
      sessionsBeforeLongBreak: numberInRange(draftConfig.sessionsBeforeLongBreak, timer.sessionsBeforeLongBreak, 2, 10),
    }
    update((state) => {
      const durationKey = state.pomodoro.mode === 'focus' ? 'focusMinutes' : state.pomodoro.mode === 'shortBreak' ? 'shortBreakMinutes' : 'longBreakMinutes'
      return { ...state, pomodoro: { ...state.pomodoro, ...config, secondsRemaining: config[durationKey] * 60, running: false, endsAt: null } }
    })
  }

  return <div className="task-panel pomodoro-panel">
    <div className="panel-heading"><div><h2>番茄钟</h2><p>用清晰的专注与休息节奏，保护注意力</p></div><Button variant="outline" className="button secondary" onClick={() => setEditing((value) => !value)}><Settings2 size={16} />参数设置</Button></div>
    {editing && <div className="timer-settings"><label>专注时长<Input type="number" min="1" max="120" value={draftConfig.focusMinutes} onChange={(e) => setDraftConfig({ ...draftConfig, focusMinutes: e.target.value })} /><span>分钟</span></label><label>短休息<Input type="number" min="1" max="60" value={draftConfig.shortBreakMinutes} onChange={(e) => setDraftConfig({ ...draftConfig, shortBreakMinutes: e.target.value })} /><span>分钟</span></label><label>长休息<Input type="number" min="1" max="90" value={draftConfig.longBreakMinutes} onChange={(e) => setDraftConfig({ ...draftConfig, longBreakMinutes: e.target.value })} /><span>分钟</span></label><label>长休息间隔<Input type="number" min="2" max="10" value={draftConfig.sessionsBeforeLongBreak} onChange={(e) => setDraftConfig({ ...draftConfig, sessionsBeforeLongBreak: e.target.value })} /><span>轮</span></label><Button className="button primary" onClick={() => { saveConfig(); setEditing(false) }}>保存参数</Button></div>}
    <div className="pomodoro-layout"><div className="timer-card">
      <div className="timer-modes">{(['focus', 'shortBreak', 'longBreak'] as const).map((mode) => <button key={mode} className={timer.mode === mode ? 'active' : ''} onClick={() => switchMode(mode)}>{modeLabels[mode]}</button>)}</div>
      <div className="timer-ring" style={{ '--timer-progress': `${progress * 3.6}deg` } as CSSProperties}><div><span>{modeLabels[timer.mode]}</span><strong>{timeText}</strong><small>{timer.running ? '保持专注，慢慢来' : '准备好时就开始'}</small></div></div>
      <div className="timer-actions"><Button variant="outline" size="icon" className="timer-reset" onClick={reset} aria-label="重置"><RotateCcw size={18} /></Button><Button className="timer-main" onClick={toggle}>{timer.running ? <Pause size={22} /> : <Play size={22} fill="currentColor" />}{timer.running ? '暂停' : '开始'}</Button><Button variant="outline" size="icon" className="timer-reset" onClick={() => switchMode('shortBreak')} aria-label="跳到休息"><TimerReset size={18} /></Button></div>
      <div className="session-dots" aria-label={`已完成 ${timer.completedSessions} 轮专注`}>{Array.from({ length: timer.sessionsBeforeLongBreak }, (_, index) => <i key={index} className={index < timer.completedSessions % timer.sessionsBeforeLongBreak ? 'filled' : ''} />)}<span>完成 {timer.completedSessions} 轮</span></div>
    </div>
    <aside className="focus-guide"><h3>专注小提示</h3><ol><li>开始前，只选择一件现在要完成的事。</li><li>专注期间暂时记录打断，不立刻处理。</li><li>休息时离开屏幕，让眼睛和身体放松。</li></ol><div className="focus-quote">“一次只做一件事，也是一种温柔的秩序。”</div></aside></div>
  </div>
}

function CountdownPlaceholder() {
  return <div className="task-panel"><div className="panel-heading"><div><h2>倒数日</h2><p>把值得期待的日子，放在一眼就能看见的地方</p></div><span className="soon-badge large">即将推出</span></div><div className="countdown-preview"><div><span>距离下一个特别的日子</span><strong>— — —</strong><small>未来你可以在这里添加纪念日、旅行与重要节点</small></div><CalendarClock size={58} strokeWidth={1.2} /></div></div>
}
