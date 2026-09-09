import { lazy, Suspense, useEffect, useState } from 'react'
import { Sidebar } from './components/Sidebar'
import { Spinner } from './components/Icons'
import { useAppStore } from './app/AppStore'
import type { MusicTrack, ToolId } from './shared/types'
import { accessibleForeground, themeColorFields, themeCssVariables, themeDerivedCssVariables } from './shared/theme'
import { TooltipProvider } from './components/ui/tooltip'

const MusicPage = lazy(() => import('./pages/MusicPage').then((module) => ({ default: module.MusicPage })))
const NotesPage = lazy(() => import('./pages/NotesPage').then((module) => ({ default: module.NotesPage })))
const TasksPage = lazy(() => import('./pages/TasksPage').then((module) => ({ default: module.TasksPage })))
const CollectionPage = lazy(() => import('./pages/CollectionPage').then((module) => ({ default: module.CollectionPage })))
const ToolsPage = lazy(() => import('./pages/ToolsPage').then((module) => ({ default: module.ToolsPage })))
const SettingsDialog = lazy(() => import('./components/SettingsDialog').then((module) => ({ default: module.SettingsDialog })))

export default function App() {
  const { snapshot, loading, saving, error, update } = useAppStore()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsMounted, setSettingsMounted] = useState(false)
  const [musicMounted, setMusicMounted] = useState(false)
  const [nowPlaying, setNowPlaying] = useState<MusicTrack | null>(null)
  const [pageScrolled, setPageScrolled] = useState(false)

  useEffect(() => {
    if (!snapshot) return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const effective = snapshot.settings.theme === 'system' ? (media.matches ? 'dark' : 'light') : snapshot.settings.theme
      document.documentElement.dataset.theme = effective
      document.documentElement.classList.toggle('dark', effective === 'dark')
      const palette = snapshot.settings.themePalettes[effective]
      themeColorFields.forEach(({ key }) => document.documentElement.style.setProperty(themeCssVariables[key], palette[key]))
      const primaryForeground = accessibleForeground(palette.brand, palette.accentDeep)
      const destructiveForeground = accessibleForeground(palette.danger)
      document.documentElement.style.setProperty(themeDerivedCssVariables.primaryForeground, primaryForeground)
      document.documentElement.style.setProperty(themeDerivedCssVariables.destructiveForeground, destructiveForeground)
      document.documentElement.style.setProperty(themeDerivedCssVariables.sidebarPrimaryForeground, primaryForeground)
    }
    apply()
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [snapshot?.settings.theme, snapshot?.settings.themePalettes])

  useEffect(() => {
    if (snapshot?.settings.lastTool !== 'settings') return
    setSettingsMounted(true)
    setSettingsOpen(true)
    update((state) => ({ ...state, settings: { ...state.settings, lastTool: 'tasks', updatedAt: new Date().toISOString() } }))
  }, [snapshot?.settings.lastTool, update])

  useEffect(() => {
    if (snapshot?.settings.lastTool === 'music') setMusicMounted(true)
  }, [snapshot?.settings.lastTool])

  useEffect(() => setPageScrolled(false), [snapshot?.settings.lastTool])

  if (loading || !snapshot) return <div className="app-loading"><Spinner /><span>正在打开丝月工坊…</span></div>

  const selectTool = (tool: ToolId) => update((state) => ({ ...state, settings: { ...state.settings, lastTool: tool, updatedAt: new Date().toISOString() } }))
  const toggleSidebar = () => update((state) => ({ ...state, settings: { ...state.settings, sidebarCollapsed: !state.settings.sidebarCollapsed, updatedAt: new Date().toISOString() } }))
  const openSettings = () => { setSettingsMounted(true); setSettingsOpen(true) }
  const activeTool = snapshot.settings.lastTool === 'settings' ? 'tasks' : snapshot.settings.lastTool
  const page = {
    tasks: <TasksPage />,
    collection: <CollectionPage />,
    tools: <ToolsPage />,
    music: null,
    notes: <NotesPage />,
  }[activeTool]

  return <TooltipProvider><div className="app-shell">
    <Sidebar active={activeTool} collapsed={snapshot.settings.sidebarCollapsed} mobileOpen={mobileOpen} settingsOpen={settingsOpen} nowPlaying={nowPlaying} onSelect={selectTool} onOpenSettings={openSettings} onToggle={toggleSidebar} onOpen={() => setMobileOpen(true)} onClose={() => setMobileOpen(false)} />
    {window.sylunae && <div className={`app-titlebar ${pageScrolled ? 'scrolled' : ''}`} aria-hidden="true"><div className="app-titlebar-drag" /></div>}
    <main className="content-shell" onScrollCapture={(event) => {
      const target = event.target
      if (target instanceof HTMLElement) setPageScrolled((current) => {
        const next = target.scrollTop > 0
        return current === next ? current : next
      })
    }}>
      <Suspense fallback={<div className="app-loading"><Spinner /></div>}>
        {page}
        {(musicMounted || activeTool === 'music') && <div className="persistent-page" hidden={activeTool !== 'music'}><MusicPage onNowPlayingChange={setNowPlaying} /></div>}
      </Suspense>
      <div className={`save-indicator ${error ? 'error' : ''}`}>{error || (saving ? '正在保存…' : '')}</div>
    </main>
    <Suspense fallback={null}>{settingsMounted && <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />}</Suspense>
  </div></TooltipProvider>
}
