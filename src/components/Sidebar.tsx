import { useEffect, useState, type CSSProperties } from 'react'
import { BookHeart, Boxes, ChevronLeft, ChevronRight, Download, Home, Library, ListChecks, Menu, Music2, NotebookPen, Settings } from 'lucide-react'
import type { MusicTrack, ToolId } from '../shared/types'
import { BrandMark } from './Icons'

const tools: Array<{ id: ToolId; label: string; icon: typeof Library }> = [
  { id: 'home', label: '主页', icon: Home },
  { id: 'tasks', label: '任务箱', icon: ListChecks },
  { id: 'notes', label: '笔记本', icon: NotebookPen },
  { id: 'music', label: '音乐库', icon: Music2 },
  { id: 'collection', label: '收藏馆', icon: BookHeart },
  { id: 'tools', label: '工具箱', icon: Boxes },
]

const releasesApi = 'https://api.github.com/repos/pandorava7/sylunae-workshop/releases/latest'

function openExternal(url: string, target = '_blank') {
  if (window.sylunae) {
    void window.sylunae.system.openExternal(url)
    return
  }
  window.open(url, target, 'noopener,noreferrer')
}

function downloadDesktopApp() {
  void fetch(releasesApi, { headers: { Accept: 'application/vnd.github+json' } })
    .then(async (response) => {
      if (!response.ok) throw new Error('未找到已发布的安装包')
      const release = await response.json() as { assets?: Array<{ name: string; browser_download_url: string }> }
      const installer = release.assets?.find((asset) => /-Setup\.exe$/i.test(asset.name))
      if (!installer) throw new Error('未找到 Windows 安装包')
      return installer.browser_download_url
    })
    .then((url) => openExternal(url, '_self'))
    .catch(() => openExternal('https://github.com/pandorava7/sylunae-workshop/releases/latest'))
}

export function Sidebar({ active, collapsed, mobileOpen, settingsOpen, nowPlaying, onSelect, onOpenSettings, onToggle, onOpen, onClose }: {
  active: ToolId
  collapsed: boolean
  mobileOpen: boolean
  settingsOpen: boolean
  nowPlaying: MusicTrack | null
  onSelect: (tool: ToolId) => void
  onOpenSettings: () => void
  onToggle: () => void
  onOpen: () => void
  onClose: () => void
}) {
  const [displayTrack, setDisplayTrack] = useState<MusicTrack | null>(nowPlaying)

  useEffect(() => {
    if (nowPlaying) setDisplayTrack(nowPlaying)
  }, [nowPlaying])

  const select = (tool: ToolId) => { onSelect(tool); onClose() }
  const openSettings = () => { onOpenSettings(); onClose() }
  return <>
    <button className="mobile-menu" onClick={onOpen} aria-label="打开导航"><Menu size={20} /></button>
    {mobileOpen && <button className="sidebar-backdrop" onClick={onClose} aria-label="关闭导航" />}
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
      <button className={`brand ${active === 'home' ? 'active' : ''}`} onClick={() => select('home')} title="返回主页" aria-label="返回主页">
        <BrandMark />
        {!collapsed && <div><strong>丝月工坊</strong><span>MY QUIET SPACE</span></div>}
      </button>
      <div className={`now-playing-slot ${nowPlaying ? 'visible' : ''}`} aria-hidden={!nowPlaying}>
        <button
          className="sidebar-now-playing"
          onClick={() => select('music')}
          tabIndex={nowPlaying ? 0 : -1}
          title={displayTrack ? `正在播放：${displayTrack.title}` : undefined}
          style={{ '--now-playing-cover': displayTrack?.cover ? `url(${displayTrack.cover})` : 'none' } as CSSProperties}
        >
          <span className="music-wave" aria-hidden><i /><i /><i /><i /></span>
          <span className="now-playing-copy"><strong>{displayTrack?.title || '正在播放'}</strong><small>{displayTrack?.artist || '未知艺术家'}</small></span>
        </button>
      </div>
      <nav>
        {!collapsed && <div className="nav-caption">工具</div>}
        {tools.map(({ id, label, icon: Icon }) => <button key={id} className={active === id ? 'active' : ''} onClick={() => select(id)} title={label}>
          <Icon size={19} strokeWidth={1.7} /><span>{label}</span>
        </button>)}
        {!window.sylunae && <button className="desktop-download-card" onClick={downloadDesktopApp} title="下载桌面端安装包">
          <span className="download-card-icon"><Download size={18} strokeWidth={1.8} /></span>
          <span className="download-card-copy"><strong>桌面端安装包</strong><small>下载最新 Windows 版本</small></span>
          <ChevronRight className="download-card-arrow" size={16} strokeWidth={1.8} />
        </button>}
      </nav>
      <div className="sidebar-footer">
        <button className={settingsOpen ? 'active' : ''} onClick={openSettings} title="设置" aria-haspopup="dialog" aria-expanded={settingsOpen}>
          <Settings size={19} strokeWidth={1.7} /><span>设置</span>
        </button>
        <button onClick={onToggle} title={collapsed ? '展开侧栏' : '收起侧栏'}>
          {collapsed ? <ChevronRight size={19} /> : <ChevronLeft size={19} />}<span>{collapsed ? '' : '收起'}</span>
        </button>
      </div>
    </aside>
  </>
}
