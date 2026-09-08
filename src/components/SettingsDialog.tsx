import { useEffect, useRef, useState } from 'react'
import { Check, Database, Download, ExternalLink, FileWarning, Globe2, HardDrive, Info, Laptop, Link2, Moon, Palette, Settings, Sun, Upload, UserRound, X } from 'lucide-react'
import { useAppStore } from '../app/AppStore'
import { backupSummary, createBackup, parseBackup } from '../data/backup'
import type { BackupEnvelope, ThemeMode } from '../shared/types'
import { nowIso } from '../utils'
import { ConfirmDialog } from './ConfirmDialog'
import { Button } from './ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from './ui/dialog'
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerTitle } from './ui/drawer'
import { Input } from './ui/input'

type SettingsSection = 'appearance' | 'connections' | 'data' | 'about'

const sections: Array<{ id: SettingsSection; label: string; description: string; icon: typeof Settings }> = [
  { id: 'appearance', label: '外观', description: '主题与显示', icon: Palette },
  { id: 'connections', label: '关联服务', description: 'Bangumi 收藏', icon: Link2 },
  { id: 'data', label: '数据与备份', description: '导入、导出', icon: Database },
  { id: 'about', label: '关于', description: '环境与版本', icon: Info },
]

export function SettingsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const isMobile = useMediaQuery('(max-width: 760px)')

  if (isMobile) {
    return <Drawer open={open} onOpenChange={onOpenChange} direction="bottom">
      <DrawerContent className="settings-drawer">
        <DrawerTitle className="sr-only">设置</DrawerTitle>
        <DrawerDescription className="sr-only">调整丝月工坊的外观、关联服务、数据与运行环境</DrawerDescription>
        <DrawerClose asChild><Button variant="ghost" size="icon-sm" className="settings-overlay-close"><X /><span className="sr-only">关闭设置</span></Button></DrawerClose>
        <SettingsPanel />
      </DrawerContent>
    </Drawer>
  }

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent size="xl" className="settings-modal" showCloseButton>
      <DialogTitle className="sr-only">设置</DialogTitle>
      <DialogDescription className="sr-only">调整丝月工坊的外观、关联服务、数据与运行环境</DialogDescription>
      <SettingsPanel />
    </DialogContent>
  </Dialog>
}

function SettingsPanel() {
  const { snapshot, update, replace, flush } = useAppStore()
  const [activeSection, setActiveSection] = useState<SettingsSection>('appearance')
  const [username, setUsername] = useState(snapshot?.settings.bangumiUsername || '')
  const [message, setMessage] = useState('')
  const [pendingImport, setPendingImport] = useState<BackupEnvelope | null>(null)
  const importInput = useRef<HTMLInputElement>(null)

  useEffect(() => setUsername(snapshot?.settings.bangumiUsername || ''), [snapshot?.settings.bangumiUsername])
  if (!snapshot) return null

  const currentSection = sections.find((section) => section.id === activeSection) || sections[0]
  const setTheme = (theme: ThemeMode) => update((state) => ({ ...state, settings: { ...state.settings, theme, updatedAt: nowIso() } }))
  const saveUsername = () => {
    const clean = username.trim()
    if (clean === snapshot.settings.bangumiUsername) return
    update((state) => ({ ...state, bangumi: null, settings: { ...state.settings, bangumiUsername: clean, updatedAt: nowIso() } }))
    setMessage(clean ? '用户名已更新，返回收藏库后会自动同步。' : '已移除 Bangumi 用户名。')
  }
  const exportBackup = async () => {
    await flush()
    const contents = JSON.stringify(createBackup(snapshot), null, 2)
    if (window.siyue) {
      const saved = await window.siyue.backup.exportFile(contents)
      if (saved) setMessage('备份已成功导出。')
    } else {
      const url = URL.createObjectURL(new Blob([contents], { type: 'application/json' }))
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `siyue-backup-${new Date().toISOString().slice(0, 10)}.json`
      anchor.click()
      URL.revokeObjectURL(url)
      setMessage('备份已下载。')
    }
  }
  const applyImport = async (contents: string) => {
    try {
      setPendingImport(parseBackup(contents))
    } catch {
      setMessage('无法导入：文件不是有效的丝月工坊备份。')
    }
  }
  const importBackup = async () => {
    if (window.siyue) {
      const contents = await window.siyue.backup.importFile()
      if (contents) await applyImport(contents)
    } else {
      importInput.current?.click()
    }
  }

  return <div className="settings-layout">
    <aside className="settings-nav">
      <div className="settings-brand"><span><Settings size={18} /></span><div><strong>设置</strong><small>让工坊更贴合你的习惯</small></div></div>
      <nav aria-label="设置分类">
        {sections.map(({ id, label, description, icon: Icon }) => <button key={id} className={activeSection === id ? 'active' : ''} onClick={() => { setActiveSection(id); setMessage('') }} aria-current={activeSection === id ? 'page' : undefined}>
          <Icon size={17} /><span><strong>{label}</strong><small>{description}</small></span>
        </button>)}
      </nav>
      <div className="settings-nav-footer"><span>丝月工坊</span><small>MY QUIET SPACE</small></div>
    </aside>

    <main className="settings-content">
      <header className="settings-content-header"><span className="eyebrow">SETTINGS</span><h2>{currentSection.label}</h2><p>{currentSection.description}</p></header>
      {message && <div className="notice success settings-notice"><Check size={16} /><span>{message}</span><button onClick={() => setMessage('')}>知道了</button></div>}
      <div className="settings-section-body">
        {activeSection === 'appearance' && <AppearanceSettings theme={snapshot.settings.theme} onChange={setTheme} />}
        {activeSection === 'connections' && <ConnectionSettings username={username} onUsernameChange={setUsername} onSave={saveUsername} />}
        {activeSection === 'data' && <DataSettings counts={{ notes: snapshot.notes.length, goals: snapshot.goals.length, tracks: snapshot.tracks.length, bangumi: snapshot.bangumi?.items.length || 0 }} onExport={() => void exportBackup()} onImport={() => void importBackup()} inputRef={importInput} onFile={(file) => void file.text().then(applyImport)} />}
        {activeSection === 'about' && <AboutSettings />}
      </div>
    </main>

    <ConfirmDialog open={Boolean(pendingImport)} onOpenChange={(nextOpen) => { if (!nextOpen) setPendingImport(null) }} title="覆盖当前本地数据？" description={<>{pendingImport && <span className="backup-preview">{backupSummary(pendingImport)}</span>}<span>当前数据将被备份内容替换，建议先导出现有备份。</span></>} confirmLabel="覆盖并导入" destructive icon={<FileWarning />} onConfirm={async () => { if (!pendingImport) return; await replace(pendingImport.snapshot); setPendingImport(null); setMessage('备份已导入。') }} />
  </div>
}

function AppearanceSettings({ theme, onChange }: { theme: ThemeMode; onChange: (theme: ThemeMode) => void }) {
  return <section className="settings-pane"><SettingHeading icon={<Palette />} title="界面主题" description="选择最适合此刻光线的显示方式。" /><div className="theme-options"><ThemeOption value="system" active={theme === 'system'} icon={<Laptop />} title="跟随系统" onClick={onChange} /><ThemeOption value="light" active={theme === 'light'} icon={<Sun />} title="浅色" onClick={onChange} /><ThemeOption value="dark" active={theme === 'dark'} icon={<Moon />} title="深色" onClick={onChange} /></div></section>
}

function ConnectionSettings({ username, onUsernameChange, onSave }: { username: string; onUsernameChange: (value: string) => void; onSave: () => void }) {
  return <section className="settings-pane"><SettingHeading icon={<UserRound />} title="Bangumi 收藏" description="匿名读取一个用户的公开收藏。" /><label className="setting-field">用户名<div className="inline-field"><Input value={username} onChange={(event) => onUsernameChange(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') onSave() }} onBlur={onSave} placeholder="例如：sai" /><Button variant="outline" className="button secondary" onClick={onSave}>保存</Button></div><small>无需登录。更换用户名会清除当前收藏缓存，并在进入收藏库时重新读取。</small></label><Button variant="link" className="text-link" onClick={() => window.siyue?.system.openExternal('https://bgm.tv') ?? window.open('https://bgm.tv', '_blank', 'noopener,noreferrer')}>打开 Bangumi <ExternalLink size={14} /></Button></section>
}

function DataSettings({ counts, onExport, onImport, inputRef, onFile }: { counts: { notes: number; goals: number; tracks: number; bangumi: number }; onExport: () => void; onImport: () => void; inputRef: React.RefObject<HTMLInputElement | null>; onFile: (file: File) => void }) {
  return <section className="settings-pane"><SettingHeading icon={<Database />} title="本地数据" description="为重要内容留一份可以带走的副本。" /><div className="data-summary"><div><NotebookCount value={counts.notes} label="笔记" /></div><div><NotebookCount value={counts.goals} label="目标" /></div><div><NotebookCount value={counts.tracks} label="音乐索引" /></div><div><NotebookCount value={counts.bangumi} label="收藏缓存" /></div></div><div className="settings-actions"><Button variant="outline" className="button secondary" onClick={onExport}><Download size={16} />导出备份</Button><Button variant="outline" className="button secondary" onClick={onImport}><Upload size={16} />导入备份</Button><input ref={inputRef} hidden type="file" accept="application/json,.json" onChange={(event) => { const file = event.target.files?.[0]; if (file) onFile(file); event.currentTarget.value = '' }} /></div><small className="settings-note">备份包含笔记、目标、设置、Bangumi 缓存和音乐索引，不包含音乐原文件。</small></section>
}

function AboutSettings() {
  const desktop = Boolean(window.siyue)
  return <section className="settings-pane"><SettingHeading icon={desktop ? <HardDrive /> : <Globe2 />} title="运行环境" description={desktop ? 'Electron 桌面版' : '浏览器轻量版'} /><dl className="environment-list"><div><dt>数据位置</dt><dd>{desktop ? '本机 SQLite 数据库' : '浏览器 IndexedDB'}</dd></div><div><dt>本地音乐</dt><dd>{desktop ? '可用' : '仅桌面版可用'}</dd></div><div><dt>云端同步</dt><dd>未启用</dd></div><div><dt>应用版本</dt><dd>0.1.0</dd></div></dl></section>
}

function SettingHeading({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return <div className="settings-title"><span>{icon}</span><div><h3>{title}</h3><p>{description}</p></div></div>
}

function ThemeOption({ value, active, icon, title, onClick }: { value: ThemeMode; active: boolean; icon: React.ReactNode; title: string; onClick: (theme: ThemeMode) => void }) {
  return <button className={active ? 'active' : ''} onClick={() => onClick(value)}><span>{icon}</span><strong>{title}</strong>{active && <i><Check size={12} /></i>}</button>
}

function NotebookCount({ value, label }: { value: number; label: string }) {
  return <><strong>{value}</strong><span>{label}</span></>
}

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const media = window.matchMedia(query)
    const updateMatch = () => setMatches(media.matches)
    updateMatch()
    media.addEventListener('change', updateMatch)
    return () => media.removeEventListener('change', updateMatch)
  }, [query])
  return matches
}
