import type { AppSnapshot } from './types'
import { normalizeThemePalettes } from './theme'

export function createDefaultSnapshot(): AppSnapshot {
  const now = new Date().toISOString()
  return {
    version: 1,
    settings: {
      theme: 'system',
      themePalettes: normalizeThemePalettes(),
      lastTool: 'tasks',
      sidebarCollapsed: false,
      bangumiUsername: '',
      updatedAt: now,
    },
    bangumi: null,
    tracks: [],
    albums: [],
    folders: [],
    notes: [],
    goals: [],
    todos: [],
    pomodoro: {
      mode: 'focus',
      focusMinutes: 25,
      shortBreakMinutes: 5,
      longBreakMinutes: 15,
      sessionsBeforeLongBreak: 4,
      completedSessions: 0,
      secondsRemaining: 25 * 60,
      running: false,
      endsAt: null,
    },
    clipboardSnippets: [],
    launcherLinks: [],
  }
}
