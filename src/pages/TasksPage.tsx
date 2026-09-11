import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import confetti, { type Options as ConfettiOptions } from 'canvas-confetti'
import { CalendarClock, Check, Circle, Clock3, History, ListTodo, Pause, Play, Plus, RotateCcw, Settings2, Sparkles, Target, TimerReset, Trash2, TrendingUp } from 'lucide-react'
import { useAppStore } from '../app/AppStore'
import type { PomodoroMode, QuickTodo } from '../shared/types'
import { newId, nowIso } from '../utils'
import { GoalsPage } from './GoalsPage'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs'
import { unlockPomodoroAlarm } from '../utils/pomodoroAlarm'
import { usePersistentState } from '../lib/usePersistentState'

export type TaskView = 'goals' | 'todos' | 'pomodoro' | 'countdown'

const viewMeta: Record<TaskView, { label: string; icon: typeof Target }> = {
  goals: { label: '目标追踪', icon: Target },
  todos: { label: '快速待办', icon: ListTodo },
  pomodoro: { label: '番茄钟', icon: Clock3 },
  countdown: { label: '倒数日', icon: CalendarClock },
}

const todoConfetti = confetti.create(undefined, { resize: true, useWorker: false })

export function TasksPage({ initialView = 'goals', startPomodoro = false, view, onViewChange }: { initialView?: TaskView; startPomodoro?: boolean; view?: TaskView; onViewChange?: (view: TaskView) => void }) {
  const [storedView, setStoredView] = usePersistentState<TaskView>('navigation.tasksView', initialView)
  const activeView = view ?? storedView
  const setView = onViewChange ?? setStoredView
  const pageRef = useRef<HTMLElement>(null)
  useEffect(() => { if (initialView !== 'goals') setView(initialView) }, [initialView, setView])
  useEffect(() => { pageRef.current?.scrollTo({ top: 0 }) }, [activeView])
  return <section ref={pageRef} className="page tasks-page">
    <header className="page-header"><div><span className="eyebrow">TASK SPACE</span><h1>任务箱</h1><p>让计划、专注与日常小事在同一个地方有序发生</p></div></header>
    <Tabs value={activeView} onValueChange={(value) => setView(value as TaskView)} className="workspace-tabs">
      <TabsList className="workspace-tab-list">{Object.entries(viewMeta).map(([id, item]) => { const Icon = item.icon; return <TabsTrigger key={id} value={id}><Icon size={16} />{item.label}{id === 'countdown' && <span className="soon-badge">即将推出</span>}</TabsTrigger> })}</TabsList>
    </Tabs>
    {activeView === 'goals' && <GoalsPage embedded />}
    {activeView === 'todos' && <TodoPanel />}
    {activeView === 'pomodoro' && <PomodoroPanel autoStart={startPomodoro} />}
    {activeView === 'countdown' && <CountdownPlaceholder />}
  </section>
}

function TodoPanel() {
  const { snapshot, update } = useAppStore()
  const todos = snapshot?.todos ?? []
  const goals = snapshot?.goals ?? []
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const visible = useMemo(() => [...todos].sort((a, b) => Number(a.completed) - Number(b.completed) || (a.completed ? (b.completedAt ?? b.updatedAt).localeCompare(a.completedAt ?? a.updatedAt) : b.createdAt.localeCompare(a.createdAt))), [todos])
  useEffect(() => {
    const timer = window.setTimeout(() => inputRef.current?.focus(), 50)
    return () => window.clearTimeout(timer)
  }, [])
  const add = () => {
    const title = draft.trim()
    if (!title) return
    const now = nowIso()
    const todo: QuickTodo = { id: newId(), title, priority: 'medium', dueDate: '', completed: false, completedAt: null, createdAt: now, updatedAt: now }
    update((state) => ({ ...state, todos: [todo, ...state.todos] }))
    setDraft('')
  }
  const patch = (id: string, value: Partial<QuickTodo>) => update((state) => ({ ...state, todos: state.todos.map((todo) => todo.id === id ? { ...todo, ...value, updatedAt: nowIso() } : todo) }))
  const remove = (id: string) => update((state) => ({ ...state, todos: state.todos.filter((todo) => todo.id !== id) }))
  const toggle = (todo: QuickTodo, target: HTMLButtonElement) => {
    if (todo.completed) { patch(todo.id, { completed: false, completedAt: null }); return }
    const rect = target.getBoundingClientRect()
    patch(todo.id, { completed: true, completedAt: nowIso() })
    launchTodoConfetti(rect)
  }
  const now = Date.now()
  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0)
  const sevenDaysAgo = now - 7 * 86400000
  const openTodos = todos.filter((todo) => !todo.completed)
  const completedToday = todos.filter((todo) => todo.completed && new Date(todo.completedAt ?? todo.updatedAt).getTime() >= startOfToday.getTime()).length
  const completedRecently = todos.filter((todo) => todo.completed && new Date(todo.completedAt ?? todo.updatedAt).getTime() >= sevenDaysAgo)
  const timedCompleted = completedRecently.filter((todo) => todo.completedAt)
  const averageHours = timedCompleted.length ? timedCompleted.reduce((sum, todo) => sum + Math.max(0, new Date(todo.completedAt!).getTime() - new Date(todo.createdAt).getTime()), 0) / timedCompleted.length / 3600000 : 0
  const oldest = [...openTodos].sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0]
  const oldestDays = oldest ? Math.max(0, Math.floor((now - new Date(oldest.createdAt).getTime()) / 86400000)) : 0
  const insight = !openTodos.length ? '待办清单清理完毕，好棒好棒！' : oldestDays >= 7 ? `“${oldest.title}”已经停留 ${oldestDays} 天，也许可以把它拆小或删掉。` : openTodos.length > 8 ? '清单有点拥挤，先选一件两分钟内能完成的小事吧。' : '清单保持轻盈，完成一件就会为下一件腾出空间。'
  return <div className="task-panel todo-panel">
    <div className="panel-heading"><div><h2>快速待办</h2><p>{openTodos.length ? `${openTodos.length} 件小事，想到就记下，做完就划掉` : '今天的清单已经清空'}</p></div><span className="todo-completion-count"><Check size={14} />今天完成 {completedToday}</span></div>
    <div className="todo-quick-composer"><Plus size={19} /><Input ref={inputRef} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.nativeEvent.isComposing) add() }} placeholder="现在要做什么？按 Enter 添加" aria-label="快速添加待办" /><kbd>Enter</kbd></div>
    <div className="todo-list quick-list">{visible.length ? visible.map((todo) => <div className={`todo-row ${todo.completed ? 'completed' : ''}`} key={todo.id}>
      <button className="todo-check" onClick={(event) => toggle(todo, event.currentTarget)} aria-label={todo.completed ? '恢复待办' : '完成待办'}>{todo.completed ? <Check size={16} /> : <Circle size={18} />}</button>
      <div className="todo-copy"><input value={todo.title} onChange={(event) => patch(todo.id, { title: event.target.value })} aria-label="编辑待办" /><div className="todo-meta-line"><span className="todo-time-line"><Clock3 size={11} />{todo.completed && todo.completedAt ? `完成于 ${formatTodoTimestamp(todo.completedAt)} · 用时 ${formatTodoDuration(Math.max(0, (new Date(todo.completedAt).getTime() - new Date(todo.createdAt).getTime()) / 3600000))}` : `创建于 ${formatTodoTimestamp(todo.createdAt)} · 已存留 ${formatTodoDuration(Math.max(0, (Date.now() - new Date(todo.createdAt).getTime()) / 3600000))}`}</span>{todo.goalId && <span className="todo-origin-line"><Target size={11} />来自目标：{goals.find((goal) => goal.id === todo.goalId)?.title ?? '已删除的目标'}</span>}</div></div>
      <button className="icon-button danger todo-remove" onClick={() => remove(todo.id)} aria-label="删除待办"><Trash2 size={16} /></button>
    </div>) : <div className="compact-empty"><ListTodo size={28} /><strong>这里很清爽</strong><span>输入一件小事，按下 Enter 就记好了。</span></div>}</div>
    <section className="todo-review" aria-label="待办复盘"><div className="todo-review-heading"><div><Sparkles size={17} /><div><strong>清单复盘</strong><small>了解自己的节奏</small></div></div></div><div className="todo-review-grid"><TodoInsight icon={<Check />} value={String(completedToday)} label="今天完成" /><TodoInsight icon={<TrendingUp />} value={String(completedRecently.length)} label="近 7 天完成" /><TodoInsight icon={<History />} value={timedCompleted.length ? formatTodoDuration(averageHours) : '—'} label="平均完成用时" /><TodoInsight icon={<Clock3 />} value={oldest ? (oldestDays ? `${oldestDays} 天` : '今天') : '—'} label="最长等待" /></div><p>{insight}</p></section>
  </div>
}

function launchTodoConfetti(source: DOMRect) {
  const origin = {
    x: Math.min(0.98, Math.max(0.02, (source.left + source.width / 2) / window.innerWidth)),
    y: Math.min(0.96, Math.max(0.04, (source.top + source.height / 2) / window.innerHeight)),
  }
  const base: ConfettiOptions = {
    colors: ['#ef476f', '#ffd166', '#06d6a0', '#118ab2', '#7b61ff', '#f78c6b'],
    disableForReducedMotion: true,
    angle: 90,
    gravity: 1.08,
    decay: 0.91,
    ticks: 170,
    scalar: 0.9,
    spread: 54,
    startVelocity: 38,
    origin,
    zIndex: 130,
  }
  void todoConfetti({ ...base, particleCount: 44 })
  window.setTimeout(() => void todoConfetti({ ...base, particleCount: 18, spread: 68, startVelocity: 30 }), 90)
}

function formatTodoDuration(hours: number): string {
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} 分钟`
  if (hours < 24) return `${Math.round(hours)} 小时`
  return `${Math.round(hours / 24)} 天`
}

function formatTodoTimestamp(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '未知时间'
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const startOfYesterday = startOfToday - 86400000
  const time = date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
  if (date.getTime() >= startOfToday) return `今天 ${time}`
  if (date.getTime() >= startOfYesterday) return `昨天 ${time}`
  return `${date.getMonth() + 1}月${date.getDate()}日 ${time}`
}

function TodoInsight({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return <div><span>{icon}</span><strong>{value}</strong><small>{label}</small></div>
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

  const minutesFor = (mode: PomodoroMode) => mode === 'focus' ? timer.focusMinutes : mode === 'shortBreak' ? timer.shortBreakMinutes : timer.longBreakMinutes
  const switchMode = (mode: PomodoroMode) => update((state) => ({ ...state, pomodoro: { ...state.pomodoro, mode, secondsRemaining: minutesFor(mode) * 60, running: false, endsAt: null } }))
  const toggle = async () => {
    if (!timer.running) unlockPomodoroAlarm()
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
