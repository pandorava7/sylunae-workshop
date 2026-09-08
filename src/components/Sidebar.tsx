import { BookHeart, ChevronLeft, ChevronRight, Library, ListChecks, Menu, Music2, NotebookPen, Settings } from 'lucide-react'
import type { ToolId } from '../shared/types'
import { BrandMark } from './Icons'

const tools: Array<{ id: ToolId; label: string; icon: typeof Library }> = [
  { id: 'library', label: '收藏库', icon: BookHeart },
  { id: 'music', label: '音乐', icon: Music2 },
  { id: 'notes', label: '笔记', icon: NotebookPen },
  { id: 'goals', label: '目标', icon: ListChecks },
]

export function Sidebar({ active, collapsed, mobileOpen, onSelect, onToggle, onOpen, onClose }: {
  active: ToolId
  collapsed: boolean
  mobileOpen: boolean
  onSelect: (tool: ToolId) => void
  onToggle: () => void
  onOpen: () => void
  onClose: () => void
}) {
  const select = (tool: ToolId) => { onSelect(tool); onClose() }
  return <>
    <button className="mobile-menu" onClick={onOpen} aria-label="打开导航"><Menu size={20} /></button>
    {mobileOpen && <button className="sidebar-backdrop" onClick={onClose} aria-label="关闭导航" />}
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
      <div className="drag-region" />
      <div className="brand">
        <BrandMark />
        {!collapsed && <div><strong>丝月工坊</strong><span>MY QUIET SPACE</span></div>}
      </div>
      <nav>
        {!collapsed && <div className="nav-caption">工具</div>}
        {tools.map(({ id, label, icon: Icon }) => <button key={id} className={active === id ? 'active' : ''} onClick={() => select(id)} title={label}>
          <Icon size={19} strokeWidth={1.7} /><span>{label}</span>
        </button>)}
      </nav>
      <div className="sidebar-footer">
        <button className={active === 'settings' ? 'active' : ''} onClick={() => select('settings')} title="设置">
          <Settings size={19} strokeWidth={1.7} /><span>设置</span>
        </button>
        <button onClick={onToggle} title={collapsed ? '展开侧栏' : '收起侧栏'}>
          {collapsed ? <ChevronRight size={19} /> : <ChevronLeft size={19} />}<span>{collapsed ? '' : '收起'}</span>
        </button>
      </div>
    </aside>
  </>
}
