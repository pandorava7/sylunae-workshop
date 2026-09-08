import { useEffect, useRef, useState } from 'react'
import { Check, Database, Download, ExternalLink, Globe2, HardDrive, Laptop, Moon, Palette, Sun, Upload, UserRound } from 'lucide-react'
import { useAppStore } from '../app/AppStore'
import { backupSummary, createBackup, parseBackup } from '../data/backup'
import type { ThemeMode } from '../shared/types'
import { nowIso } from '../utils'

export function SettingsPage() {
  const { snapshot, update, replace, flush } = useAppStore()
  const [username, setUsername] = useState(snapshot?.settings.bangumiUsername || '')
  const [message, setMessage] = useState('')
  const importInput = useRef<HTMLInputElement>(null)
  useEffect(() => setUsername(snapshot?.settings.bangumiUsername || ''), [snapshot?.settings.bangumiUsername])
  if (!snapshot) return null

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
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = `siyue-backup-${new Date().toISOString().slice(0, 10)}.json`; anchor.click(); URL.revokeObjectURL(url)
      setMessage('备份已下载。')
    }
  }
  const applyImport = async (contents: string) => {
    try {
      const backup = parseBackup(contents)
      if (!confirm(`即将用备份替换当前本地数据：\n${backupSummary(backup)}\n\n当前数据会被覆盖，是否继续？`)) return
      await replace(backup.snapshot)
      setMessage('备份已导入。')
    } catch { setMessage('无法导入：文件不是有效的丝月工坊备份。') }
  }
  const importBackup = async () => {
    if (window.siyue) {
      const contents = await window.siyue.backup.importFile(); if (contents) await applyImport(contents)
    } else importInput.current?.click()
  }

  return <section className="page settings-page">
    <header className="page-header"><div><span className="eyebrow">SETTINGS</span><h1>设置</h1><p>让丝月工坊更贴合你的使用习惯</p></div></header>
    {message && <div className="notice success"><Check size={16} /><span>{message}</span><button onClick={() => setMessage('')}>知道了</button></div>}
    <div className="settings-grid">
      <section className="settings-card"><div className="settings-title"><span><Palette size={18} /></span><div><h2>外观</h2><p>选择最适合此刻光线的界面</p></div></div><div className="theme-options"><ThemeOption value="system" active={snapshot.settings.theme === 'system'} icon={<Laptop />} title="跟随系统" onClick={setTheme} /><ThemeOption value="light" active={snapshot.settings.theme === 'light'} icon={<Sun />} title="浅色" onClick={setTheme} /><ThemeOption value="dark" active={snapshot.settings.theme === 'dark'} icon={<Moon />} title="深色" onClick={setTheme} /></div></section>
      <section className="settings-card"><div className="settings-title"><span><UserRound size={18} /></span><div><h2>Bangumi 收藏</h2><p>匿名读取一个用户的公开收藏</p></div></div><label className="setting-field">用户名<div className="inline-field"><input value={username} onChange={(event) => setUsername(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') saveUsername() }} onBlur={saveUsername} placeholder="例如：sai" /><button className="button secondary" onClick={saveUsername}>保存</button></div><small>无需登录。更换用户名会清除当前收藏缓存，并在进入收藏库时重新读取。</small></label><button className="text-link" onClick={() => window.siyue?.system.openExternal('https://bgm.tv') ?? window.open('https://bgm.tv', '_blank', 'noopener,noreferrer')}>打开 Bangumi <ExternalLink size={14} /></button></section>
      <section className="settings-card"><div className="settings-title"><span><Database size={18} /></span><div><h2>数据与备份</h2><p>为本地数据留一份可带走的副本</p></div></div><div className="data-summary"><div><NotebookCount value={snapshot.notes.length} label="笔记" /></div><div><NotebookCount value={snapshot.goals.length} label="目标" /></div><div><NotebookCount value={snapshot.tracks.length} label="音乐索引" /></div><div><NotebookCount value={snapshot.bangumi?.items.length || 0} label="收藏缓存" /></div></div><div className="settings-actions"><button className="button secondary" onClick={() => void exportBackup()}><Download size={16} />导出备份</button><button className="button secondary" onClick={() => void importBackup()}><Upload size={16} />导入备份</button><input ref={importInput} hidden type="file" accept="application/json,.json" onChange={(event) => { const file = event.target.files?.[0]; if (file) void file.text().then(applyImport); event.currentTarget.value = '' }} /></div><small className="settings-note">备份包含笔记、目标、设置、Bangumi 缓存和音乐索引，不包含音乐原文件。</small></section>
      <section className="settings-card"><div className="settings-title"><span>{window.siyue ? <HardDrive size={18} /> : <Globe2 size={18} />}</span><div><h2>运行环境</h2><p>{window.siyue ? 'Electron 桌面版' : '浏览器轻量版'}</p></div></div><dl className="environment-list"><div><dt>数据位置</dt><dd>{window.siyue ? '本机 SQLite 数据库' : '浏览器 IndexedDB'}</dd></div><div><dt>本地音乐</dt><dd>{window.siyue ? '可用' : '仅桌面版可用'}</dd></div><div><dt>云端同步</dt><dd>未启用</dd></div><div><dt>应用版本</dt><dd>0.1.0</dd></div></dl></section>
    </div>
  </section>
}

function ThemeOption({ value, active, icon, title, onClick }: { value: ThemeMode; active: boolean; icon: React.ReactNode; title: string; onClick: (theme: ThemeMode) => void }) {
  return <button className={active ? 'active' : ''} onClick={() => onClick(value)}><span>{icon}</span><strong>{title}</strong>{active && <i><Check size={12} /></i>}</button>
}

function NotebookCount({ value, label }: { value: number; label: string }) { return <><strong>{value}</strong><span>{label}</span></> }
