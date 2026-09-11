import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, BookMarked, CheckSquare2, ChevronRight, Clipboard, Cloud, CloudLightning, CloudRain, CloudSun, FileText, ImagePlus, ListChecks, MapPin, Music2, NotebookPen, RotateCcw, Search, SlidersHorizontal, Snowflake, Sun, Target, Timer, Trash2 } from 'lucide-react'
import { useAppStore } from '../app/AppStore'
import type { HomeQuickActionId, HomeWallpaper, ToolId, WeatherLocation, WeatherSnapshot } from '../shared/types'
import { Spinner } from '../components/Icons'
import { Button } from '../components/ui/button'
import { Checkbox } from '../components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog'
import { Input } from '../components/ui/input'
import { Textarea } from '../components/ui/textarea'

const defaultWallpaper = '/images/wallpaper.webp'
const defaultWallpaperEntry: HomeWallpaper = { id: 'default', image: defaultWallpaper, title: '换一张喜欢的壁纸', description: '让每一次打开，都有好心情。' }
const defaultWallpaperList = [defaultWallpaperEntry]
const quotes = ['「 星光不问赶路人，时光自会给出答案。 」', '「 慢下来，和喜欢的一切在一起。 」', '「 在平凡的日子里，也要认真收藏光亮。 」', '「 允许一切慢慢发生，也相信每一步都有回响。 」', '「 新的一天无需完美，只要更靠近自己。 」']
interface CitySearchResult extends WeatherLocation { id: number }
type HomeIntent = 'new-note' | 'todos' | 'pomodoro' | 'clipboard'
interface QuickAction { id: HomeQuickActionId; label: string; hint: string; icon: ReactNode; tool: ToolId; intent?: HomeIntent }
const defaultQuickActionOrder: HomeQuickActionId[] = ['new-note', 'new-todo', 'pomodoro', 'music', 'collection']

export function HomePage({ onOpenTool }: { onOpenTool: (tool: ToolId, intent?: HomeIntent) => void }) {
  const { snapshot, update } = useAppStore()
  const [now, setNow] = useState(() => new Date())
  const [nameDialogOpen, setNameDialogOpen] = useState(false)
  const [quickActionsDialogOpen, setQuickActionsDialogOpen] = useState(false)
  const quote = useMemo(() => quotes[Math.floor(Math.random() * quotes.length)], [])
  useEffect(() => { const timer = window.setInterval(() => setNow(new Date()), 30_000); return () => clearInterval(timer) }, [])
  if (!snapshot) return null

  const hour = now.getHours()
  const greeting = hour < 5 ? '夜深了' : hour < 11 ? '早上好' : hour < 14 ? '中午好' : hour < 18 ? '下午好' : '晚上好'
  const period = hour < 5 ? 'GOOD NIGHT' : hour < 11 ? 'GOOD MORNING' : hour < 14 ? 'GOOD NOON' : hour < 18 ? 'GOOD AFTERNOON' : 'GOOD EVENING'
  const dateText = new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' }).format(now).replace('周', '星期')
  const openTodos = snapshot.todos.filter((todo) => !todo.completed)
  const activeGoals = snapshot.goals.filter((goal) => goal.status === 'active')
  const notes = snapshot.notes.filter((note) => !note.deletedAt)
  const latestNote = [...notes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]
  const usage = snapshot.settings.toolUsage

  const allQuickActions: QuickAction[] = [
    { id: 'new-note', label: '新建笔记', hint: '记录此刻的想法', icon: <FileText />, tool: 'notes', intent: 'new-note' },
    { id: 'new-todo', label: '添加待办', hint: '让事情井井有条', icon: <CheckSquare2 />, tool: 'tasks', intent: 'todos' },
    { id: 'pomodoro', label: '开始专注', hint: '保持高效与专注', icon: <Timer />, tool: 'tasks', intent: 'pomodoro' },
    { id: 'music', label: '继续播放', hint: snapshot.tracks.length ? `${snapshot.tracks.length} 首音乐已就绪` : '打开你的音乐', icon: <Music2 />, tool: 'music' },
    { id: 'collection', label: '打开收藏', hint: '回到喜欢的内容', icon: <BookMarked />, tool: 'collection' },
  ]
  const quickActions = snapshot.settings.homeQuickActions.map((id) => allQuickActions.find((action) => action.id === id)).filter((action): action is QuickAction => Boolean(action))
  const recent = [
    { label: '目标追踪', time: usage.tasks, icon: <Target />, tool: 'tasks' as ToolId },
    { label: '快速待办', time: usage.tasks, icon: <ListChecks />, tool: 'tasks' as ToolId, intent: 'todos' as HomeIntent },
    { label: latestNote?.title || '今日笔记', private: Boolean(latestNote?.title), time: latestNote?.updatedAt || usage.notes, icon: <NotebookPen />, tool: 'notes' as ToolId },
    { label: '最近播放', time: usage.music, icon: <Music2 />, tool: 'music' as ToolId },
    { label: '收藏夹', time: usage.collection, icon: <BookMarked />, tool: 'collection' as ToolId },
    { label: '剪贴板', time: usage.tools, icon: <Clipboard />, tool: 'tools' as ToolId, intent: 'clipboard' as HomeIntent },
  ].sort((a, b) => (b.time || '').localeCompare(a.time || ''))

  return <section className="home-page"><div className="home-layout">
    <header className="home-heading home-enter enter-1"><div><span>{period}</span><h1>{greeting}，<button type="button" className="display-name-trigger" onClick={() => setNameDialogOpen(true)} title="修改名字">{snapshot.settings.displayName}</button></h1><p>无论今天过得如何，愿你在这里，找到一片属于自己的宁静。</p><blockquote>{quote}</blockquote></div><div className="home-date"><strong>{dateText}</strong><span>在平凡的日子里，做不平凡的自己。</span></div></header>
    <div className="home-feature-row home-enter enter-2"><WeatherCard /><WallpaperCarousel wallpapers={snapshot.settings.homeWallpapers} onSave={(homeWallpapers) => update((state) => ({ ...state, settings: { ...state.settings, homeWallpaper: '', homeWallpapers, updatedAt: new Date().toISOString() } }))} /></div>
    <section className="home-quick home-enter enter-3"><div className="home-section-title"><div><h2>快速开始</h2></div><button type="button" onClick={() => setQuickActionsDialogOpen(true)}><SlidersHorizontal size={15} />自定义卡片</button></div><div className="quick-grid">{quickActions.map((action) => <button key={action.id} onClick={() => onOpenTool(action.tool, action.intent)}><span>{action.icon}</span><div><strong>{action.label}</strong><small>{action.hint}</small></div><ChevronRight size={15} /></button>)}</div></section>
    <div className="home-lower home-enter enter-4"><section className="home-recent"><div className="home-section-title"><div><h2>近期使用</h2></div></div><div className="recent-grid">{recent.map((item) => <button key={item.label} onClick={() => onOpenTool(item.tool, item.intent)}><span>{item.icon}</span><div><strong className={'private' in item && item.private ? 'user-content' : undefined}>{item.label}</strong><small>{formatRelativeTime(item.time)}</small></div><ChevronRight size={14} /></button>)}</div></section><section className="home-overview"><div className="home-section-title"><div><h2>今日概览</h2></div><span>{new Intl.DateTimeFormat('zh-CN').format(now)}</span></div><div className="overview-grid"><OverviewCard icon={<CheckSquare2 />} label="今日待办" value={openTodos.length} hint={`已完成 ${snapshot.todos.filter((todo) => todo.completed).length} 项`} /><OverviewCard icon={<Target />} label="进行中的目标" value={activeGoals.length} hint="保持专注 ✣" /><OverviewCard icon={<FileText />} label="最近笔记" value={notes.length} hint={latestNote ? latestNote.title : '等待记录'} privateHint={Boolean(latestNote)} /><OverviewCard icon={<Timer />} label="累计专注时长" value={formatFocusTime(snapshot.pomodoro.completedSessions * snapshot.pomodoro.focusMinutes)} hint={`${snapshot.pomodoro.completedSessions} 个番茄钟`} /></div><div className="overview-quote">♧　「 慢下来，和喜欢的一切在一起。 」</div></section></div>
  </div><DisplayNameDialog open={nameDialogOpen} name={snapshot.settings.displayName} onOpenChange={setNameDialogOpen} onSave={(displayName) => update((state) => ({ ...state, settings: { ...state.settings, displayName, updatedAt: new Date().toISOString() } }))} /><QuickActionsDialog open={quickActionsDialogOpen} actions={allQuickActions} selectedIds={snapshot.settings.homeQuickActions} onOpenChange={setQuickActionsDialogOpen} onSave={(homeQuickActions) => update((state) => ({ ...state, settings: { ...state.settings, homeQuickActions, updatedAt: new Date().toISOString() } }))} /></section>
}

function QuickActionsDialog({ open, actions, selectedIds, onOpenChange, onSave }: { open: boolean; actions: QuickAction[]; selectedIds: HomeQuickActionId[]; onOpenChange: (open: boolean) => void; onSave: (ids: HomeQuickActionId[]) => void }) {
  const [draftOrder, setDraftOrder] = useState<HomeQuickActionId[]>(defaultQuickActionOrder)
  const [visibleIds, setVisibleIds] = useState<Set<HomeQuickActionId>>(new Set(selectedIds))
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setDraftOrder([...selectedIds, ...defaultQuickActionOrder.filter((id) => !selectedIds.includes(id))])
    setVisibleIds(new Set(selectedIds))
    setError('')
  }, [open, selectedIds])

  const move = (index: number, direction: -1 | 1) => setDraftOrder((current) => {
    const target = index + direction
    if (target < 0 || target >= current.length) return current
    const next = [...current]
    ;[next[index], next[target]] = [next[target], next[index]]
    return next
  })
  const toggle = (id: HomeQuickActionId, checked: boolean) => {
    setVisibleIds((current) => {
      const next = new Set(current)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
    setError('')
  }
  const save = () => {
    const selected = draftOrder.filter((id) => visibleIds.has(id))
    if (!selected.length) { setError('请至少保留一张快捷卡片'); return }
    onSave(selected)
    onOpenChange(false)
  }

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent size="md" className="quick-actions-dialog"><DialogHeader><DialogTitle>自定义快捷卡片</DialogTitle><DialogDescription>选择主页要显示的入口，并调整它们的排列顺序。</DialogDescription></DialogHeader><div className="quick-actions-editor">{draftOrder.map((id, index) => { const action = actions.find((item) => item.id === id); if (!action) return null; const checked = visibleIds.has(id); return <div key={id} className={checked ? '' : 'disabled'}><Checkbox id={`quick-action-${id}`} checked={checked} onCheckedChange={(value) => toggle(id, value === true)} /><label htmlFor={`quick-action-${id}`}><span>{action.icon}</span><span><strong>{action.label}</strong><small>{action.hint}</small></span></label><div className="quick-action-order"><Button type="button" variant="ghost" size="icon-sm" disabled={index === 0} onClick={() => move(index, -1)} aria-label={`上移${action.label}`}><ArrowUp /></Button><Button type="button" variant="ghost" size="icon-sm" disabled={index === draftOrder.length - 1} onClick={() => move(index, 1)} aria-label={`下移${action.label}`}><ArrowDown /></Button></div></div> })}</div>{error && <p className="quick-actions-error">{error}</p>}<DialogFooter className="quick-actions-footer"><Button type="button" variant="ghost" className="quick-actions-reset" onClick={() => { setDraftOrder(defaultQuickActionOrder); setVisibleIds(new Set(defaultQuickActionOrder)); setError('') }}><RotateCcw />恢复默认</Button><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>取消</Button><Button type="button" onClick={save}>保存</Button></DialogFooter></DialogContent></Dialog>
}

function DisplayNameDialog({ open, name, onOpenChange, onSave }: { open: boolean; name: string; onOpenChange: (open: boolean) => void; onSave: (name: string) => void }) {
  const [draft, setDraft] = useState(name)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setDraft(name)
    setError('')
  }, [open, name])

  const save = () => {
    const displayName = draft.trim()
    if (!displayName) { setError('名字不能为空'); return }
    onSave(displayName)
    onOpenChange(false)
  }

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent size="sm"><DialogHeader><DialogTitle>修改名字</DialogTitle><DialogDescription>这个名字会显示在主页的问候语中。</DialogDescription></DialogHeader><form onSubmit={(event) => { event.preventDefault(); save() }}><label className="display-name-field">名字<Input autoFocus value={draft} maxLength={32} onChange={(event) => setDraft(event.target.value)} placeholder="输入你的名字" /></label>{error && <p className="display-name-error">{error}</p>}<DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>取消</Button><Button type="submit">保存</Button></DialogFooter></form></DialogContent></Dialog>
}

function WallpaperCarousel({ wallpapers: customWallpapers, onSave }: { wallpapers: HomeWallpaper[]; onSave: (wallpapers: HomeWallpaper[]) => void }) {
  const wallpapers = customWallpapers.length ? customWallpapers : defaultWallpaperList
  const [activeIndex, setActiveIndex] = useState(0)
  const [outgoing, setOutgoing] = useState<HomeWallpaper | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)

  useEffect(() => {
    if (activeIndex < wallpapers.length) return
    setActiveIndex(0)
    setOutgoing(null)
  }, [activeIndex, wallpapers.length])

  useEffect(() => {
    if (wallpapers.length < 2 || settingsOpen) return
    const timer = window.setInterval(() => {
      setActiveIndex((current) => {
        setOutgoing(wallpapers[current])
        return (current + 1) % wallpapers.length
      })
    }, 7_000)
    return () => clearInterval(timer)
  }, [settingsOpen, wallpapers])

  const active = wallpapers[activeIndex] ?? wallpapers[0]
  const slideNumber = String(activeIndex + 1).padStart(2, '0')
  const slideCount = String(wallpapers.length).padStart(2, '0')
  return <>
    <button type="button" className="wallpaper-card" onClick={() => setSettingsOpen(true)} aria-label="打开壁纸设置">
      <span key={active.id} className={`wallpaper-layer ${active.id !== 'default' ? 'private-media' : ''} ${outgoing ? 'wallpaper-layer-incoming' : ''}`} style={{ backgroundImage: `url(${JSON.stringify(active.image)})` }} />
      {outgoing && <span key={outgoing.id} className={`wallpaper-layer wallpaper-layer-outgoing ${outgoing.id !== 'default' ? 'private-media' : ''}`} style={{ backgroundImage: `url(${JSON.stringify(outgoing.image)})` }} onAnimationEnd={() => setOutgoing(null)} />}
      {outgoing && <span key={`glint-${active.id}`} className="wallpaper-glint" />}
      <span className={`wallpaper-shade ${active.id !== 'default' || Boolean(outgoing && outgoing.id !== 'default') ? 'private-media-backdrop' : ''}`} />
      <div key={`progress-${active.id}-${settingsOpen}`} className="wallpaper-progress" aria-hidden>{wallpapers.map((wallpaper, index) => <i key={wallpaper.id} className={index === activeIndex ? 'active' : ''} />)}</div>
      <div key={`active-copy-${active.id}`} className={`wallpaper-copy ${active.id !== 'default' ? 'user-wallpaper-copy' : ''} ${outgoing ? 'wallpaper-copy-incoming' : ''}`}><strong>{active.title}</strong><span>{active.description}</span></div>
      {outgoing && <div key={`copy-${outgoing.id}`} className={`wallpaper-copy wallpaper-copy-outgoing ${outgoing.id !== 'default' ? 'user-wallpaper-copy' : ''}`}><strong>{outgoing.title}</strong><span>{outgoing.description}</span></div>}
    </button>
    <WallpaperSettingsDialog open={settingsOpen} wallpapers={customWallpapers} onOpenChange={setSettingsOpen} onSave={onSave} />
  </>
}

function WallpaperSettingsDialog({ open, wallpapers, onOpenChange, onSave }: { open: boolean; wallpapers: HomeWallpaper[]; onOpenChange: (open: boolean) => void; onSave: (wallpapers: HomeWallpaper[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [draft, setDraft] = useState<HomeWallpaper[]>(wallpapers)
  const [selectedId, setSelectedId] = useState<string | null>(wallpapers[0]?.id ?? null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setDraft(wallpapers.map((wallpaper) => ({ ...wallpaper })))
    setSelectedId(wallpapers[0]?.id ?? null)
    setError('')
  }, [open, wallpapers])

  const selected = draft.find((wallpaper) => wallpaper.id === selectedId) ?? null
  const addWallpapers = async (files: FileList | null) => {
    setError('')
    if (!files?.length) return
    const remaining = 5 - draft.length
    if (remaining <= 0) { setError('最多只能设置 5 张壁纸'); return }
    const candidates = Array.from(files).slice(0, remaining)
    const invalid = candidates.find((file) => !file.type.startsWith('image/') || file.size > 12 * 1024 * 1024)
    if (invalid) { setError(!invalid.type.startsWith('image/') ? '请选择图片文件' : '每张壁纸请勿超过 12 MB'); return }
    try {
      const additions = await Promise.all(candidates.map(async (file) => ({
        id: crypto.randomUUID(),
        image: await readImage(file),
        title: defaultWallpaperEntry.title,
        description: defaultWallpaperEntry.description,
      })))
      setDraft((current) => [...current, ...additions].slice(0, 5))
      setSelectedId(additions[0]?.id ?? null)
      if (files.length > remaining) setError(`已添加前 ${remaining} 张，壁纸最多 5 张`)
    } catch { setError('无法读取选中的图片') }
  }
  const updateSelected = (changes: Partial<Pick<HomeWallpaper, 'title' | 'description'>>) => setDraft((current) => current.map((wallpaper) => wallpaper.id === selectedId ? { ...wallpaper, ...changes } : wallpaper))
  const removeWallpaper = (id: string) => setDraft((current) => {
    const next = current.filter((wallpaper) => wallpaper.id !== id)
    if (selectedId === id) setSelectedId(next[0]?.id ?? null)
    return next
  })

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent size="lg" className="wallpaper-settings-dialog"><DialogHeader><DialogTitle>壁纸设置</DialogTitle><DialogDescription>添加最多 5 张壁纸并为每张图片设置独立文案。保存后会自动轮播；清空列表时使用默认壁纸。</DialogDescription></DialogHeader>
    <div className="wallpaper-settings-body">
      <div className="wallpaper-settings-list">
        <div className="wallpaper-settings-list-head"><strong>我的壁纸</strong><span>{draft.length} / 5</span></div>
        <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={(event) => { void addWallpapers(event.target.files); event.currentTarget.value = '' }} />
        <Button type="button" variant="outline" className="wallpaper-add" disabled={draft.length >= 5} onClick={() => inputRef.current?.click()}><ImagePlus size={16} />添加壁纸</Button>
        <div className="wallpaper-settings-items">{draft.map((wallpaper, index) => <div key={wallpaper.id} className={`wallpaper-settings-item ${wallpaper.id === selectedId ? 'active' : ''}`}>
          <button type="button" onClick={() => setSelectedId(wallpaper.id)}><span className="private-media" style={{ backgroundImage: `url(${JSON.stringify(wallpaper.image)})` }} /><strong>壁纸 {index + 1}</strong></button>
          <Button type="button" variant="ghost" size="icon-sm" aria-label={`删除壁纸 ${index + 1}`} onClick={() => removeWallpaper(wallpaper.id)}><Trash2 size={15} /></Button>
        </div>)}</div>
        {!draft.length && <div className="wallpaper-settings-empty"><ImagePlus size={24} /><span>还没有自定义壁纸</span><small>主页将继续显示默认壁纸</small></div>}
      </div>
      <div className="wallpaper-copy-editor">{selected ? <><div className="wallpaper-editor-preview"><span className="wallpaper-editor-preview-bg private-media" style={{ backgroundImage: `url(${JSON.stringify(selected.image)})` }} /><div><strong>{selected.title}</strong><span>{selected.description}</span></div></div><label>主文案<Input value={selected.title} maxLength={40} onChange={(event) => updateSelected({ title: event.target.value })} placeholder="输入主文案" /></label><label>副文案<Textarea value={selected.description} maxLength={80} rows={3} onChange={(event) => updateSelected({ description: event.target.value })} placeholder="输入副文案" /></label></> : <div className="wallpaper-editor-empty"><strong>添加一张壁纸开始设置</strong><span>选中壁纸后，可在这里编辑它的专属文案。</span></div>}</div>
    </div>
    {error && <p className="wallpaper-settings-error">{error}</p>}
    <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button><Button onClick={() => { onSave(draft.map((wallpaper) => ({ ...wallpaper, title: wallpaper.title.trim(), description: wallpaper.description.trim() }))); onOpenChange(false) }}>保存设置</Button></DialogFooter>
  </DialogContent></Dialog>
}

function readImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

function WeatherCard() {
  const { snapshot, update } = useAppStore()
  const location = snapshot?.settings.weatherLocation
  const cached = snapshot?.settings.weatherCache
  const cacheMatches = Boolean(location && cached && sameLocation(cached.location, location))
  const [weather, setWeather] = useState<WeatherSnapshot | null>(() => cacheMatches ? cached ?? null : null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('正在读取天气…')
  const [locationOpen, setLocationOpen] = useState(false)
  const [retryToken, setRetryToken] = useState(0)

  useEffect(() => {
    if (!location) return
    const localCache = cached && sameLocation(cached.location, location) ? cached : null
    setWeather(localCache)
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 12000)
    let disposed = false
    const loadForecast = async () => {
      setLoading(true)
      setMessage('正在读取天气…')
      try {
        const params = new URLSearchParams({ latitude: String(location.latitude), longitude: String(location.longitude), current: 'temperature_2m,apparent_temperature,weather_code', daily: 'weather_code,temperature_2m_max,temperature_2m_min', timezone: location.timezone || 'auto', forecast_days: '3' })
        const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { signal: controller.signal })
        if (!response.ok) throw new Error('weather unavailable')
        const data = await response.json() as { current: { temperature_2m: number; apparent_temperature: number; weather_code: number }; daily: { weather_code: number[]; temperature_2m_min: number[]; temperature_2m_max: number[] } }
        if (disposed) return
        const next: WeatherSnapshot = { location, temperature: Math.round(data.current.temperature_2m), apparent: Math.round(data.current.apparent_temperature), code: data.current.weather_code, daily: data.daily.weather_code.map((code, index) => ({ code, minimum: Math.round(data.daily.temperature_2m_min[index]), maximum: Math.round(data.daily.temperature_2m_max[index]) })), fetchedAt: new Date().toISOString() }
        setWeather(next)
        setMessage('')
        update((state) => ({ ...state, settings: { ...state.settings, weatherCache: next, updatedAt: new Date().toISOString() } }))
      } catch {
        if (!disposed) setMessage(localCache ? '当前显示上次成功获取的天气' : '天气暂时没有回应，请点击重试')
      } finally {
        clearTimeout(timeout)
        if (!disposed) setLoading(false)
      }
    }
    void loadForecast()
    return () => { disposed = true; clearTimeout(timeout); controller.abort() }
  }, [location?.name, location?.latitude, location?.longitude, location?.timezone, retryToken])

  if (!snapshot || !location) return null
  const WeatherIcon = weatherIcon(weather?.code)
  return <><section className="home-weather">{weather ? <><button className="weather-location" onClick={() => setLocationOpen(true)} title="选择天气地区"><MapPin size={13} />{weather.location.name}<ChevronRight size={13} /></button><div className="weather-current"><WeatherIcon /><strong>{weather.temperature}°</strong></div><h2>{weatherText(weather.code)}</h2><p>体感 {weather.apparent}°　|　{loading ? '正在更新' : message.startsWith('当前显示') ? '上次天气' : '今日天气'}</p><div className="weather-forecast">{weather.daily.map((day, index) => { const Icon = weatherIcon(day.code); return <div key={index}><span>{index === 0 ? '今天' : index === 1 ? '明天' : '后天'}</span><strong>{day.minimum}° / {day.maximum}°</strong><Icon /></div> })}</div></> : <button className="weather-request" onClick={() => setRetryToken((value) => value + 1)} disabled={loading}>{loading ? <Spinner /> : <CloudSun size={34} />}<strong>{message}</strong><span>{loading ? `正在获取${location.name}天气` : '点击重试'}</span></button>}</section><LocationDialog open={locationOpen} current={location} onOpenChange={setLocationOpen} onSelect={(next) => { update((state) => ({ ...state, settings: { ...state.settings, weatherLocation: next, updatedAt: new Date().toISOString() } })); setLocationOpen(false) }} /></>
}

function LocationDialog({ open, current, onOpenChange, onSelect }: { open: boolean; current: WeatherLocation; onOpenChange: (open: boolean) => void; onSelect: (location: WeatherLocation) => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<CitySearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { if (!open) { setQuery(''); setResults([]); setError('') } }, [open])
  const searchCities = async () => {
    const clean = query.trim()
    if (clean.length < 2) { setError('请输入至少 2 个字符'); return }
    setSearching(true); setError('')
    const controller = new AbortController(); const timeout = window.setTimeout(() => controller.abort(), 10000)
    try {
      const params = new URLSearchParams({ name: clean, count: '8', language: 'zh', format: 'json' })
      const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params}`, { signal: controller.signal })
      if (!response.ok) throw new Error('search unavailable')
      const data = await response.json() as { results?: Array<{ id: number; name: string; latitude: number; longitude: number; country?: string; admin1?: string; timezone?: string }> }
      const next = (data.results ?? []).map((item) => ({ id: item.id, name: item.name, country: item.country ?? '', admin1: item.admin1 ?? '', latitude: item.latitude, longitude: item.longitude, timezone: item.timezone ?? 'auto' }))
      setResults(next)
      if (!next.length) setError('没有找到这个地区，请换个关键词试试')
    } catch { setError('地区搜索暂时不可用，请稍后重试') }
    finally { clearTimeout(timeout); setSearching(false) }
  }
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="weather-location-dialog" size="md"><DialogHeader><DialogTitle>选择天气地区</DialogTitle><DialogDescription>默认使用吉隆坡。搜索并选择城市后会保存在本机，不需要系统定位权限。</DialogDescription></DialogHeader><form className="weather-search" onSubmit={(event) => { event.preventDefault(); void searchCities() }}><label><Search size={16} /><Input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索城市，例如：北京、Tokyo" /></label><Button type="submit" disabled={searching}>{searching ? <Spinner /> : '搜索'}</Button></form>{error && <p className="weather-search-error">{error}</p>}<div className="weather-search-results">{results.length ? results.map((item) => <button key={`${item.id}-${item.latitude}`} onClick={() => onSelect(item)} className={sameLocation(item, current) ? 'active' : ''}><MapPin size={16} /><span><strong>{item.name}</strong><small>{[item.admin1, item.country].filter(Boolean).join(' · ') || '地区信息未知'}</small></span>{sameLocation(item, current) && <em>当前</em>}<ChevronRight size={15} /></button>) : !error && <div className="weather-search-empty"><CloudSun size={28} /><span>输入城市名称，选择你想关注的天气</span></div>}</div><p className="weather-provider">天气与地区数据由 Open-Meteo 提供</p></DialogContent></Dialog>
}

function sameLocation(a: WeatherLocation, b: WeatherLocation) { return a.latitude === b.latitude && a.longitude === b.longitude }

function OverviewCard({ icon, label, value, hint, privateHint = false }: { icon: ReactNode; label: string; value: number | string; hint: string; privateHint?: boolean }) { return <article><div>{icon}<span>{label}</span></div><strong>{value}</strong><small className={privateHint ? 'user-content' : undefined}>{hint}</small></article> }
function formatRelativeTime(value?: string) { if (!value) return '还没有使用记录'; const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60_000)); if (minutes < 1) return '刚刚使用'; if (minutes < 60) return `上次使用 ${minutes} 分钟前`; if (minutes < 1440) return `上次使用 ${Math.floor(minutes / 60)} 小时前`; return `上次使用 ${Math.floor(minutes / 1440)} 天前` }
function formatFocusTime(minutes: number) { return minutes >= 60 ? `${(minutes / 60).toFixed(minutes % 60 ? 1 : 0)} 小时` : `${minutes} 分钟` }
function weatherText(code = -1) { if (code === 0) return '晴朗'; if (code <= 3) return '多云'; if (code === 45 || code === 48) return '有雾'; if (code >= 71 && code <= 86) return '有雪'; if (code >= 51 && code <= 82) return '有雨'; if (code >= 95) return '雷雨'; return '天气未知' }
function weatherIcon(code = -1) { if (code === 0) return Sun; if (code <= 3) return CloudSun; if (code >= 71 && code <= 86) return Snowflake; if (code >= 95) return CloudLightning; if (code >= 51 && code <= 82) return CloudRain; return Cloud }
