import { useEffect, useState } from 'react'
import { Bell, Cake, Pencil, Plus, Settings2, Trash2 } from 'lucide-react'
import { useAppStore } from '../app/AppStore'
import type { BirthdayPerson, BirthdaySettings } from '../shared/types'
import { daysUntil, nextBirthday, validBirthdayDate } from '../birthdays/reminders'
import { newId } from '../utils'
import { DatePicker } from './DatePicker'
import { ConfirmDialog } from './ConfirmDialog'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Switch } from './ui/switch'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog'
import { externalNotificationStatus, sendBirthdayNotification, useBirthdayToast } from './BirthdayNotifications'

export function BirthdayTool() {
  const { snapshot, update } = useAppStore()
  const [editor, setEditor] = useState<BirthdayPerson | 'new' | null>(null)
  const [removing, setRemoving] = useState<BirthdayPerson | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [now, setNow] = useState(() => new Date())
  useEffect(() => { const timer = window.setInterval(() => setNow(new Date()), 30000); return () => clearInterval(timer) }, [])
  if (!snapshot) return null
  const state = snapshot.birthdays
  const sorted = [...state.people].sort((a, b) => nextBirthday(a, now).getTime() - nextBirthday(b, now).getTime() || a.name.localeCompare(b.name, 'zh-CN'))
  return <div className="tool-workspace birthday-workspace">
    <div className="panel-heading"><div><h2>生日通知</h2><p>记住每一个重要的人，让祝福准时抵达。</p></div><div className="birthday-actions"><Button variant="outline" onClick={() => setSettingsOpen(true)}><Settings2 size={16} />页内设置</Button><Button onClick={() => setEditor('new')}><Plus size={16} />添加生日</Button></div></div>
    <div className="birthday-summary"><Bell size={18} /><span>{state.settings.enabled ? `提前 ${state.settings.daysBefore} 天 · ${state.settings.time} 开始 · 每人每年最多 ${state.settings.repeatCount} 次` : '生日提醒已暂停，已保存的生日仍会保留。'}</span></div>
    <div className="birthday-list">{sorted.map((person) => {
      const date = nextBirthday(person, now)
      const remaining = daysUntil(date, now)
      return <article className="birthday-card" key={person.id}>
        <span className="tool-entry-icon rose"><Cake size={23} /></span>
        <div className="birthday-person"><strong className="user-content">{person.name}</strong><span className="private-date-value">{date.getMonth() + 1}月{date.getDate()}日 · 每年重复</span></div>
        <span className="birthday-countdown">{remaining === 0 ? '今天生日' : `还有 ${remaining} 天`}</span>
        <Switch checked={person.enabled} aria-label={`${person.name} 的生日提醒`} onCheckedChange={(enabled) => update((current) => ({ ...current, birthdays: { ...current.birthdays, people: current.birthdays.people.map((item) => item.id === person.id ? { ...item, enabled } : item) } }))} />
        <Button variant="ghost" size="icon" aria-label={`编辑 ${person.name} 的生日`} onClick={() => setEditor(person)}><Pencil size={16} /></Button>
        <Button variant="ghost" size="icon" aria-label={`删除 ${person.name} 的生日`} onClick={() => setRemoving(person)}><Trash2 size={16} /></Button>
      </article>
    })}</div>
    {!sorted.length && <div className="tool-empty birthday-empty"><Cake /><strong>把第一个生日记在这里</strong><span>添加名字和日期，之后每年都会提醒你。</span><Button onClick={() => setEditor('new')}><Plus size={16} />添加生日</Button></div>}
    {editor && <BirthdayEditor person={editor === 'new' ? null : editor} onClose={() => setEditor(null)} onSave={(person) => {
      update((current) => {
        const deliveries = { ...current.birthdays.deliveries }
        if (editor !== 'new' && editor.date !== person.date) delete deliveries[person.id]
        return { ...current, birthdays: { ...current.birthdays, deliveries, people: editor === 'new' ? [...current.birthdays.people, person] : current.birthdays.people.map((item) => item.id === person.id ? person : item) } }
      })
      setEditor(null)
    }} />}
    {settingsOpen && <BirthdaySettingsDialog settings={state.settings} onClose={() => setSettingsOpen(false)} onSave={(settings) => { update((current) => ({ ...current, birthdays: { ...current.birthdays, settings } })); setSettingsOpen(false) }} />}
    <ConfirmDialog open={Boolean(removing)} onOpenChange={(open) => { if (!open) setRemoving(null) }} title="删除生日" description={<>确定删除 <span className="user-content">{removing?.name}</span> 的生日和提醒记录吗？</>} destructive confirmLabel="删除" onConfirm={() => {
      update((current) => {
        const deliveries = { ...current.birthdays.deliveries }
        delete deliveries[removing!.id]
        return { ...current, birthdays: { ...current.birthdays, people: current.birthdays.people.filter((person) => person.id !== removing!.id), deliveries } }
      })
      setRemoving(null)
    }} />
  </div>
}

function BirthdayEditor({ person, onClose, onSave }: { person: BirthdayPerson | null; onClose: () => void; onSave: (person: BirthdayPerson) => void }) {
  const [name, setName] = useState(person?.name ?? '')
  const [date, setDate] = useState(person?.date ?? '')
  const valid = Boolean(name.trim()) && validBirthdayDate(date)
  return <Dialog open onOpenChange={(open) => { if (!open) onClose() }}><DialogContent size="md" className="birthday-editor"><DialogHeader><DialogTitle>{person ? '编辑生日' : '添加生日'}</DialogTitle><DialogDescription>按所选日期的月、日每年提醒；2 月 29 日在平年按 2 月 28 日提醒。</DialogDescription></DialogHeader>
    <form className="birthday-form" onSubmit={(event) => { event.preventDefault(); if (valid) onSave({ id: person?.id ?? newId(), name: name.trim(), date, enabled: person?.enabled ?? true }) }}>
      <label>名字<Input value={name} onChange={(event) => setName(event.target.value)} placeholder="想记住谁的生日？" maxLength={100} autoFocus /></label>
      <label>生日日期<DatePicker value={date} onChange={setDate} ariaLabel="生日日期" /></label>
      <DialogFooter><Button type="button" variant="outline" onClick={onClose}>取消</Button><Button type="submit" disabled={!valid}>保存生日</Button></DialogFooter>
    </form>
  </DialogContent></Dialog>
}

function BirthdaySettingsDialog({ settings, onClose, onSave }: { settings: BirthdaySettings; onClose: () => void; onSave: (settings: BirthdaySettings) => void }) {
  const [draft, setDraft] = useState(settings)
  const [days, setDays] = useState(String(settings.daysBefore))
  const [count, setCount] = useState(String(settings.repeatCount))
  const [interval, setInterval] = useState(String(settings.intervalHours))
  const [status, setStatus] = useState(externalNotificationStatus)
  const [testing, setTesting] = useState(false)
  const toast = useBirthdayToast()
  const numberValid = (value: string, min: number, max: number) => value !== '' && Number.isInteger(Number(value)) && Number(value) >= min && Number(value) <= max
  const valid = numberValid(days, 0, 365) && numberValid(count, 1, 20) && numberValid(interval, 1, 8760) && /^([01]\d|2[0-3]):[0-5]\d$/.test(draft.time)
  const toggles = [ ['enabled', '启用生日提醒', '总开关，关闭后暂停所有生日提醒。'], ['toast', 'App 内 toast', '在任意页面弹出生日提醒，可手动关闭。'], ['external', '系统通知', '通过浏览器或桌面系统发送外部通知。'] ] as const
  return <Dialog open onOpenChange={(open) => { if (!open) onClose() }}><DialogContent size="md" className="birthday-settings"><DialogHeader><DialogTitle>生日通知设置</DialogTitle><DialogDescription>设置对所有生日生效，单个人的提醒可在列表中暂停。</DialogDescription></DialogHeader>
    <form className="birthday-form" onSubmit={(event) => { event.preventDefault(); if (valid) onSave({ ...draft, daysBefore: Number(days), repeatCount: Number(count), intervalHours: Number(interval) }) }}>
      {toggles.map(([key, title, description]) => <label className="birthday-switch-row" key={key}><span><strong>{title}</strong><small>{description}</small></span><Switch checked={draft[key]} onCheckedChange={(checked) => setDraft({ ...draft, [key]: checked })} /></label>)}
      <div className="birthday-settings-grid">
        <label>提前多少天<Input type="number" min={0} max={365} value={days} onChange={(event) => setDays(event.target.value)} /><small>0 表示生日当天开始提醒</small></label>
        <label>开始提醒时间<Input type="time" value={draft.time} onChange={(event) => setDraft({ ...draft, time: event.target.value })} /><small>按设备本地时间</small></label>
        <label>最多提醒次数<Input type="number" min={1} max={20} value={count} onChange={(event) => setCount(event.target.value)} /><small>每人每年 1～20 次</small></label>
        <label>重复间隔（小时）<Input type="number" min={1} max={8760} value={interval} onChange={(event) => setInterval(event.target.value)} /><small>从上次提醒起计时，生日结束后停止</small></label>
      </div>
      <p className="birthday-help">网页需保持页面打开，桌面端需保持 App 运行（可以最小化）。重新打开时会补发当前提醒期的一次提醒，不会连续补发错过的通知。</p>
      <p className="birthday-help" role="status">{status}</p>
      <div className="birthday-actions">
        {!window.sylunae && <Button type="button" variant="outline" disabled={!window.isSecureContext || !('Notification' in window) || Notification.permission === 'denied' || Notification.permission === 'granted'} onClick={async () => { try { await Notification.requestPermission(); setStatus(externalNotificationStatus()) } catch { setStatus('无法请求系统通知权限，App 内提醒仍可使用。') } }}>允许系统通知</Button>}
        <Button type="button" variant="outline" disabled={testing || (!draft.toast && !draft.external)} onClick={async () => {
          setTesting(true)
          if (draft.toast) toast('这是一条测试提醒，愿每一份祝福都准时抵达。')
          const sent = draft.external ? await sendBirthdayNotification('生日通知已准备好，愿每一份祝福都准时抵达。') : false
          setStatus(draft.external ? (sent ? '已请求发送测试通知，请检查系统通知中心。' : externalNotificationStatus()) : '已弹出 App 内测试提醒。')
          setTesting(false)
        }}>测试通知</Button>
      </div>
      {!valid && <p className="birthday-help danger" role="alert">请填写有效的提醒参数：提前 0～365 天、次数 1～20、间隔 1～8760 小时。</p>}
      <DialogFooter><Button type="button" variant="outline" onClick={onClose}>取消</Button><Button type="submit" disabled={!valid}>保存设置</Button></DialogFooter>
    </form>
  </DialogContent></Dialog>
}
