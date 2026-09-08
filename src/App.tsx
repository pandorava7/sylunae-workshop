import { lazy, Suspense, useEffect, useState } from 'react'
import { Sidebar } from './components/Sidebar'
import { Spinner } from './components/Icons'
import { useAppStore } from './app/AppStore'
import type { ToolId } from './shared/types'

const LibraryPage = lazy(() => import('./pages/LibraryPage').then((module) => ({ default: module.LibraryPage })))
const MusicPage = lazy(() => import('./pages/MusicPage').then((module) => ({ default: module.MusicPage })))
const NotesPage = lazy(() => import('./pages/NotesPage').then((module) => ({ default: module.NotesPage })))
const GoalsPage = lazy(() => import('./pages/GoalsPage').then((module) => ({ default: module.GoalsPage })))
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((module) => ({ default: module.SettingsPage })))

export default function App() {
  const { snapshot, loading, saving, error, update } = useAppStore()
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    if (!snapshot) return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const effective = snapshot.settings.theme === 'system' ? (media.matches ? 'dark' : 'light') : snapshot.settings.theme
      document.documentElement.dataset.theme = effective
    }
    apply()
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [snapshot?.settings.theme])

  if (loading || !snapshot) return <div className="app-loading"><Spinner /><span>正在打开丝月工坊…</span></div>

  const selectTool = (tool: ToolId) => update((state) => ({ ...state, settings: { ...state.settings, lastTool: tool, updatedAt: new Date().toISOString() } }))
  const toggleSidebar = () => update((state) => ({ ...state, settings: { ...state.settings, sidebarCollapsed: !state.settings.sidebarCollapsed, updatedAt: new Date().toISOString() } }))
  const page = {
    library: <LibraryPage />,
    music: <MusicPage />,
    notes: <NotesPage />,
    goals: <GoalsPage />,
    settings: <SettingsPage />,
  }[snapshot.settings.lastTool]

  return <div className="app-shell">
    <Sidebar active={snapshot.settings.lastTool} collapsed={snapshot.settings.sidebarCollapsed} mobileOpen={mobileOpen} onSelect={selectTool} onToggle={toggleSidebar} onOpen={() => setMobileOpen(true)} onClose={() => setMobileOpen(false)} />
    <main className="content-shell">
      <div className="window-drag" />
      <Suspense fallback={<div className="app-loading"><Spinner /></div>}>{page}</Suspense>
      <div className={`save-indicator ${error ? 'error' : ''}`}>{error || (saving ? '正在保存…' : '')}</div>
    </main>
  </div>
}
