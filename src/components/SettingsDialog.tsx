import { useEffect, useRef, useState } from 'react'
import { Check, ClipboardPaste, Code2, Copy, Database, Download, ExternalLink, FileWarning, Globe2, HardDrive, Info, Laptop, Link2, Moon, Palette, RotateCcw, Settings, ShieldCheck, Sun, Undo2, Upload, UserRound, X } from 'lucide-react'
import { useAppStore } from '../app/AppStore'
import { backupSummary, createBackup, parseBackup } from '../data/backup'
import type { BackupEnvelope, ThemeMode, ThemePalette, ThemePalettes } from '../shared/types'
import { getThemeContrastIssues, normalizeThemePalettes, parseThemePalettes, serializeThemePalettes, themeColorFields, themeContrastMessage, themeCssVariables } from '../shared/theme'
import { nowIso } from '../utils'
import { ConfirmDialog } from './ConfirmDialog'
import { Button } from './ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from './ui/dialog'
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerTitle } from './ui/drawer'
import { Input } from './ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { Textarea } from './ui/textarea'

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
  const setThemePalettes = (themePalettes: ThemePalettes) => update((state) => ({ ...state, settings: { ...state.settings, themePalettes, updatedAt: nowIso() } }))
  const saveUsername = () => {
    const clean = username.trim()
    if (clean === snapshot.settings.bangumiUsername) return
    update((state) => ({ ...state, bangumi: null, settings: { ...state.settings, bangumiUsername: clean, updatedAt: nowIso() } }))
    setMessage(clean ? '用户名已更新，返回收藏库后会实时读取。' : '已移除 Bangumi 用户名。')
  }
  const exportBackup = async () => {
    await flush()
    const contents = JSON.stringify(createBackup(snapshot), null, 2)
    if (window.sylunae) {
      const saved = await window.sylunae.backup.exportFile(contents)
      if (saved) setMessage('备份已成功导出。')
    } else {
      const url = URL.createObjectURL(new Blob([contents], { type: 'application/json' }))
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `sylunae-backup-${new Date().toISOString().slice(0, 10)}.json`
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
    if (window.sylunae) {
      const contents = await window.sylunae.backup.importFile()
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
        {activeSection === 'appearance' && <AppearanceSettings theme={snapshot.settings.theme} palettes={snapshot.settings.themePalettes} onThemeChange={setTheme} onPalettesChange={setThemePalettes} />}
        {activeSection === 'connections' && <ConnectionSettings username={username} onUsernameChange={setUsername} onSave={saveUsername} />}
        {activeSection === 'data' && <DataSettings counts={{ notes: snapshot.notes.length, goals: snapshot.goals.length, tracks: snapshot.tracks.length }} onExport={() => void exportBackup()} onImport={() => void importBackup()} inputRef={importInput} onFile={(file) => void file.text().then(applyImport)} />}
        {activeSection === 'about' && <AboutSettings />}
      </div>
    </main>

    <ConfirmDialog open={Boolean(pendingImport)} onOpenChange={(nextOpen) => { if (!nextOpen) setPendingImport(null) }} title="覆盖当前本地数据？" description={<>{pendingImport && <span className="backup-preview">{backupSummary(pendingImport)}</span>}<span>当前数据将被备份内容替换，建议先导出现有备份。</span></>} confirmLabel="覆盖并导入" destructive icon={<FileWarning />} onConfirm={async () => { if (!pendingImport) return; await replace(pendingImport.snapshot); setPendingImport(null); setMessage('备份已导入。') }} />
  </div>
}

function AppearanceSettings({ theme, palettes, onThemeChange, onPalettesChange }: { theme: ThemeMode; palettes: ThemePalettes; onThemeChange: (theme: ThemeMode) => void; onPalettesChange: (palettes: ThemePalettes) => void }) {
  const [editingMode, setEditingMode] = useState<keyof ThemePalettes>(theme === 'dark' ? 'dark' : 'light')
  const [cssCode, setCssCode] = useState(() => serializeThemePalettes(palettes))
  const [paletteMessage, setPaletteMessage] = useState('')
  const [previousPalettes, setPreviousPalettes] = useState<ThemePalettes | null>(null)
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false)
  const cssInput = useRef<HTMLTextAreaElement>(null)

  useEffect(() => setCssCode(serializeThemePalettes(palettes)), [palettes])

  const commitPalettes = (next: ThemePalettes, message = '') => {
    setPreviousPalettes(palettes)
    onPalettesChange(next)
    setCssCode(serializeThemePalettes(next))
    setPaletteMessage(message)
  }

  const updateColor = (key: keyof ThemePalette, value: string) => {
    const next = { ...palettes, [editingMode]: { ...palettes[editingMode], [key]: value.toLowerCase() } }
    const issues = getThemeContrastIssues(next)
    if (issues.length) {
      setPaletteMessage(`未应用：${themeContrastMessage(issues)}`)
      return
    }
    commitPalettes(next)
  }
  const copyCss = async () => {
    const code = serializeThemePalettes(palettes)
    setCssCode(code)
    try {
      await navigator.clipboard.writeText(code)
    } catch {
      cssInput.current?.select()
      document.execCommand('copy')
    }
    setPaletteMessage('CSS 已复制，可以直接交给 AI 调色。')
  }
  const applyCss = () => {
    try {
      const parsed = parseThemePalettes(cssCode, palettes)
      const issues = getThemeContrastIssues(parsed)
      if (issues.length) {
        setPaletteMessage(`未应用：${themeContrastMessage(issues)}`)
        return
      }
      commitPalettes(parsed, 'CSS 色板已应用。')
    } catch (error) {
      setPaletteMessage(error instanceof Error ? error.message : 'CSS 色板无法识别。')
    }
  }

  return <div className="appearance-settings">
    <section className="settings-pane theme-mode-pane">
      <SettingHeading icon={<Palette />} title="界面主题" description="选择最适合此刻光线的显示方式。" />
      <div className="theme-options"><ThemeOption value="system" active={theme === 'system'} icon={<Laptop />} title="跟随系统" onClick={onThemeChange} /><ThemeOption value="light" active={theme === 'light'} icon={<Sun />} title="浅色" onClick={onThemeChange} /><ThemeOption value="dark" active={theme === 'dark'} icon={<Moon />} title="深色" onClick={onThemeChange} /></div>
    </section>

    <section className="settings-pane palette-pane">
      <SettingHeading icon={<Code2 />} title="全局配色" description="逐项调色，或让 AI 定制你的风格配色。" />
      <Tabs value={editingMode} onValueChange={(value) => setEditingMode(value as keyof ThemePalettes)}>
        <TabsList className="palette-tabs"><TabsTrigger value="light"><Sun />浅色配色</TabsTrigger><TabsTrigger value="dark"><Moon />深色配色</TabsTrigger></TabsList>
        {(['light', 'dark'] as const).map((mode) => <TabsContent value={mode} key={mode} className="palette-grid">
          {themeColorFields.map(({ key, label }) => <label className="color-field" key={key}>
            <input type="color" value={palettes[mode][key]} onChange={(event) => updateColor(key, event.target.value)} aria-label={`${label}颜色`} />
            <span><strong>{label}</strong><code>{themeCssVariables[key]}</code></span>
            <output>{palettes[mode][key]}</output>
          </label>)}
        </TabsContent>)}
      </Tabs>

      <div className="palette-safety"><ShieldCheck size={15} /><span>安全检查已开启：按钮文字自动适配；低对比度配色不会保存。</span></div>
      <div className="palette-code-heading"><div><strong>AI 调色代码</strong><small>仅支持上方列出的变量与六位十六进制色码。</small></div><div className="palette-code-controls"><Button variant="outline" className="button secondary" disabled={!previousPalettes} onClick={() => { if (!previousPalettes) return; onPalettesChange(previousPalettes); setCssCode(serializeThemePalettes(previousPalettes)); setPreviousPalettes(null); setPaletteMessage('已撤销本次配色修改。') }}><Undo2 size={15} /></Button><Button variant="outline" className="button secondary" onClick={() => setResetConfirmOpen(true)}><RotateCcw size={15} />恢复默认</Button><Button variant="outline" className="button secondary" onClick={() => void copyCss()}><Copy size={15} />复制 CSS</Button></div></div>
      <Textarea ref={cssInput} className="palette-code" value={cssCode} onChange={(event) => { setCssCode(event.target.value); setPaletteMessage('') }} spellCheck={false} aria-label="全局配色 CSS" />
      <div className="palette-code-actions"><span role="status">{paletteMessage}</span><Button className="button primary" onClick={applyCss}><ClipboardPaste size={15} />应用粘贴的 CSS</Button></div>
      <ConfirmDialog open={resetConfirmOpen} onOpenChange={setResetConfirmOpen} title="恢复默认配色？" description="这会同时还原浅色和深色配色方案，当前自定义颜色将被替换。" confirmLabel="恢复默认" icon={<RotateCcw />} onConfirm={() => { commitPalettes(normalizeThemePalettes(), '已恢复默认配色。'); setResetConfirmOpen(false) }} />
    </section>
  </div>
}

function ConnectionSettings({ username, onUsernameChange, onSave }: { username: string; onUsernameChange: (value: string) => void; onSave: () => void }) {
  return <section className="settings-pane"><SettingHeading icon={<UserRound />} title="Bangumi 收藏" description="匿名读取一个用户的公开收藏。" /><label className="setting-field">用户名<div className="inline-field"><Input value={username} onChange={(event) => onUsernameChange(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') onSave() }} onBlur={onSave} placeholder="例如：sai" /><Button variant="outline" className="button secondary" onClick={onSave}>保存</Button></div><small>无需登录。封面会缓存到本地；在收藏库中点击“刷新”即可重新读取数据并更新封面。</small></label><Button variant="link" className="text-link" onClick={() => window.sylunae?.system.openExternal('https://bgm.tv') ?? window.open('https://bgm.tv', '_blank', 'noopener,noreferrer')}>打开 Bangumi <ExternalLink size={14} /></Button></section>
}

function DataSettings({ counts, onExport, onImport, inputRef, onFile }: { counts: { notes: number; goals: number; tracks: number }; onExport: () => void; onImport: () => void; inputRef: React.RefObject<HTMLInputElement | null>; onFile: (file: File) => void }) {
  return <section className="settings-pane"><SettingHeading icon={<Database />} title="本地数据" description="为重要内容留一份可以带走的副本。" /><div className="data-summary"><div><NotebookCount value={counts.notes} label="笔记" /></div><div><NotebookCount value={counts.goals} label="目标" /></div><div><NotebookCount value={counts.tracks} label="音乐索引" /></div></div><div className="settings-actions"><Button variant="outline" className="button secondary" onClick={onExport}><Download size={16} />导出备份</Button><Button variant="outline" className="button secondary" onClick={onImport}><Upload size={16} />导入备份</Button><input ref={inputRef} hidden type="file" accept="application/json,.json" onChange={(event) => { const file = event.target.files?.[0]; if (file) onFile(file); event.currentTarget.value = '' }} /></div><small className="settings-note">备份包含笔记、目标、设置和音乐索引，不包含音乐原文件与实时 Bangumi 数据。</small></section>
}

function AboutSettings() {
  const desktop = Boolean(window.sylunae)
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
